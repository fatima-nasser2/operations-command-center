import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: number; source_event_id: string; source: string; event_type: string;
  status: string; payload: string; created_at: string; updated_at: string;
}

interface CountsRow {
  total: number;
  completed: number;
  review_required: number;
  failed: number;
}

const selectCounts = db.prepare(`
  SELECT
    COUNT(*)                                                    AS total,
    SUM(CASE WHEN status = 'completed'       THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN status = 'review_required' THEN 1 ELSE 0 END) AS review_required,
    SUM(CASE WHEN status = 'failed'          THEN 1 ELSE 0 END) AS failed
  FROM events
`);

const selectRecentEvents = db.prepare(`
  SELECT * FROM events ORDER BY created_at DESC LIMIT 10
`);

export async function GET() {
  const counts = selectCounts.get() as CountsRow;
  const recent_events = (selectRecentEvents.all() as EventRow[]).map((r) => ({
    ...r, payload: JSON.parse(r.payload),
  }));

  return Response.json({ counts, recent_events });
}
