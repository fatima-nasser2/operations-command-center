import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { processEvent } from '../workflow';

interface EventRow { id: number; status: string }
interface ActionRow { id: number; type: string; payload: string }
interface ReviewItemRow { id: number; reason: string }
interface AuditLogRow { id: number; message: string; metadata: string }

function getEvent(id: number) {
  return db.prepare('SELECT id, status FROM events WHERE id = ?').get(id) as EventRow | undefined;
}
function getActions(eventId: number) {
  return db.prepare('SELECT id, type, payload FROM actions WHERE event_id = ?').all(eventId) as ActionRow[];
}
function getReviewItem(eventId: number) {
  return db.prepare('SELECT id, reason FROM review_queue_items WHERE event_id = ?').get(eventId) as ReviewItemRow | undefined;
}
function getAuditLogs(eventId: number) {
  return db.prepare('SELECT id, message, metadata FROM audit_logs WHERE event_id = ?').all(eventId) as AuditLogRow[];
}

beforeEach(() => {
  db.exec('DELETE FROM audit_logs');
  db.exec('DELETE FROM review_queue_items');
  db.exec('DELETE FROM actions');
  db.exec('DELETE FROM events');
});

describe('workflow pipeline', () => {
  it('FinanceOps success — completed, two actions, both high priority', async () => {
    const result = await processEvent({
      source_event_id: 'finance-001',
      source: 'financeops',
      event_type: 'invoice.overdue',
      payload: { invoice_id: 'INV-9281', customer_name: 'Acme Trading', amount: 4200, currency: 'USD', days_overdue: 17 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duplicate).toBe(false);

    expect(getEvent(result.eventId)?.status).toBe('completed');

    const actions = getActions(result.eventId);
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect((JSON.parse(action.payload) as { priority: string }).priority).toBe('high');
    }
  });

  it('CampaignOps success — completed, at least three actions for three channels', async () => {
    const result = await processEvent({
      source_event_id: 'campaign-001',
      source: 'campaignops',
      event_type: 'client_brief.received',
      payload: { client: 'Luna Cafe', campaign_goal: 'Launch Ramadan catering offer', channels: ['instagram', 'email', 'landing_page'], deadline: '2026-06-10' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duplicate).toBe(false);

    expect(getEvent(result.eventId)?.status).toBe('completed');
    expect(getActions(result.eventId).length).toBeGreaterThanOrEqual(3);
  });

  it('GuestOps success — completed, includes request_reservation_change and generate_guest_message', async () => {
    const result = await processEvent({
      source_event_id: 'guest-001',
      source: 'guestops',
      event_type: 'reservation.change_requested',
      payload: { reservation_id: 'RES-7729', guest_name: 'Maya Haddad', current_check_in: '2026-06-04', requested_check_in: '2026-06-06', nights: 3 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getEvent(result.eventId)?.status).toBe('completed');

    const types = getActions(result.eventId).map((a) => a.type);
    expect(types).toContain('request_reservation_change');
    expect(types).toContain('generate_guest_message');
  });

  it('duplicate prevention — second submission returns duplicate flag, only one event in DB', async () => {
    const payload = {
      source_event_id: 'finance-dup',
      source: 'financeops',
      event_type: 'invoice.overdue',
      payload: { invoice_id: 'INV-DUP', customer_name: 'Dup Corp', amount: 1000, currency: 'USD', days_overdue: 5 },
    };

    const first = await processEvent(payload);
    const second = await processEvent(payload);

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.duplicate).toBe(false);

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.duplicate).toBe(true);

    const { n } = db.prepare('SELECT COUNT(*) as n FROM events').get() as { n: number };
    expect(n).toBe(1);
  });

  it('missing field goes to review — review_required, review item reason names invoice_id', async () => {
    const result = await processEvent({
      source_event_id: 'finance-002',
      source: 'financeops',
      event_type: 'invoice.overdue',
      payload: { customer_name: 'Acme Trading', amount: 4200, currency: 'USD', days_overdue: 17 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getEvent(result.eventId)?.status).toBe('review_required');

    const reviewItem = getReviewItem(result.eventId);
    expect(reviewItem).toBeDefined();
    expect(reviewItem!.reason.toLowerCase()).toContain('invoice_id');
  });

  it('simulated failure goes to review — review_required, not completed, audit log records failure reason', async () => {
    const result = await processEvent({
      source_event_id: 'campaign-002',
      source: 'campaignops',
      event_type: 'client_brief.received',
      payload: { client: 'Luna Cafe', campaign_goal: 'Launch Ramadan catering offer', channels: ['instagram'], deadline: '2026-06-10', simulate_failure: true },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const event = getEvent(result.eventId);
    expect(event?.status).toBe('review_required');
    expect(event?.status).not.toBe('completed');

    const auditLogs = getAuditLogs(result.eventId);
    const hasFailureEntry = auditLogs.some((log) => {
      const meta = JSON.parse(log.metadata) as { reason?: string };
      return meta.reason?.toLowerCase().includes('fail') || log.message.toLowerCase().includes('fail');
    });
    expect(hasFailureEntry).toBe(true);
  });
});
