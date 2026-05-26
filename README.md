# Operations Command Center

A full-stack operations hub that ingests events from multiple business streams (FinanceOps, CampaignOps, GuestOps), runs them through a workflow engine, and routes ambiguous or failed events to a human review queue.

## Getting started

**Requirements:** Node.js 20+

**Development**
```bash
npm install
npm run dev
```

**Production**
```bash
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to the dashboard on first load. The SQLite database is created automatically at `data/app.db` on first run — no migration step needed.

## Running the tests

```bash
npm test
```

Six integration tests run against an in-memory SQLite database (no file system side effects). They test the full pipeline end-to-end: FinanceOps success, CampaignOps success, GuestOps success, duplicate prevention, missing-field review routing, and simulated service failure routing.

## Submitting sample events

### Via the simulator UI

Navigate to **Simulator** in the sidebar. Seven pre-loaded sample events cover every pipeline path — this is the fastest way to see the full workflow in action during a live review. Select one, inspect or edit the JSON, then click **Submit Event**. The result panel shows the HTTP status, generated actions, and a review reason if the event was routed to the queue.

### Via curl

```bash
# Valid FinanceOps event
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_event_id": "finance-001",
    "source": "financeops",
    "event_type": "invoice.overdue",
    "payload": {
      "invoice_id": "INV-9281",
      "customer_name": "Acme Trading",
      "amount": 4200,
      "currency": "USD",
      "days_overdue": 17
    }
  }'

# Ambiguous event — goes to review queue
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_event_id": "unknown-001",
    "source": "unknown",
    "event_type": "message.received",
    "payload": { "text": "Please move this to next Friday and tell the client it is confirmed." }
  }'
```

After submitting events, check the **Event Inbox** to browse all events with status filters, or open **Review Queue** to approve or reject anything that needs human judgment.

## Architecture

### Workflow engine (`lib/workflow.ts`)

Every inbound event passes through an 11-step synchronous pipeline:

1. **Validate** — checks that `source_event_id`, `source`, `event_type`, and `payload` are all present and correctly typed.
2. **Store as received** — inserts the event with status `received` using `INSERT OR IGNORE` on the unique `source_event_id` column. If a row already exists the pipeline exits early with a duplicate signal.
3. **Advance to processing** — updates status to `processing` and writes an audit log entry.
4. **Classify stream** — maps `source` to one of `financeops`, `campaignops`, `guestops`, or `unknown` (prefix-tolerant: `financeops.billing` still maps correctly).
5. **Unknown stream → review** — unrecognised sources are routed to the review queue immediately.
6. **Adapter dispatch** — calls the stream-specific adapter to validate domain fields and generate a list of typed actions.
7. **Adapter review signal → review** — if the adapter returns `ok: false` (e.g. a missing domain field), the event goes to the review queue with the adapter's reason.
8. **Mock service call** — passes the generated actions to the stream's mock service.
9. **Service failure → review** — if the mock service throws, the event is routed to the review queue with the error as the reason.
10. **Persist actions** — inserts each action as `completed` inside a transaction.
11. **Mark completed** — sets event status to `completed` and writes a final audit log entry.

Review routing is always atomic: a single `db.transaction()` call updates the event status to `review_required`, inserts a `review_queue_items` row with the reason, and writes an audit log entry. This means no event can be stuck in `processing` without a corresponding review item.

### Stream adapters (`lib/adapters/`)

Each adapter is a self-contained module that receives a validated `IncomingEvent` and returns either `{ ok: true, actions: Action[] }` or `{ ok: false, reason: string }`. Adapters enforce domain-specific rules:

- **FinanceOps** — requires `invoice_id`, `customer_name`, `amount`, `currency`, `days_overdue`. Generates `send_payment_reminder` and `create_follow_up_task`, both tagged `priority: high` when `days_overdue > 14`.
- **CampaignOps** — requires `client`, `campaign_goal`, `channels` (non-empty array), `deadline`. Generates one `create_campaign_task` per channel plus a `create_qa_task`.
- **GuestOps** — requires `reservation_id`, `guest_name`, `requested_check_in`. Generates `request_reservation_change` and `generate_guest_message`.

The adapter registry (`lib/adapters/index.ts`) uses a `Record<Exclude<Stream, 'unknown'>, AdapterFn>` type so adding a new stream without a corresponding adapter is a compile error.

### Review flow

When any pipeline step decides an event needs human oversight it calls `routeToReviewTx`, which atomically:
- sets `events.status = 'review_required'`
- inserts a row into `review_queue_items` with a plain-English reason
- writes an audit log entry

The Review Queue page loads pending items server-side and passes them to a client component. Reviewers can edit the actions JSON before approving (the edited actions replace the originals), or reject outright. Approval sets the event to `completed`; rejection sets it to `failed`. Both paths write an audit log entry.

### Persistence

**SQLite via `better-sqlite3`** — a single file at `data/app.db`. Four tables:

| Table | Purpose |
|---|---|
| `events` | One row per inbound event. `source_event_id` is `UNIQUE` for idempotency. |
| `actions` | Generated actions linked to an event. Inserted only after mock service confirms success. |
| `review_queue_items` | One row per event that entered the review flow, with the reason and resolution notes. |
| `audit_logs` | Append-only timeline of every status transition and action, linked to an event. |

SQLite was chosen over Postgres for zero-infrastructure setup: the database is a single file that appears on first run, the driver (`better-sqlite3`) is synchronous which removes async complexity from the pipeline, and the WAL journal mode gives adequate concurrent read performance for this use case.

## Honest tradeoffs

**No authentication.** Any visitor can submit events, approve review items, or reject actions. Adding auth (e.g. NextAuth with a simple provider) would be the first production concern.

**SQLite instead of Postgres.** SQLite is a single file — it cannot scale horizontally and concurrent writes are serialised by a process-level lock. For a real multi-instance deployment, swapping to Postgres (with Drizzle or Prisma) would be straightforward since all queries are plain SQL.

**No real-time updates.** The dashboard and inbox are point-in-time snapshots. If an event moves from `processing` to `completed` while you are looking at the inbox, you see the old status until you reload. Server-Sent Events or a polling `useInterval` would fix this without requiring a WebSocket server.

**Mock services only.** The three service modules log to the console and return immediately. There are no real HTTP calls, queues, or retries. A production version would replace each mock with an actual integration and add a retry/backoff strategy around step 9.

**No pagination.** The inbox and review queue load all rows. For large event volumes a keyset-paginated query would be needed.

## What I would build next

- **Authentication and role-based access** — operations staff who can review, and read-only observers who can only view the inbox.
- **Webhook ingestion endpoint** — a hardened `POST /api/ingest` with HMAC signature verification, so external systems can push events without the simulator.
- **Retry queue for service failures** — rather than routing every service exception to human review, implement exponential backoff with a dead-letter queue for events that exhaust retries.
- **Real-time inbox** — replace the full-page reload pattern with Server-Sent Events so status changes appear live.
- **Postgres + connection pooling** — swap SQLite for a hosted Postgres instance (e.g. Neon or Supabase) and use PgBouncer or the driver's built-in pool for multi-instance deployments.
- **Observability** — structured logging with a correlation ID per event, plus a metrics endpoint (`/api/metrics`) exposing queue depth and processing latency for alerting.
