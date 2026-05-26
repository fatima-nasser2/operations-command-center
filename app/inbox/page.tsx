'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Filter, X } from 'lucide-react';

interface EventRecord {
  id: number;
  source_event_id: string;
  source: string;
  event_type: string;
  status: string;
  created_at: string;
}

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

const STATUSES = ['received', 'processing', 'completed', 'review_required', 'failed'];
const STREAMS  = ['financeops', 'campaignops', 'guestops'];

export default function InboxPage() {
  const [events, setEvents]   = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState('');
  const [stream, setStream]   = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (stream) params.set('source', stream);
    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => { setEvents(data.events ?? []); setLoading(false); });
  }, [status, stream]);

  const hasFilters = status || stream;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Event Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">All inbound events and their processing status</p>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Filter className="w-3.5 h-3.5" />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={stream}
          onChange={(e) => setStream(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="">All streams</option>
          {STREAMS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setStatus(''); setStream(''); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : events.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-400">No events match the current filters</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Event ID</th>
                <th className="px-5 py-3">Stream</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <Link href={`/events/${e.id}`} className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
                      {e.source_event_id}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${SOURCE_COLORS[e.source] ?? 'bg-gray-100 text-gray-600'}`}>
                      {e.source}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 font-medium">{e.event_type}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[e.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {e.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    {e.status === 'review_required'
                      ? <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200">Yes</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
