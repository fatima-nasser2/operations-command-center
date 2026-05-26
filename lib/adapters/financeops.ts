import type { IncomingEvent, AdapterResult } from '../types';

const REQUIRED_FIELDS = [
  'invoice_id',
  'customer_name',
  'amount',
  'currency',
  'days_overdue',
] as const;

export async function financeopsAdapter(event: IncomingEvent): Promise<AdapterResult> {
  const p = event.payload;

  for (const field of REQUIRED_FIELDS) {
    if (p[field] == null) {
      return { ok: false, reason: `Missing required field: ${field}` };
    }
  }

  const daysOverdue = p.days_overdue;
  if (typeof daysOverdue !== 'number') {
    return { ok: false, reason: 'Missing required field: days_overdue' };
  }

  const priority = daysOverdue > 14 ? 'high' : 'normal';

  return {
    ok: true,
    actions: [
      {
        type: 'send_payment_reminder',
        payload: {
          invoice_id: p.invoice_id,
          customer_name: p.customer_name,
          amount: p.amount,
          currency: p.currency,
          days_overdue: daysOverdue,
          priority,
        },
      },
      {
        type: 'create_follow_up_task',
        payload: {
          invoice_id: p.invoice_id,
          customer_name: p.customer_name,
          amount: p.amount,
          currency: p.currency,
          days_overdue: daysOverdue,
          priority,
        },
      },
    ],
  };
}
