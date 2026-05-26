import type { Action, MockServiceResult, Stream } from '../types';
import { financeopsService } from './financeops';
import { campaignopsService } from './campaignops';
import { guestopsService } from './guestops';

type MockServiceFn = (
  actions: Action[],
  payload: Record<string, unknown>,
) => Promise<MockServiceResult>;

const registry: Record<Exclude<Stream, 'unknown'>, MockServiceFn> = {
  financeops: financeopsService,
  campaignops: campaignopsService,
  guestops: guestopsService,
};

export async function executeMockService(
  stream: Exclude<Stream, 'unknown'>,
  actions: Action[],
  payload: Record<string, unknown>,
): Promise<MockServiceResult> {
  return registry[stream](actions, payload);
}
