# BuiltCRM — Integration Architecture Spec

**Session 18 · April 13, 2026**
**Status:** Planning document — defines integration strategy, data mapping, sync patterns, and tier gating for all external integrations.

---

## 1. Integration Philosophy

BuiltCRM's integration strategy follows three principles:

1. **BuiltCRM is the system of record for construction workflows.** External tools receive data from BuiltCRM — they don't drive it. Accounting software gets invoices pushed to it; it doesn't own the billing workflow. This means sync direction matters: BuiltCRM is authoritative for project data, and external systems are authoritative for their domain (e.g., GL balances, bank transaction confirmations).

2. **Integrations are connectors, not features.** The product must work fully without any integration enabled. QuickBooks sync is a convenience that eliminates double-entry — it's never a prerequisite for submitting a draw or tracking compliance. Every integration has a graceful "off" state.

3. **Tier-gated access with clear upgrade paths.** Starter plans get CSV export. Professional plans get accounting + payment integrations. Enterprise plans get webhook API access, custom integrations, and migration tooling. This aligns with the pricing page promise and the deep research report's monetization guidance.

---

## 2. Integration Categories

| Category | Tools | Sync Direction | Plan Tier |
|---|---|---|---|
| Accounting | QuickBooks Online, Xero, Sage Business Cloud | Bidirectional (push invoices, pull payment status) | Professional+ |
| Payment Processing | Stripe (ACH + card) | Bidirectional (create charges, receive webhooks) | Professional+ |
| Email Bridging | SendGrid / Postmark + inbound parse | Outbound notifications + reply-by-email inbound | All tiers |
| Calendar Sync | Google Calendar, Outlook/365 | Push milestones + inspections as calendar events | Professional+ |
| PM Tool Migration | Procore, Buildertrend, CSV/Excel | One-time inbound import | Enterprise (assisted) / Professional (CSV) |
| Webhook API | Custom outbound webhooks | Outbound event stream | Enterprise |
| Document Storage | R2 (native), Google Drive, Dropbox | Bidirectional file sync | V2 deferred |
| SSO/SAML | Okta, Azure AD, Google Workspace | Auth delegation | Enterprise |

---

## 3. Accounting Integrations (QuickBooks Online, Xero, Sage)

### 3.1 Why This Matters

The deep research report identified accounting integration as a minimum-viable integration for PMF. Construction firms universally use accounting software, and the #1 complaint about PM tools is re-keying billing data into QuickBooks. BuiltCRM's AIA billing engine (G702/G703) generates exactly the data accountants need — the integration just needs to get it there.

### 3.2 Connection Flow

```
Contractor Settings → Integrations → "Connect QuickBooks"
  → OAuth 2.0 redirect to Intuit/Xero/Sage
  → Authorization grant
  → Token exchange + storage (encrypted at rest)
  → Initial mapping wizard:
      1. Match BuiltCRM projects → QB customers/jobs
      2. Match SOV cost codes → QB chart of accounts
      3. Set default income/expense accounts
      4. Choose sync frequency (real-time on action vs daily batch)
  → Connection confirmed, sync begins
```

### 3.3 Data Mapping

#### BuiltCRM → Accounting (push on draw approval)

| BuiltCRM Entity | Accounting Entity | Mapping Notes |
|---|---|---|
| Project | Customer / Job | One project = one customer job in QB. Created on first sync if not mapped. |
| SOV Line Item | Item / Service | Cost code maps to chart of accounts line. Description carries over. |
| Draw Request (approved) | Invoice | G702 header → invoice header. Draw number → invoice number prefix (e.g., "BUILT-DR005"). |
| Draw Line Item | Invoice Line Item | Each SOV line with this-period work > 0 becomes an invoice line. Amount = work this period + materials stored. |
| Retainage held | Journal Entry or separate line | Retainage is tracked as a liability. On release, a reversing entry is created. |
| Change Order (approved) | Journal Entry or estimate revision | Net change to contract value posted to the job's budget. |
| Lien Waiver | Attached document on payment record | PDF attachment, not a transactional record in accounting. |

#### Accounting → BuiltCRM (pull on schedule or webhook)

| Accounting Entity | BuiltCRM Entity | Mapping Notes |
|---|---|---|
| Payment received (against invoice) | Draw Request → status `paid` | When QB marks invoice as paid, update draw status. Triggers unconditional lien waiver request. |
| Payment amount | Payment transaction record | Store the confirmed amount, date, method, and reference number. |
| Void / credit memo | Draw Request flag | Flag the draw as having a payment issue. Alert the contractor. |

