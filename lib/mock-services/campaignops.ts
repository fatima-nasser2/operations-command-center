import type { Action, MockServiceResult } from '../types';

export async function campaignopsService(
  actions: Action[],
  payload: Record<string, unknown>,
): Promise<MockServiceResult> {
  if (payload.simulate_failure === true) {
    throw new Error('[campaignops] simulated service failure');
  }

  for (const action of actions) {
    console.log(`[campaignops] executing ${action.type}`, action.payload);
  }

  return { ok: true };
}
