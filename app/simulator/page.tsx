'use client';

import { useState } from 'react';
import { ChevronRight, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

const SAMPLES = [
  {
    label: 'FinanceOps — invoice.overdue',
    tag: 'financeops',
    body: {
      source_event_id: 'finance-001',
      source: 'financeops',
      event_type: 'invoice.overdue',
      payload: { invoice_id: 'INV-9281', customer_name: 'Acme Trading', amount: 4200, currency: 'USD', days_overdue: 17 },
    },
  },
  {
    label: 'CampaignOps — client_brief.received',
    tag: 'campaignops',
    body: {
      source_event_id: 'campaign-001',
      source: 'campaignops',
      event_type: 'client_brief.received',
      payload: { client: 'Luna Cafe', campaign_goal: 'Launch Ramadan catering offer', channels: ['instagram', 'email', 'landing_page'], deadline: '2026-06-10' },
    },
  },
  {
    label: 'GuestOps — reservation.change_requested',
    tag: 'guestops',
    body: {
      source_event_id: 'guest-001',
      source: 'guestops',
      event_type: 'reservation.change_requested',
      payload: { reservation_id: 'RES-7729', guest_name: 'Maya Haddad', current_check_in: '2026-06-04', requested_check_in: '2026-06-06', nights: 3 },
    },
  },
  {
    label: 'Ambiguous — should go to review',
    tag: 'unknown',
    body: {
      source_event_id: 'unknown-001',
      source: 'unknown',
      event_type: 'message.received',
      payload: { text: 'Please move this to next Friday and tell the client it is confirmed.' },
    },
  },
  {
    label: 'Missing required field — should go to review',
    tag: 'review',
    body: {
      source_event_id: 'finance-002',
      source: 'financeops',
      event_type: 'invoice.overdue',
      payload: { customer_name: 'Acme Trading', amount: 4200, currency: 'USD', days_overdue: 17 },
    },
  },
  {
    label: 'Duplicate — submit sample 1 first, then this',
    tag: 'duplicate',
    body: {
      source_event_id: 'finance-001',
      source: 'financeops',
      event_type: 'invoice.overdue',
      payload: { invoice_id: 'INV-9281', customer_name: 'Acme Trading', amount: 4200, currency: 'USD', days_overdue: 17 },
    },
  },
  {
    label: 'Simulated failure — should not be completed',
    tag: 'failure',
    body: {
      source_event_id: 'campaign-002',
      source: 'campaignops',
      event_type: 'client_brief.received',
      payload: { client: 'Luna Cafe', campaign_goal: 'Launch Ramadan catering offer', channels: ['instagram'], deadline: '2026-06-10', simulate_failure: true },
    },
  },
];

const TAG_COLORS: Record<string, string> = {
  financeops:  'bg-violet-50 text-violet-700',
  campaignops: 'bg-cyan-50 text-cyan-700',
  guestops:    'bg-teal-50 text-teal-700',
  unknown:     'bg-gray-100 text-gray-600',
  review:      'bg-amber-50 text-amber-700',
  duplicate:   'bg-orange-50 text-orange-700',
  failure:     'bg-red-50 text-red-600',
};

interface ApiResult {
  event?: { id: number; status: string };
  actions?: Array<{ type: string }>;
  review_reason?: string | null;
  error?: string;
  details?: string[];
}

export default function SimulatorPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [json, setJson]       = useState(() => JSON.stringify(SAMPLES[0].body, null, 2));
  const [jsonError, setJsonError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ApiResult | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const handleSelect = (i: number) => {
    setSelectedIndex(i);
    setResult(null);
    setStatusCode(null);
    setJsonError('');
    setJson(JSON.stringify(SAMPLES[i].body, null, 2));
  };

  const handleSubmit = async () => {
    setJsonError('');
    setResult(null);
    setStatusCode(null);
    let body: unknown;
    try { body = JSON.parse(json); } catch { setJsonError('Invalid JSON — fix before submitting'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setStatusCode(res.status);
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const ok = statusCode !== null && statusCode < 300;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-semibold text-gray-900">Event Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Submit sample events to test the workflow pipeline</p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-2 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Sample Events</p>
          {SAMPLES.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full text-left px-3.5 py-3 rounded-lg border text-sm transition-all flex items-center justify-between group ${
                selectedIndex === i
                  ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded mb-1 inline-block ${TAG_COLORS[s.tag]}`}>
                  {s.tag}
                </span>
                <p className={`text-sm leading-snug ${selectedIndex === i ? 'text-indigo-800 font-medium' : 'text-gray-700'}`}>
                  {s.label.split(' — ')[1] ?? s.label}
                </p>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ml-2 transition-opacity ${selectedIndex === i ? 'text-indigo-400 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`} />
            </button>
          ))}
        </div>

        <div className="col-span-3 flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Payload JSON</p>
            <textarea
              value={json}
              onChange={(e) => { setJson(e.target.value); setJsonError(''); }}
              className="w-full h-64 font-mono text-xs text-gray-900 border border-gray-200 rounded-xl p-4 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              placeholder="Select a sample event, or paste raw JSON here…"
              spellCheck={false}
            />
            {jsonError && <p className="text-xs text-red-600 mt-1.5">{jsonError}</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!json.trim() || loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors self-start shadow-sm"
          >
            <Zap className="w-4 h-4" />
            {loading ? 'Submitting…' : 'Submit Event'}
          </button>

          {result !== null && (
            <div className={`rounded-xl border p-5 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-center gap-2.5 mb-4">
                {ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  : <AlertTriangle className="w-4 h-4 text-red-500" />
                }
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${ok ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                  {statusCode}
                </span>
                <span className="text-sm font-medium text-gray-800">{ok ? 'Event processed' : 'Error'}</span>
              </div>

              {result.error && <p className="text-sm text-red-700 mb-3">{result.error}</p>}
              {result.details && (
                <ul className="text-xs text-red-600 list-disc ml-4 mb-3 space-y-0.5">
                  {result.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}

              {result.event?.status === 'review_required' && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-semibold text-amber-800">Sent to review queue</p>
                  {result.review_reason && (
                    <p className="text-xs text-amber-700 mt-0.5">Reason: {result.review_reason}</p>
                  )}
                </div>
              )}

              {result.event && result.event.status !== 'review_required' && (
                <p className="text-sm text-gray-700 mb-3">
                  Status: <span className="font-semibold">{result.event.status.replace(/_/g, ' ')}</span>
                </p>
              )}

              {result.actions && result.actions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">{result.actions.length} action{result.actions.length !== 1 ? 's' : ''} generated</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.actions.map((a, i) => (
                      <span key={i} className="text-xs font-mono bg-white border border-gray-200 rounded-md px-2.5 py-1 text-gray-700">
                        {a.type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
