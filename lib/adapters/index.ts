import type { IncomingEvent, AdapterResult, Stream } from '../types';
import { financeopsAdapter } from './financeops';
import { campaignopsAdapter } from './campaignops';
import { guestopsAdapter } from './guestops';

type AdapterFn = (event: IncomingEvent) => Promise<AdapterResult>;

const registry: Record<Exclude<Stream, 'unknown'>, AdapterFn> = {
  financeops: financeopsAdapter,
  campaignops: campaignopsAdapter,
  guestops: guestopsAdapter,
};

export async function dispatch(
  stream: Exclude<Stream, 'unknown'>,
  event: IncomingEvent,
): Promise<AdapterResult> {
  return registry[stream](event);
}
