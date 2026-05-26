import { db } from '@/lib/db';
import ReviewQueue from './ReviewQueue';

export const dynamic = 'force-dynamic';

interface ReviewRow {
  id: number; event_id: number; reason: string; created_at: string;
  source_event_id: string; source: string; event_type: string; event_payload: string;
}
interface ActionRow { id: number; type: string; status: string; payload: string; created_at: string; }

export default async function ReviewPage() {
  const rows = db.prepare(`
    SELECT rq.id, rq.event_id, rq.reason, rq.created_at,
           e.source_event_id, e.source, e.event_type,
           e.payload AS event_payload
    FROM review_queue_items rq
    JOIN events e ON rq.event_id = e.id
    WHERE rq.status = 'pending'
    ORDER BY rq.created_at DESC
  `).all() as ReviewRow[];

  const items = rows.map((row) => {
    const actions = db.prepare(
      `SELECT * FROM actions WHERE event_id = ? ORDER BY created_at ASC`
    ).all(row.event_id) as ActionRow[];

    return {
      id: row.id,
      event_id: row.event_id,
      reason: row.reason,
      created_at: row.created_at,
      source_event_id: row.source_event_id,
      source: row.source,
      event_type: row.event_type,
      event_payload: JSON.parse(row.event_payload),
      actions: actions.map((a) => ({ ...a, payload: JSON.parse(a.payload) })),
    };
  });

  return (
    <div>
      <div className="mb-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Review Queue</h1>
            <p className="text-sm text-gray-500 mt-1">
              {items.length === 0
                ? 'No items pending review'
                : `${items.length} item${items.length !== 1 ? 's' : ''} awaiting review`}
            </p>
          </div>
          {items.length > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">
              {items.length} pending
            </span>
          )}
        </div>
      </div>
      <ReviewQueue initialItems={items} />
    </div>
  );
}
