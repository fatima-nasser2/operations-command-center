import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import type { Action } from '@/lib/types';

interface ReviewQueueItemRow {
  id: number; event_id: number; status: string; reason: string;
  payload: string; resolved_at: string | null; created_at: string;
}
interface EventRow {
  id: number; source_event_id: string; source: string; event_type: string;
  status: string; payload: string; created_at: string; updated_at: string;
}

const selectReviewItem = db.prepare(`SELECT * FROM review_queue_items WHERE id = ?`);
const selectEvent = db.prepare(`SELECT * FROM events WHERE id = ?`);

const resolveReviewItem = db.prepare(`
  UPDATE review_queue_items
  SET status = @status, resolved_at = @resolved_at, payload = @payload
  WHERE id = @id
`);
const updateEventStatus = db.prepare(`UPDATE events SET status = @status WHERE id = @id`);
const insertAction = db.prepare(`
  INSERT INTO actions (event_id, type, status, payload)
  VALUES (@event_id, @type, 'completed', @payload)
`);
const insertAuditLog = db.prepare(`
  INSERT INTO audit_logs (event_id, message, metadata)
  VALUES (@event_id, @message, @metadata)
`);

const resolveReviewTx = db.transaction((
  reviewItemId: number,
  eventId: number,
  action: 'approve' | 'reject',
  notes: string | undefined,
  editedActions: Action[] | undefined,
) => {
  const now = new Date().toISOString();
  const reviewStatus = action === 'approve' ? 'approved' : 'rejected';
  const eventStatus = action === 'approve' ? 'completed' : 'failed';

  resolveReviewItem.run({
    id: reviewItemId,
    status: reviewStatus,
    resolved_at: now,
    payload: JSON.stringify({ notes: notes ?? null }),
  });

  updateEventStatus.run({ status: eventStatus, id: eventId });

  if (action === 'approve' && editedActions?.length) {
    for (const a of editedActions) {
      insertAction.run({
        event_id: eventId,
        type: a.type,
        payload: JSON.stringify(a.payload),
      });
    }
  }

  insertAuditLog.run({
    event_id: eventId,
    message: `review ${reviewStatus}`,
    metadata: JSON.stringify({
      action,
      notes: notes ?? null,
      edited_action_count: editedActions?.length ?? 0,
    }),
  });
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reviewItemId = Number(id);

  if (!Number.isInteger(reviewItemId) || reviewItemId <= 0) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: { action: unknown; notes?: unknown; edited_actions?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, notes, edited_actions } = body;

  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  }

  const reviewItem = selectReviewItem.get(reviewItemId) as ReviewQueueItemRow | undefined;
  if (!reviewItem) {
    return Response.json({ error: 'Review item not found' }, { status: 404 });
  }

  resolveReviewTx(
    reviewItemId,
    reviewItem.event_id,
    action,
    typeof notes === 'string' ? notes : undefined,
    Array.isArray(edited_actions) ? (edited_actions as Action[]) : undefined,
  );

  const updatedItem = selectReviewItem.get(reviewItemId) as ReviewQueueItemRow;
  const updatedEvent = selectEvent.get(reviewItem.event_id) as EventRow;

  return Response.json({
    review_item: { ...updatedItem, payload: JSON.parse(updatedItem.payload) },
    event: { ...updatedEvent, payload: JSON.parse(updatedEvent.payload) },
  });
}