### 3.4 Sync Patterns

**Primary pattern: Event-driven push + scheduled reconciliation**

- **Push (real-time):** When a draw request is approved in BuiltCRM, a Trigger.dev job fires that creates/updates the corresponding invoice in the accounting system. This is the "happy path" — the contractor approves a draw and the invoice appears in QuickBooks within seconds.
- **Pull (scheduled):** A daily reconciliation job checks all open invoices in the accounting system for payment status changes. This catches payments recorded directly in QB, manual adjustments, and any push failures.
- **Webhook (where available):** QuickBooks Online supports webhooks for payment events. When available, we subscribe to `payment.created` and `payment.updated` events to get near-real-time payment status without polling.

**Conflict resolution:** BuiltCRM wins on billing data (amounts, line items, descriptions). Accounting wins on payment data (paid/unpaid, payment method, GL posting). If a conflict is detected during reconciliation, the sync event is flagged for manual review and the contractor gets a notification.

### 3.5 Error Handling

| Failure Mode | Handling |
|---|---|
| OAuth token expired | Auto-refresh using refresh token. If refresh fails, mark connection as `needs_reauth` and notify contractor. |
| Rate limit hit | Exponential backoff with jitter. Queue retries via Trigger.dev. Max 5 retries over 24h. |
| Mapping mismatch (e.g., deleted QB customer) | Flag sync event as `mapping_error`. Show in integration dashboard with remediation action ("Re-map project X"). |
| Partial sync failure (some lines synced, others failed) | Roll back the entire invoice creation. Never leave partial state in accounting. Retry full push. |
| Accounting system unavailable | Queue the sync event. Retry on exponential schedule. After 24h of failures, alert the contractor. |
| Duplicate detection | Use idempotency keys (BuiltCRM draw request ID) to prevent duplicate invoices. Check before creating. |

### 3.6 Provider-Specific Notes

**QuickBooks Online (priority — largest market share in SMB construction)**
- OAuth 2.0 via Intuit Developer Platform
- REST API with JSON payloads
- Webhook support for payment events
- Rate limit: 500 requests/minute per realm
- Entity: Invoice, Payment, Customer, Item, JournalEntry
- Canadian-specific: GST/HST/PST tax handling, CAD currency

**Xero**
- OAuth 2.0 with mandatory token refresh every 30 minutes
- REST API, well-documented
- Webhooks available for invoice and payment events
- Rate limit: 60 requests/minute per tenant
- Entity: Invoice, Payment, Contact, Account, ManualJournal
- Strong in Canadian/Australian markets

**Sage Business Cloud**
- OAuth 2.0
- REST API but less mature than QB/Xero
- Limited webhook support — heavier reliance on polling
- Rate limit: varies by endpoint (typically 100/min)
- Entity: SalesInvoice, Payment, Contact, LedgerAccount
- Common in mid-market Canadian construction

---

## 4. Payment Processing (Stripe)

### 4.1 Why Stripe

Stripe handles both ACH (for large draw payments, low fees) and card payments (for smaller transactions like selection upgrade deposits). Stripe Connect enables the marketplace model where BuiltCRM facilitates payments between clients and contractors without holding funds.

### 4.2 Architecture: Stripe Connect (Platform)

```
BuiltCRM (Platform Account)
  ├── Contractor Org A (Connected Account — Standard)
  │     ├── Project 1 → Client pays → funds route to Contractor A
  │     └── Project 2 → Client pays → funds route to Contractor A
  └── Contractor Org B (Connected Account — Standard)
        └── Project 3 → Client pays → funds route to Contractor B
```

**Standard Connect accounts** — contractors onboard through Stripe's hosted flow, manage their own payouts, and handle their own tax reporting. BuiltCRM creates payment intents on behalf of the connected account. This minimizes BuiltCRM's regulatory burden.

### 4.3 Payment Flows

#### Flow A: Draw Payment (ACH — typical for commercial)

