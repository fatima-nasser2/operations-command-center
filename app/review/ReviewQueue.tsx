'use client';

import { useState } from 'react';
import { AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface Action {
  id: number;
  type: string;
  status: string;
  payload: Record<string, unknown>;
}

interface ReviewItemData {
  id: number;
  event_id: number;
  reason: string;
  created_at: string;
  source_event_id: string;
  source: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  actions: Action[];
}

const SOURCE_COLORS: Record<string, string> = {
  financeops:  'bg-violet-50 text-violet-700',
  campaignops: 'bg-cyan-50 text-cyan-700',
  guestops:    'bg-teal-50 text-teal-700',
};

function ReviewItem({ item, onResolved }: { item: ReviewItemData; onResolved: (id: number) => void }) {
  const [notes, setNotes]             = useState('');
  const [actionsJson, setActionsJson] = useState(JSON.stringify(item.actions, null, 2));
  const [actionsError, setActionsError] = useState('');
  const [loading, setLoading]         = useState<'approve' | 'reject' | null>(null);
  const [error, setError]             = useState('');
  const [payloadOpen, setPayloadOpen] = useState(false);

  const resolve = async (action: 'approve' | 'reject') => {
    setActionsError('');
    setError('');
    let editedActions: Action[] | undefined;

    if (action === 'approve' && actionsJson.trim()) {
      try { editedActions = JSON.parse(actionsJson); } catch {
        setActionsError('Actions field contains invalid JSON');
        return;
      }
    }

    setLoading(action);
    try {
      const res = await fetch(`/api/review/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes.trim() || undefined, edited_actions: editedActions }),
      });
      if (res.ok) { onResolved(item.id); }
      else { const d = await res.json(); setError(d.error ?? 'Request failed'); }
    } catch { setError('Network error'); }
    finally { setLoading(null); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${SOURCE_COLORS[item.source] ?? 'bg-gray-100 text-gray-600'}`}>
              {item.source}
            </span>
            <span className="text-sm font-semibold text-gray-900">{item.event_type}</span>
            <span className="text-xs font-mono text-gray-400">{item.source_event_id}</span>
          </div>
          <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-xs font-medium text-amber-800">Review reason:</span>
          <span className="text-xs text-amber-700">{item.reason}</span>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-gray-100">
        <button
          onClick={() => setPayloadOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors mb-2"
        >
          {payloadOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Original payload
        </button>
        {payloadOpen && (
          <pre className="text-xs font-mono text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-auto max-h-40">
            {JSON.stringify(item.event_payload, null, 2)}
          </pre>
        )}
      </div>

      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-500 mb-2">Generated actions <span className="text-gray-400 font-normal">(edit before approving)</span></p>
        <textarea
          value={actionsJson}
          onChange={(e) => { setActionsJson(e.target.value); setActionsError(''); }}
          className="w-full text-xs text-gray-900 font-mono bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none h-40 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          spellCheck={false}
        />
        {actionsError && <p className="text-xs text-red-600 mt-1">{actionsError}</p>}
      </div>

      <div className="px-5 py-4 flex items-center gap-3">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Resolution notes (optional)"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
        <button
          onClick={() => resolve('approve')}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {loading === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          onClick={() => resolve('reject')}
          disabled={loading !== null}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
      {error && <p className="px-5 pb-4 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function ReviewQueue({ initialItems }: { initialItems: ReviewItemData[] }) {
  const [items, setItems] = useState(initialItems);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-16 text-center">
        <Check className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700">All caught up</p>
        <p className="text-xs text-gray-400 mt-1">No items pending review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ReviewItem
          key={item.id}
          item={item}
          onResolved={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
        />
      ))}
    </div>
  );
}
