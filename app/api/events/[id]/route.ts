import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: number; source_event_id: string; source: string; event_type: string;
  status: string; payload: string; created_at: string; updated_at: string;
}
interface ActionRow {
  id: number; event_id: number; type: string; status: string;
  payload: string; created_at: string;
}
interface ReviewQueueItemRow {
  id: number; event_id: number; status: string; reason: string;
  payload: string; resolved_at: string | null; created_at: string;
}
interface AuditLogRow {
  id: number; event_id: number; message: string; metadata: string; created_at: string;
}

const selectEvent = db.prepare(`SELECT * FROM events WHERE id = ?`);
const selectActions = db.prepare(`SELECT * FROM actions WHERE event_id = ? ORDER BY created_at ASC`);
const selectReviewItem = db.prepare(`SELECT * FROM review_queue_items WHERE event_id = ? LIMIT 1`);
const selectAuditLog = db.prepare(`SELECT * FROM audit_logs WHERE event_id = ? ORDER BY created_at ASC`);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const eventId = Number(id);

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  const eventRow = selectEvent.get(eventId) as EventRow | undefined;
  if (!eventRow) {
    return Response.json({ error: 'Event not found' }, { status: 404 });
  }

  const actions = (selectActions.all(eventId) as ActionRow[]).map((r) => ({
    ...r, payload: JSON.parse(r.payload),
  }));

  const reviewItemRow = selectReviewItem.get(eventId) as ReviewQueueItemRow | undefined;
  const review_item = reviewItemRow
    ? { ...reviewItemRow, payload: JSON.parse(reviewItemRow.payload) }
    : null;

  const audit_log = (selectAuditLog.all(eventId) as AuditLogRow[]).map((r) => ({
    ...r, metadata: JSON.parse(r.metadata),
  }));

  return Response.json({
    event: { ...eventRow, payload: JSON.parse(eventRow.payload) },
    actions,
    review_item,
    audit_log,
  });
}
