import type { IncomingEvent, AdapterResult } from '../types';

const REQUIRED_FIELDS = ['reservation_id', 'guest_name', 'requested_check_in'] as const;

export async function guestopsAdapter(event: IncomingEvent): Promise<AdapterResult> {
  if (event.event_type !== 'reservation.change_requested') {
    return { ok: false, reason: `Unsupported event type for GuestOps: ${event.event_type}` };
  }

  const p = event.payload;

  for (const field of REQUIRED_FIELDS) {
    const value = p[field];
    if (value == null || (typeof value === 'string' && !value.trim())) {
      return { ok: false, reason: `Missing required field: ${field}` };
    }
  }

  const reservation_id = p.reservation_id as string;
  const guest_name = p.guest_name as string;
  const requested_check_in = p.requested_check_in as string;

  return {
    ok: true,
    actions: [
      {
        type: 'request_reservation_change',
        payload: {
          reservation_id,
          guest_name,
          requested_check_in,
        },
      },
      {
        type: 'generate_guest_message',
        payload: {
          reservation_id,
          guest_name,
          requested_check_in,
          message: `Dear ${guest_name}, we have received your request to change your check-in date to ${requested_check_in}. We will process this change and confirm with you shortly.`,
        },
      },
    ],
  };
}
