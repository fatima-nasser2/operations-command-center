import { db } from '@/lib/db';
import Link from 'next/link';
import { CheckCircle2, Clock, XCircle, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface EventRow {
  id: number;
  source_event_id: string;
  source: string;
  event_type: string;
  status: string;
  created_at: string;
}

interface Counts {
  total: number;
  completed: number;
  review_required: number;
  failed: number;
}

const STATUS_STYLES: Record<string, string> = {
  completed:       'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  review_required: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  failed:          'bg-red-50 text-red-700 ring-1 ring-red-200',
  processing:      'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  received:        'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
};

const SOURCE_COLORS: Record<string, string> = {
  financeops:   'bg-violet-50 text-violet-700',
  campaignops:  'bg-cyan-50 text-cyan-700',
  guestops:     'bg-teal-50 text-teal-700',
};

export default async function DashboardPage() {
  const counts = db.prepare(`
    SELECT
      COUNT(*)                                                    AS total,
      SUM(CASE WHEN status = 'completed'       THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'review_required' THEN 1 ELSE 0 END) AS review_required,
      SUM(CASE WHEN status = 'failed'          THEN 1 ELSE 0 END) AS failed
    FROM events
  `).get() as Counts;

  const recent = db.prepare(`
    SELECT id, source_event_id, source, event_type, status, created_at
    FROM events ORDER BY created_at DESC LIMIT 10
  `).all() as EventRow[];

  const stats = [
    {
      label: 'Total Events',
      value: counts.total ?? 0,
      Icon: Activity,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      valueColor: 'text-gray-900',
    },
    {
      label: 'Completed',
      value: counts.completed ?? 0,
      Icon: CheckCircle2,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'Review Required',
      value: counts.review_required ?? 0,
      Icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
    },
    {
      label: 'Failed',
      value: counts.failed ?? 0,
      Icon: XCircle,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      valueColor: 'text-red-600',
    },
  ];

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Live overview of your event pipeline</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-7">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                <s.Icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${s.valueColor}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
          <Link href="/inbox" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">No events yet — submit one from the Simulator</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${SOURCE_COLORS[e.source] ?? 'bg-gray-100 text-gray-600'}`}>
                    {e.source}
                  </span>
                  <span className="text-sm text-gray-800 font-medium truncate">{e.event_type}</span>
                  <span className="text-xs font-mono text-gray-400 truncate hidden sm:block">{e.source_event_id}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[e.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {e.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-400 w-32 text-right">{new Date(e.created_at).toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
