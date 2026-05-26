import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { processEvent } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: number;
  source_event_id: string;
  source: string;
  event_type: string;
  status: string;
  payload: string;
  created_at: string;
  updated_at: string;
}

interface ActionRow {
  id: number;
  event_id: number;
  type: string;
  status: string;
  payload: string;
  created_at: string;
}

const selectAllEvents = db.prepare(`
  SELECT * FROM events ORDER BY created_at DESC
`);

const selectEventById = db.prepare(`
  SELECT * FROM events WHERE id = ?
`);

const selectActionsByEventId = db.prepare(`
  SELECT * FROM actions WHERE event_id = ?
`);

const selectReviewReasonByEventId = db.prepare<[number], { reason: string }>(`
  SELECT reason FROM review_queue_items WHERE event_id = ? LIMIT 1
`);

function parseEvent(row: EventRow) {
  return { ...row, payload: JSON.parse(row.payload) };
}

function parseAction(row: ActionRow) {
  return { ...row, payload: JSON.parse(row.payload) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const reviewRequired = searchParams.get('review_required');

  let events = (selectAllEvents.all() as EventRow[]).map(parseEvent);

  if (reviewRequired === 'true') {
    events = events.filter((e) => e.status === 'review_required');
  } else if (status) {
    events = events.filter((e) => e.status === status);
  }
  if (source) {
    events = events.filter((e) => e.source === source);
  }

  return Response.json({ events });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = await processEvent(body);

  if (!result.ok) {
    return Response.json({ error: 'Validation failed', details: result.errors }, { status: 400 });
  }

  if (result.duplicate) {
    return Response.json(
      { error: 'An event with this source_event_id already exists' },
      { status: 409 },
    );
  }

  const event = parseEvent(selectEventById.get(result.eventId) as EventRow);
  const actions = (selectActionsByEventId.all(result.eventId) as ActionRow[]).map(parseAction);
  const reviewRow = event.status === 'review_required'
    ? selectReviewReasonByEventId.get(result.eventId)
    : null;

  return Response.json(
    { event, actions, review_reason: reviewRow?.reason ?? null },
    { status: 201 },
  );
}
