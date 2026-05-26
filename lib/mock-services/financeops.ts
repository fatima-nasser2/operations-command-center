import type { Action, MockServiceResult } from '../types';

export async function financeopsService(
  actions: Action[],
  payload: Record<string, unknown>,
): Promise<MockServiceResult> {
  if (payload.simulate_failure === true) {
    throw new Error('[financeops] simulated service failure');
  }

  for (const action of actions) {
    console.log(`[financeops] executing ${action.type}`, action.payload);
  }

  return { ok: true };
}
