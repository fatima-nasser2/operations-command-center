import { db } from './db';
import { dispatch } from './adapters';
import { executeMockService } from './mock-services';
import type { IncomingEvent, Stream } from './types';

export type { IncomingEvent, Stream };

export type ValidationResult =
  | { ok: true; event: IncomingEvent }
  | { ok: false; errors: string[] };

export function validateEvent(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['event must be a non-null object'] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (!('source_event_id' in obj) || obj.source_event_id == null) {
    errors.push('missing required field: source_event_id');
  } else if (typeof obj.source_event_id !== 'string' || !obj.source_event_id.trim()) {
    errors.push('source_event_id must be a non-empty string');
  }

  if (!('source' in obj) || obj.source == null) {
    errors.push('missing required field: source');
  } else if (typeof obj.source !== 'string' || !obj.source.trim()) {
    errors.push('source must be a non-empty string');
  }

  if (!('event_type' in obj) || obj.event_type == null) {
    errors.push('missing required field: event_type');
  } else if (typeof obj.event_type !== 'string' || !obj.event_type.trim()) {
    errors.push('event_type must be a non-empty string');
  }

  if (!('payload' in obj) || obj.payload == null) {
    errors.push('missing required field: payload');
  } else if (typeof obj.payload !== 'object' || Array.isArray(obj.payload)) {
    errors.push('payload must be a non-null object');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, event: obj as unknown as IncomingEvent };
}

const KNOWN_STREAMS = ['financeops', 'campaignops', 'guestops'] as const;

export function classifyStream(source: string): Stream {
  const normalized = source.toLowerCase().trim();
  for (const stream of KNOWN_STREAMS) {
    if (normalized === stream || normalized.startsWith(`${stream}.`) || normalized.startsWith(`${stream}-`)) {
      return stream;
    }
  }
  return 'unknown';
}

export type PipelineResult =
  | { ok: true; eventId: number; duplicate: boolean }
  | { ok: false; step: string; errors: string[] };

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (source_event_id, source, event_type, status, payload)
  VALUES (@source_event_id, @source, @event_type, 'received', @payload)
`);

const insertAuditLog = db.prepare(`
  INSERT INTO audit_logs (event_id, message, metadata)
  VALUES (@event_id, @message, @metadata)
`);

const updateEventStatus = db.prepare(`
  UPDATE events SET status = @status WHERE id = @id
`);

const insertAction = db.prepare(`
  INSERT INTO actions (event_id, type, status, payload)
  VALUES (@event_id, @type, @status, @payload)
`);

const insertReviewQueueItem = db.prepare(`
  INSERT INTO review_queue_items (event_id, status, reason, payload)
  VALUES (@event_id, 'pending', @reason, '{}')
`);

const routeToReviewTx = db.transaction((eventId: number, reason: string) => {
  updateEventStatus.run({ status: 'review_required', id: eventId });
  insertReviewQueueItem.run({ event_id: eventId, reason });
  insertAuditLog.run({
    event_id: eventId,
    message: 'event routed to review',
    metadata: JSON.stringify({ reason }),
  });
});

const findBySourceEventId = db.prepare<{ source_event_id: string }, { id: number }>(`
  SELECT id FROM events WHERE source_event_id = @source_event_id
`);

const storeEventTx = db.transaction((event: IncomingEvent) => {
  const result = insertEvent.run({
    source_event_id: event.source_event_id,
    source: event.source,
    event_type: event.event_type,
    payload: JSON.stringify(event.payload),
  });

  // changes === 0 means the UNIQUE constraint fired — look up the existing row's id
  if (result.changes === 0) {
    const existing = findBySourceEventId.get({ source_event_id: event.source_event_id })!;
    return { stored: false, eventId: existing.id };
  }

  const eventId = Number(result.lastInsertRowid);

  insertAuditLog.run({
    event_id: eventId,
    message: 'event received',
    metadata: JSON.stringify({ source: event.source, event_type: event.event_type }),
  });

  return { stored: true, eventId };
});

export async function processEvent(raw: unknown): Promise<PipelineResult> {
  // Step 1: validate required top-level fields
  const validation = validateEvent(raw);
  if (!validation.ok) {
    return { ok: false, step: 'validate', errors: validation.errors };
  }

  // Step 2: persist with status 'received' and write audit log
  const { stored, eventId } = storeEventTx(validation.event);
  if (!stored) {
    return { ok: true, eventId, duplicate: true };
  }

  // Step 3: advance status to 'processing' and write audit log
  updateEventStatus.run({ status: 'processing', id: eventId });
  insertAuditLog.run({
    event_id: eventId,
    message: 'event processing started',
    metadata: JSON.stringify({ previous_status: 'received' }),
  });

  // Step 4: classify the stream from source
  const stream = classifyStream(validation.event.source);

  // Step 5: unknown stream → review queue, stop pipeline
  if (stream === 'unknown') {
    routeToReviewTx(eventId, 'Unable to determine workflow stream');
    return { ok: true, eventId, duplicate: false };
  }

  // Step 6: dispatch to the matching adapter to generate actions
  const adapterResult = await dispatch(stream, validation.event);

  // Step 7: adapter review signal → review queue, stop pipeline
  if (!adapterResult.ok) {
    routeToReviewTx(eventId, adapterResult.reason);
    return { ok: true, eventId, duplicate: false };
  }

  insertAuditLog.run({
    event_id: eventId,
    message: 'adapter generated actions',
    metadata: JSON.stringify({ stream, action_count: adapterResult.actions.length }),
  });

  // Step 8: pass actions to the mock service to simulate execution
  // Step 9: if the service throws, route to review and stop
  let serviceResult;
  try {
    serviceResult = await executeMockService(stream, adapterResult.actions, validation.event.payload);
  } catch {
    routeToReviewTx(eventId, 'Mock service failure');
    return { ok: true, eventId, duplicate: false };
  }

  if (!serviceResult.ok) {
    routeToReviewTx(eventId, serviceResult.reason);
    return { ok: true, eventId, duplicate: false };
  }

  insertAuditLog.run({
    event_id: eventId,
    message: 'mock service execution succeeded',
    metadata: JSON.stringify({ stream, action_count: adapterResult.actions.length }),
  });

  // Step 10: persist the generated actions with status 'completed'
  for (const action of adapterResult.actions) {
    const result = insertAction.run({
      event_id: eventId,
      type: action.type,
      status: 'completed',
      payload: JSON.stringify(action.payload),
    });
    insertAuditLog.run({
      event_id: eventId,
      message: `action persisted: ${action.type}`,
      metadata: JSON.stringify({ action_id: Number(result.lastInsertRowid), status: 'completed' }),
    });
  }

  // Step 11: mark event completed and write final audit log
  updateEventStatus.run({ status: 'completed', id: eventId });
  insertAuditLog.run({
    event_id: eventId,
    message: 'event completed',
    metadata: JSON.stringify({ stream, action_count: adapterResult.actions.length }),
  });

  return { ok: true, eventId, duplicate: false };
}