```
1. Draw Request approved by client in BuiltCRM
2. Client clicks "Pay Now" on billing review page
3. BuiltCRM creates Stripe PaymentIntent:
   - amount: approved draw amount (minus retainage held)
   - payment_method_types: ['us_bank_account'] (ACH)
   - on_behalf_of: contractor's connected account
   - transfer_data.destination: contractor's connected account
   - metadata: { draw_request_id, project_id, draw_number }
4. Client completes ACH authorization (Stripe hosted UI or Elements)
5. ACH initiates (3-5 business day settlement)
6. Stripe webhook: payment_intent.succeeded
7. BuiltCRM updates draw_request.status → 'paid'
8. BuiltCRM creates payment_transaction record
9. Trigger.dev job: request unconditional lien waivers from subs
10. If accounting connected: push payment record to QB/Xero
```

#### Flow B: Selection Upgrade Payment (Card — typical for residential)

```
1. Homeowner confirms selection with upgrade cost (+$2,400)
2. Selection decision marked as confirmed
3. Contractor can choose: invoice now or batch with next draw
4. If "invoice now":
   - BuiltCRM creates PaymentIntent for upgrade amount
   - Card payment via Stripe Elements
   - Instant confirmation
5. Payment recorded against selection decision
```

#### Flow C: Retainage Release Payment

```
1. Retainage release approved in BuiltCRM
2. PaymentIntent created for release amount
3. Same ACH flow as draw payment
4. retainage_releases.release_status → 'released'
```

### 4.4 Fee Structure

| Method | Stripe Fee | Who Pays | Notes |
|---|---|---|---|
| ACH (bank transfer) | 0.8%, capped at $5 | Configurable (client or contractor) | Best for draw payments ($10k–$500k range). $5 cap makes this very efficient for large draws. |
| Card | 2.9% + $0.30 | Configurable | Only practical for smaller amounts (selections, deposits). |
| Instant payout (to contractor) | 1% of payout, min $0.50 | Contractor | Optional — contractor can choose standard (2-day) payout for free. |

**BuiltCRM platform fee:** Optional percentage on each transaction. Configurable per plan tier. This is a potential revenue stream but should be 0% at launch to reduce adoption friction. Can introduce later as "payment processing convenience fee" on higher tiers.

### 4.5 Stripe Onboarding (Contractor)

```
Contractor Settings → Payments → "Connect with Stripe"
  → Stripe Connect onboarding (hosted by Stripe)
  → KYC/identity verification handled entirely by Stripe
  → Business details, bank account for payouts
  → Return to BuiltCRM with connected account ID
  → Connection stored in integration_connections table
  → Contractor can now receive payments through BuiltCRM
```

### 4.6 Client Payment Setup

Clients don't need a Stripe account. They pay as guests using:
- **ACH:** Stripe's Financial Connections flow (bank account linking) or manual entry
- **Card:** Standard Stripe Elements card input

Payment methods can be saved for recurring draw payments (with explicit consent). Stored in Stripe — BuiltCRM only holds the Stripe payment method ID, never raw bank/card details.

---

## 5. Email Bridging

### 5.1 Outbound Notifications

Every in-app event that generates a notification also sends an email. The email includes enough context to act without opening the app, plus a deep link back to the relevant page.

**Provider:** Postmark (or SendGrid). Transactional email with high deliverability.

**Email types:**
- Conversation message received → email with message preview + "Reply" link
- RFI assigned / response needed → email with RFI summary + action button
- Draw request submitted / approved / returned → email with amount + status
- Approval requested → email with item summary + approve/reject buttons (one-click via signed URL)
- Compliance expiring → email with expiry date + upload link
- Upload request created → email with requirements + upload link
- Selection published → email with selection preview + browse link
- Milestone approaching → email with countdown + schedule link

**Sender identity:** `notifications@builtcrm.com` with per-project reply-to addresses for thread tracking.

### 5.2 Reply-by-Email (Inbound)

Users can reply to conversation notification emails and have their reply posted as a message in the BuiltCRM conversation.

**Architecture:**
```
1. Outbound email sets Reply-To: conv-{conversationId}-{userId}@reply.builtcrm.com
2. User replies via email client
3. Postmark/SendGrid inbound webhook receives the email
4. BuiltCRM parses:
   - Extract conversation ID and user ID from the reply-to address
   - Validate the sender email matches the user record
   - Strip email signature and quoted text
   - Extract attachments
5. Create message in the conversation
6. Notify other participants
```

**Security:** The reply-to address includes a signed token component to prevent spoofing. Sender email must match the user's verified email address.

**Tier gating:** Available on all tiers. This is a PMF feature — reducing friction for users who live in email.

---

## 6. Calendar Sync

### 6.1 Scope

