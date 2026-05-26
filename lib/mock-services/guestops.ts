import type { Action, MockServiceResult } from '../types';

export async function guestopsService(
  actions: Action[],
  payload: Record<string, unknown>,
): Promise<MockServiceResult> {
  if (payload.simulate_failure === true) {
    throw new Error('[guestops] simulated service failure');
  }

  for (const action of actions) {
    console.log(`[guestops] executing ${action.type}`, action.payload);
  }

  return { ok: true };
}
