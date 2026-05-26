import { db } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: number; source_event_id: string; source: string; event_type: string;
  status: string; payload: string; created_at: string; updated_at: string;
}
interface ActionRow { id: number; type: string; status: string; payload: string; created_at: string; }
interface ReviewItemRow { id: number; reason: string; status: string; resolved_at: string | null; }
interface AuditLogRow { id: number; message: string; metadata: string; created_at: string; }

const STATUS_STYLES: Record<string, string> = {
  completed:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  review_required: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  failed:          'bg-red-50 text-red-700 ring-1 ring-red-200',
  processing:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  received:        'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
};

const SOURCE_COLORS: Record<string, string> = {
  financeops:  'bg-violet-50 text-violet-700',
  campaignops: 'bg-cyan-50 text-cyan-700',
  guestops:    'bg-teal-50 text-teal-700',
};

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) notFound();

  const row = db.prepare(`SELECT * FROM events WHERE id = ?`).get(eventId) as EventRow | undefined;
  if (!row) notFound();

  const actions    = db.prepare(`SELECT * FROM actions WHERE event_id = ? ORDER BY created_at ASC`).all(eventId) as ActionRow[];
  const reviewItem = db.prepare(`SELECT * FROM review_queue_items WHERE event_id = ? LIMIT 1`).get(eventId) as ReviewItemRow | undefined;
  const auditLog   = db.prepare(`SELECT * FROM audit_logs WHERE event_id = ? ORDER BY created_at ASC`).all(eventId) as AuditLogRow[];

  return (
    <div>
      <div className="mb-5">
        <Link href="/inbox" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to inbox
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-1">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${SOURCE_COLORS[row.source] ?? 'bg-gray-100 text-gray-600'}`}>
          {row.source}
        </span>
        <h1 className="text-xl font-semibold text-gray-900">{row.event_type}</h1>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {row.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="flex gap-5 text-xs text-gray-400 mb-7 ml-0.5">
        <span className="font-mono">{row.source_event_id}</span>
        <span>·</span>
        <span>{new Date(row.created_at).toLocaleString()}</span>
      </div>

      {reviewItem && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Review Required</p>
            <p className="text-sm text-amber-700 mt-0.5">{reviewItem.reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Original Payload
          </div>
          <pre className="p-4 text-xs font-mono text-gray-700 bg-gray-50 rounded-b-xl overflow-auto max-h-72">
            {JSON.stringify(JSON.parse(row.payload), null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center justify-between">
            <span>Generated Actions</span>
            <span className="text-gray-400 font-normal normal-case text-xs">{actions.length} total</span>
          </div>
          <div className="p-4 space-y-3 overflow-auto max-h-72">
            {actions.length === 0 ? (
              <p className="text-sm text-gray-400">No actions generated</p>
            ) : (
              actions.map((a) => (
                <div key={a.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono font-semibold text-gray-800">{a.type}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded ring-1 ring-emerald-200">{a.status}</span>
                  </div>
                  <pre className="text-xs font-mono text-gray-500 overflow-auto">
                    {JSON.stringify(JSON.parse(a.payload), null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Audit Timeline
        </div>
        {auditLog.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">No audit entries</p>
        ) : (
          <div className="px-5 py-5 space-y-4">
            {auditLog.map((entry, i) => (
              <div key={entry.id} className="flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${i === auditLog.length - 1 ? 'bg-gray-400' : 'bg-indigo-400'}`} />
                  {i < auditLog.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1.5 mb-[-12px]" />}
                </div>
                <div className="pb-2">
                  <p className="text-sm text-gray-800">{entry.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