Push BuiltCRM milestones and inspection dates to external calendars. This is a one-way sync — BuiltCRM is the source of truth for project dates. Moving an event in Google Calendar does not change the milestone in BuiltCRM (but could trigger a notification suggesting the user update it in-app).

### 6.2 Implementation

**Option A (MVP): iCal feed**
- Generate a read-only `.ics` feed URL per user
- URL includes auth token: `https://api.builtcrm.com/cal/{userId}/{token}/feed.ics`
- Google Calendar, Outlook, and Apple Calendar all support subscribing to iCal feeds
- Auto-refreshes on the calendar app's schedule (typically every few hours)
- No OAuth needed — simplest to implement

**Option B (V2): Direct API integration**
- Google Calendar API (OAuth 2.0) — create/update/delete events directly
- Microsoft Graph API (OAuth 2.0) — same for Outlook/365
- Enables two-way awareness (not two-way sync)
- Higher implementation cost but better UX

**Recommendation:** Ship iCal feeds in V1. Direct integration in V2.

### 6.3 Calendar Event Content

```
Event: Foundation Pour — 14 Maple Lane Renovation
When: March 15, 2026 (all day) or specific time if set
Location: 14 Maple Lane, Oakville, ON
Description:
  Phase: Foundation
  Status: On track
  View in BuiltCRM: https://app.builtcrm.com/projects/{id}/schedule
Notes: [milestone.description if present]
```

Events include the project name, milestone phase, and a deep link back to the schedule view.

---

## 7. PM Tool Migration

### 7.1 Strategy

Migration is the highest-friction moment in SaaS adoption. The goal is to make switching to BuiltCRM feel low-risk by offering structured import paths from the two most common competitors in SMB/mid-market construction.

### 7.2 CSV/Excel Import (Professional tier)

Self-service import for core entities:

| Entity | CSV Format | Mapping |
|---|---|---|
| Projects | name, address, client_name, client_email, contract_value, start_date, status | → projects table + auto-create client org + invitation |
| SOV / Budget | project_name, item_number, cost_code, description, scheduled_value | → schedule_of_values + sov_line_items |
| Contacts | name, email, company, role, phone | → users + organizations + invitations |
| Milestones | project_name, title, target_date, phase | → milestones |
| RFIs | project_name, rfi_number, subject, status, assigned_to, created_date | → rfis (historical import, all marked as imported) |

**Import wizard flow:**
1. Upload CSV/Excel file
2. Column mapping screen (auto-detect common headers, manual override)
3. Validation preview (show errors, warnings, row counts)
4. Confirm and import
5. Summary screen with links to imported records

### 7.3 Procore Import (Enterprise — assisted)

Procore has a REST API but no standardized export format. Enterprise customers get assisted migration:

