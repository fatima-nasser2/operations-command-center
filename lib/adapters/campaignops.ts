import type { IncomingEvent, AdapterResult, Action } from '../types';

const REQUIRED_SCALAR_FIELDS = ['client', 'campaign_goal', 'deadline'] as const;

function formatChannel(channel: string): string {
  const spaced = channel.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function campaignopsAdapter(event: IncomingEvent): Promise<AdapterResult> {
  const p = event.payload;

  for (const field of REQUIRED_SCALAR_FIELDS) {
    if (p[field] == null) {
      return { ok: false, reason: `Missing required field: ${field}` };
    }
  }

  if (p.channels == null) {
    return { ok: false, reason: 'Missing required field: channels' };
  }
  if (!Array.isArray(p.channels) || p.channels.length === 0) {
    return { ok: false, reason: 'Missing required field: channels' };
  }

  const client = p.client as string;
  const campaign_goal = p.campaign_goal as string;
  const deadline = p.deadline as string;
  const channels = p.channels as string[];

  const actions: Action[] = channels.map((channel) => ({
    type: 'create_campaign_task',
    payload: {
      title: `${formatChannel(channel)} creative brief for ${client}`,
      client,
      campaign_goal,
      channel,
      deadline,
    },
  }));

  actions.push({
    type: 'create_qa_task',
    payload: {
      title: `QA review for ${client} campaign`,
      client,
      campaign_goal,
      deadline,
    },
  });

  return { ok: true, actions };
}
