export interface IncomingEvent {
  source_event_id: string;
  source: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface Action {
  type: string;
  payload: Record<string, unknown>;
}

export type Stream = 'financeops' | 'campaignops' | 'guestops' | 'unknown';

export type AdapterResult =
  | { ok: true; actions: Action[] }
  | { ok: false; reason: string };

export type MockServiceResult =
  | { ok: true }
  | { ok: false; reason: string };