1. **Customer provides Procore API credentials** (or exports via Procore's built-in export tools)
2. **BuiltCRM migration script** maps Procore entities:
   - Procore Project → BuiltCRM Project
   - Procore Budget / SOV → BuiltCRM Schedule of Values
   - Procore RFIs → BuiltCRM RFIs (with response history)
   - Procore Change Events/Orders → BuiltCRM Change Orders
   - Procore Directory → BuiltCRM Organizations + Users
   - Procore Documents → BuiltCRM Documents (file migration)
   - Procore Pay Applications → BuiltCRM Draw Requests (historical)
3. **Validation pass** — migration report showing what was imported, what was skipped, and what needs manual attention
4. **Customer review period** — 7 days to verify before going live

### 7.4 Buildertrend Import (Enterprise — assisted)

Similar assisted model. Buildertrend is strong in residential, so the migration emphasizes:
- Selections (categories, items, options with pricing)
- Schedule/milestones
- Client portal data (homeowner contact, communication history)
- Budget/financials
- Photo albums → Documents

### 7.5 Migration Principles

- **Never destructive.** Imported data is tagged with `source: 'procore'` or `source: 'csv_import'` in metadata. Original IDs preserved in a `external_id` field for cross-reference.
- **Additive only.** Migration creates new records — it never modifies or deletes existing BuiltCRM data.
- **Audit trail.** Every imported record has a creation audit event noting the import source, batch ID, and timestamp.
- **Idempotent.** Running the same import twice doesn't duplicate records. External ID + source combination is unique.

---

## 8. Webhook API (Enterprise)

### 8.1 Outbound Webhooks

Enterprise customers can subscribe to BuiltCRM events and receive HTTP POST callbacks to their own systems.

**Available events:**
```
project.created / project.updated / project.archived
draw_request.submitted / draw_request.approved / draw_request.paid
rfi.created / rfi.responded / rfi.closed
change_order.created / change_order.approved / change_order.rejected
approval.requested / approval.decided
compliance.expiring / compliance.submitted / compliance.accepted
milestone.approaching / milestone.completed
document.uploaded / document.version_created
message.created
selection.confirmed / selection.locked
invitation.sent / invitation.accepted
payment.received / payment.failed
```

**Webhook payload structure:**
```json
{
  "id": "evt_abc123",
  "type": "draw_request.approved",
  "created_at": "2026-04-13T14:30:00Z",
  "organization_id": "org_xyz",
  "project_id": "proj_456",
  "data": {
    "draw_request_id": "dr_789",
    "draw_number": 5,
    "amount_cents": 4510000,
    "approved_by": "user_abc",
    "status": "approved"
  },
  "metadata": {}
}
```

**Delivery guarantees:**
- At-least-once delivery (customers must handle idempotency)
- HMAC-SHA256 signature verification (shared secret per endpoint)
- Retry schedule: 1min, 5min, 30min, 2h, 12h, 24h (6 attempts)
- After all retries exhausted: mark endpoint as failing, notify the org admin
- Dashboard shows delivery log with status, response code, and retry history

### 8.2 Inbound Webhooks (Platform)

BuiltCRM receives webhooks from:

| Source | Events | Handler |
|---|---|---|
| Stripe | `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated` | Update draw/payment status, flag failures |
| QuickBooks | `payment.created`, `payment.updated`, `payment.deleted` | Update draw payment status, reconciliation |
| Xero | `invoice.updated`, `payment.created` | Same as QB |
| Postmark/SendGrid | Inbound email received | Parse and create message in conversation |

All inbound webhooks are verified (Stripe signature, QB/Xero verification tokens) and logged in the `webhook_events` table before processing.

---

## 9. Sync Infrastructure

### 9.1 Integration Connection Lifecycle

```
disconnected → connecting → connected → needs_reauth → connected
                                      → disconnected (user disconnects)
                                      → error (unrecoverable)
```

Each connection stores:
- Provider name and type
- OAuth tokens (encrypted at rest with per-org encryption key)
- Mapping configuration (which QB customer = which BuiltCRM project)
- Sync preferences (frequency, what to sync)
- Health status (last successful sync, error count, last error)

### 9.2 Trigger.dev Job Architecture

All integration work happens in background jobs, never in the request path.

**Job types:**

| Job | Trigger | Frequency | Timeout |
|---|---|---|---|
| `accounting.push-invoice` | Draw request approved | Event-driven | 30s |
| `accounting.pull-payments` | Scheduled | Daily at 6 AM org timezone | 5min |
| `accounting.reconcile` | Scheduled | Weekly Sunday 2 AM | 15min |
| `accounting.token-refresh` | Scheduled | Every 25 min (Xero), every 50 days (QB) | 10s |
| `payment.process-webhook` | Stripe webhook received | Event-driven | 15s |
| `payment.check-pending` | Scheduled | Every 6 hours | 2min |
| `email.send-notification` | App event emitted | Event-driven | 10s |
| `email.process-inbound` | Inbound email webhook | Event-driven | 15s |
| `calendar.regenerate-feed` | Milestone created/updated/deleted | Event-driven (debounced 5min) | 30s |
| `webhook.deliver` | App event emitted + active subscription | Event-driven | 10s per endpoint |
| `migration.import-batch` | CSV upload confirmed | Event-driven | 30min |
| `sync.health-check` | Scheduled | Hourly | 30s |

### 9.3 Idempotency Strategy

Every sync operation uses an idempotency key composed of:
```
{provider}:{entity_type}:{builtcrm_id}:{action}:{version}
```
Example: `quickbooks:invoice:dr_789:create:v3`

This prevents duplicate creates on retry and ensures updates are applied in order.

---

## 10. Tier Gating

| Feature | Starter | Professional | Enterprise |
|---|---|---|---|
| CSV export (all modules) | ✅ | ✅ | ✅ |
| Email notifications | ✅ | ✅ | ✅ |
| Reply-by-email | ✅ | ✅ | ✅ |
| iCal feed | ✅ | ✅ | ✅ |
| QuickBooks / Xero / Sage | — | ✅ | ✅ |
| Stripe payments (ACH + card) | — | ✅ | ✅ |
| Google Calendar / Outlook direct | — | — | ✅ |
| Outbound webhook API | — | — | ✅ |
| Procore / Buildertrend migration | — | — | ✅ (assisted) |
| CSV/Excel import | — | ✅ | ✅ |
| SSO / SAML | — | — | ✅ |
| Custom integration support | — | — | ✅ |

---

## 11. Security Requirements

### 11.1 Token Storage
- All OAuth tokens encrypted at rest using AES-256-GCM
- Per-organization encryption keys derived from a master key via KDF
- Refresh tokens stored separately from access tokens
- Token rotation on every refresh (no token reuse)

### 11.2 Data in Transit
- All API calls to external services over TLS 1.2+
- Webhook payloads signed with HMAC-SHA256
- Inbound webhooks verified against provider signatures before processing

### 11.3 Scoping
- Integration connections are scoped to the organization, not the user
- Only org admins can connect/disconnect integrations
- Mapping configuration is visible to project admins
- Sync logs are visible to org admins
- Payment setup requires org admin + Stripe identity verification

### 11.4 Data Minimization
- BuiltCRM stores only the data needed for sync (IDs, mapping, status)
- Full accounting data stays in the accounting system
- Payment card/bank details stored only in Stripe (PCI compliance via Stripe Elements)
- No sensitive financial data in BuiltCRM logs

---

## 12. Implementation Priority

### Phase 1 (Launch)
- Email notifications (outbound) — all tiers
- CSV export — all tiers
- iCal calendar feed — all tiers
- Stripe Connect setup + ACH draw payments — Professional+

### Phase 2 (Month 2-3 post-launch)
- QuickBooks Online integration — Professional+
- Reply-by-email — all tiers
- CSV/Excel import wizard — Professional+
- Stripe card payments for selections — Professional+

### Phase 3 (Month 4-6)
- Xero integration — Professional+
- Outbound webhook API — Enterprise
- Google Calendar direct integration — Enterprise

### Phase 4 (Month 6+)
- Sage integration — Professional+
- Procore migration tooling — Enterprise
- Buildertrend migration tooling — Enterprise
- SSO/SAML — Enterprise
- Outlook/365 calendar direct — Enterprise

---

## 13. Schema Requirements (New Tables)

This spec requires four new tables (detailed in the schema additions file):

1. **`integration_connections`** — tracks OAuth connections per org per provider. Stores encrypted tokens, mapping config, sync preferences, health status.

2. **`sync_events`** — audit log of every sync operation (push, pull, reconciliation). Records what was synced, direction, result, error details, idempotency key.

3. **`payment_transactions`** — records every payment processed through Stripe. Links to draw requests, retainage releases, or selection decisions. Stores Stripe IDs, amounts, status, fee breakdown.

4. **`webhook_events`** — logs all inbound and outbound webhook deliveries. Stores payload hash, delivery status, retry count, response details.

These bring the total schema to **36 tables + 2 modifications**.

---

## 14. UI Surfaces Required

### 14.1 Contractor Settings → Integrations Page
- Grid of available integrations with connect/disconnect
- Connection status badges (connected, needs reauth, error)
- Per-integration settings panel (mapping, sync frequency, preferences)
- Sync activity log with filtering
- Health indicators (last sync, error count, next scheduled sync)

### 14.2 Contractor Settings → Payments Page
- Stripe Connect onboarding status
- Payout schedule and history
- Fee configuration
- Payment method management

### 14.3 Client Billing Review → Pay Now Button
- Stripe Elements embedded payment form
- ACH bank account linking flow
- Saved payment methods
- Payment confirmation + receipt

### 14.4 Integration Dashboard (Org Admin)
- Aggregate sync health across all integrations
- Recent sync events with status
- Error queue with remediation actions
- Webhook delivery log (Enterprise)

---

## 15. Deferred (V2+)

- **Google Drive / Dropbox document sync** — bidirectional file sync between BuiltCRM documents and cloud storage folders
- **Zapier / Make connector** — low-code integration platform for non-technical users
- **BuiltCRM public API** — full REST API for custom integrations (beyond webhooks)
- **Mobile push notifications** — requires native app (V2 mobile roadmap)
- **AI-powered data mapping** — auto-suggest accounting mappings based on SOV descriptions and chart of accounts
- **Multi-currency support** — for projects spanning CAD/USD (border-area contractors)
- **Sage 300 (on-prem)** — cloud-only integrations in V1; on-prem connectors deferred
