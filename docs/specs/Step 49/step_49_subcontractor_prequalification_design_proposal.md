# Step 49 — Subcontractor Prequalification — Design Proposal

**Status:** Locked design (revision v2, post Claude Code repo audit 2026-04-25). Ready for execution.
**Phase:** 5 (Commercial GC Parity), section 5.3, item #49
**Mode:** Require-design-input — **this document IS the design input.**
**Effort:** M
**Priority:** P1

---

## Revision history

**v2 (2026-04-25)** — Reconciled against current repo state. Substantive changes:

- §2.6: exemption is a real table (`prequal_project_exemptions`), not derived from audit events.
- §2.9: badge surfaces reduced to ones that exist in the repo today (compliance workspace + invitation flow). Project sub roster and `/contractor/subcontractors` directory deferred — they don't exist yet.
- §2.10 (new): document storage. Prequal docs do NOT use the `documents` table (project_id NOT NULL). They get self-contained storage on `prequal_documents`.
- §3 (architecture): updated to match the actual repo APIs — `Resource × Action` POLICY map, `requireFeature` for plan gating, new `getOrgContext` helper for non-project-scoped loaders, invitation-accept as the assignment hook.
- §4 (acceptance): #5/#6/#7 rewritten to point at real surfaces.

---

## 1. What this feature is for

Contractors require subcontractors to pass a prequalification check before being awarded work. Today on BuiltCRM that requirement is implicit and tracked outside the system. This feature makes it first-class:

- Contractor defines a prequal form (one per trade, or one general form).
- Subcontractor fills the form once per contractor they work with, attaches supporting documents (bond, insurance, safety manual, references, financials).
- Contractor reviews, scores, approves or rejects with notes.
- Sub profile surfaces the prequal status as a badge.
- When a sub is being added to a project, their prequal status is checked. If they're rejected, expired, or below threshold, the assignment is blocked or warned (configurable per contractor org).

White-space functionality for the SMB GC market — Procore charges separately for it.

---

## 2. Open questions, resolved

### 2.1 Per-trade vs general template

**Decision: Both, with one default per (org, trade) tuple.**

A contractor org can have multiple `prequal_templates`. Each has an optional `tradeCategory`. When inviting a sub, the system suggests the matching trade-specific default, falling back to the general default (`tradeCategory IS NULL`).

Enforced by partial unique index on `(orgId, tradeCategory) WHERE is_default = true`. Drizzle's `uniqueIndex(...).where(sql`...`)` builder handles this directly (precedent: `closeoutPackages.ts`).

### 2.2 Question types supported

**Decision: Six types in v1.**

| Type | Stored as | UI |
|---|---|---|
| `short_text` | string | single-line input |
| `long_text` | string | textarea |
| `yes_no` | boolean | radio group |
| `number` | number | numeric input with optional unit suffix |
| `select_one` | string (choice key) | dropdown / radio group with options array |
| `multi_select` | string[] (choice keys) | checkboxes with options array |

`questionsJson` is a JSON array. Each entry: `{ key, label, type, required, helpText?, options?, unit?, weight?, gating? }`. `key` is a stable snake_case identifier; answers reference questions by key, not by index.

Document-upload "questions" are NOT in `questionsJson`; they live in `prequal_documents` with the fixed `documentType` enum (see 2.5).

### 2.3 Scoring model

**Decision: Numeric weighted score with a minimum-pass threshold AND optional gating questions.**

1. **Weighted score.** Each question can have a `weight` (default 0). `select_one` and `multi_select` options have `points`. `yes_no`: "yes" → `weight`, "no" → 0. `number` answers scored against `scoreBands` (`[{ min, max, points }]`). Total stored as `scoreTotal` (integer).

2. **Gating questions.** A question marked `gating: true` causes auto-fail if the answer matches `scoringRules.gatingFailValues[questionKey]`. Failed gating keys collected into `gatingFailures` array on the submission.

3. **Pass threshold.** `scoringRules.passThreshold` integer. `scoreTotal >= passThreshold` AND empty `gatingFailures` → eligible for approval. Below threshold or with gating failures → eligible for rejection. **Final decision is human, not auto.**

### 2.4 Expiry policy

**Decision: Template-driven with default 12 months, computed at approval time.**

- `prequalTemplates.validityMonths` integer, default 12, nullable for "never expires".
- On approval: `expiresAt = approvedAt + validityMonths months`. NULL stays NULL.
- Daily Trigger.dev v3 task `prequal-expiry-sweep` flips `approved → expired` for stale rows. Idempotency via `prequal_submissions.remindersSentJson` (per-day-threshold timestamps so 30/14/7-day reminders don't double-send).
- Resubmission creates a new row; old rows preserved.

### 2.5 Document types

**Decision: Five document categories in v1.**

`bond | insurance | safety_manual | references | financial_statements`. Locked as the v1 enum. Multiple documents per type allowed.

### 2.6 Assignment block UX — warning vs hard block

**Decision: Configurable per contractor org (default `off` for existing orgs, `warn` for new orgs created post-migration).**

`organizations.prequal_enforcement_mode` enum:

- `off` — prequal feature available but assignment never checks.
- `warn` — non-blocking warning at assignment time. Override is captured in `audit_events` (no exemption row needed).
- `block` — hard block. To bypass: either approve a prequal, or grant a per-project exemption via `prequal_project_exemptions`.

**Exemption (block mode only):** `prequal_project_exemptions` table — `(projectId, subOrgId, contractorOrgId, grantedByUserId, reason, grantedAt, expiresAt?, revokedAt?, revokedByUserId?)`. Partial unique index ensures one active exemption per (project, sub) pair. Audit events still fire on grant/revoke.

Migration default for existing rows: `'off'`. New contractor orgs: `'warn'`, set in app code at org creation (not at the schema default level — keeps non-contractor org types at `'off'` without a separate policy branch).

### 2.7 Where the sub fills the form

**Decision: Inside the subcontractor portal at `/subcontractor/prequalification`.**

Sub portal cross-project nav (`src/lib/portal-nav.ts`) gets a new "Prequalification" entry under the Compliance group. Plan-feature-gated: visible if any contractor that has invited the sub has the `prequalification` feature on their plan.

The page lists one row per contractor that has invited them (or that they've already submitted to) with status pill. Click into a row to fill or view the submission.

Subs do NOT see the score. They see outcome (approved / rejected) and reviewer notes if the contractor chose to share them.

### 2.8 Where the contractor manages it

**Decision: Three surfaces.**

1. **Template management.** `/contractor/settings/prequalification/templates` — CRUD on templates, mark defaults.
2. **Submission review queue.** `/contractor/prequalification` — global (cross-project) inbox. Filters by trade, sub, status, expiring-soon.
3. **Per-sub history.** `/contractor/subcontractors/[subOrgId]/prequalification` — historical record for one sub.

### 2.9 Sub profile badge — where exactly (revised v2)

**Decision: Two surfaces in v1 — both already exist in the repo.**

Original v1 listed four surfaces. Audit confirmed only two exist today:

1. **Compliance workspace** — the existing module already lists sub orgs. Badge column added adjacent to compliance status. (Existing surface — has the sub org already; adding a column is mechanical.)

2. **Invitation flow** — when the contractor invites a sub to a project, the inviter sees the prequal badge in the confirmation modal. If `mode = warn`, a banner with "Proceed anyway" appears. If `mode = block`, the invite cannot be sent without a prequal-or-exemption escape.

**Deferred to a follow-up step:**

- Project sub roster — no `/contractor/project/[projectId]/team` page exists today. Subs surface inside compliance, drawings, submittals, punch-list — none is a roster. A roster page is its own scope.
- Global `/contractor/subcontractors` directory — also doesn't exist today.

The shared `<PrequalBadge subOrgId contractorOrgId />` component is still built, just used in fewer places. When the roster + directory pages land later, the badge plugs in for free.

### 2.10 Document storage (new in v2)

**Decision: Self-contained storage on `prequal_documents`. Does NOT reference `documents`.**

The `documents` table requires `projectId NOT NULL`. Prequal happens once per (sub, contractor) and has no project at upload time. Two options were considered:

- **(a)** Make `documents.project_id` nullable + add `organization_id` for org-scoped docs. Wide blast radius — every document loader, visibility check, and the documents UI changes.
- **(b)** Give `prequal_documents` its own minimal storage row: `storageKey`, `title`, `fileSizeBytes`, `mimeType`, `uploadedByUserId`. **Chosen.** Prequal docs are one-shot — no supersedes-chain, no audience scoping, no document categories. `transmittal_recipients.accessTokenDigest` sets a similar precedent of keeping isolated storage close to home.

R2 retrieval is mediated by the application layer via signed URLs (same R2 strategy as the documents table).

---

## 3. Architecture & integration touchpoints

### 3.1 Where prequal lives in the codebase

Following existing conventions from `current_repo_state_2026-04-20.md`:

- **Schema:** new file `src/db/schema/prequal.ts`. Re-exported from `src/db/schema/index.ts`.
- **Loaders:** `src/domain/loaders/prequal.ts`.
- **Actions:** `src/domain/prequal/` folder for mutation handlers (matches the pattern of `domain/documents/`, `domain/procurement/`, `domain/schedule/`).
- **Pages:**
  - `src/app/(portal)/contractor/settings/prequalification/page.tsx` (enforcement settings)
  - `src/app/(portal)/contractor/settings/prequalification/templates/page.tsx`
  - `src/app/(portal)/contractor/settings/prequalification/templates/[templateId]/page.tsx`
  - `src/app/(portal)/contractor/prequalification/page.tsx` (review queue)
  - `src/app/(portal)/contractor/prequalification/[submissionId]/page.tsx` (review detail)
  - `src/app/(portal)/contractor/subcontractors/[subOrgId]/prequalification/page.tsx` (per-sub history)
  - `src/app/(portal)/subcontractor/prequalification/page.tsx` (sub list of contractor invitations)
  - `src/app/(portal)/subcontractor/prequalification/[contractorOrgId]/page.tsx` (sub fills form)
- **Components:** `src/components/prequal/` for `PrequalBadge`, `PrequalFormRenderer`, `PrequalReviewPanel`.
- **Jobs:** `src/jobs/prequal-expiry-sweep.ts` (Trigger.dev v3 task — repo is on `@trigger.dev/sdk/v3`; v4 deferred per memory note).
- **Nav:** `src/lib/portal-nav.ts` — add Prequalification entry to subcontractor portal under Compliance group; add to contractor settings shell.
- **Notification catalog:** `src/lib/notification-catalog.ts` — 7 new event types (see §3.5).
- **Notification recipients:** `src/lib/notifications/recipients.ts` — add helper `orgMembersByPortal(orgId, portalType)` (no current case routes to "all members of org X" without a project context; this is the new pattern).
- **Context:** `src/domain/context.ts` — add new sibling `getOrgContext(session)` resolver. The existing `getEffectiveContext(session, projectId)` is project-scoped only and throws `not_found` without a project. Most prequal pages aren't project-scoped (templates, review queue, settings, sub list). New helper: `getOrgContext(session)` resolves user → primary org → role without requiring a project.

### 3.2 Authorization

`POLICY` lives at `src/domain/permissions.ts` and is shaped as `Record<Resource, Partial<Record<Action, Set<EffectiveRole>>>>` where `Action` is `read | write | approve`. Add new resources to the `Resource` union:

- `"prequal_template"` — `read` (contractor admins, contractor PMs), `write` (contractor admins).
- `"prequal_submission"` — `read` (contractor admins, contractor PMs, subcontractor users for their own org's rows), `write` (subcontractor users for their own org's rows), `approve` (contractor admins, contractor PMs).
- `"prequal_enforcement_settings"` — `read` (contractor admins), `write` (contractor admins / org owner role).

Per-row ownership (sub can only see/write their own org's submissions; contractor can only see/decide submissions addressed to their own org) is enforced **inside the action handlers**, not in the policy map. This matches the existing convention.

### 3.3 Plan-feature gating

`requireFeature(ctx: PlanContext, feature: PlanFeatureKey)` lives at `src/domain/policies/plan.ts`. Add to `PlanFeatureKey` and `PLAN_FEATURES`:

```ts
"prequalification": "professional"
```

Tier mapping (consistent with neighbours like `approvals.workflows`, `import.csv_excel`):

- Starter: feature off, nav hidden.
- Professional+: feature on.

Loaders build `PlanContext` from `organization_subscriptions` per existing pattern, then call `requireFeature(planCtx, "prequalification")` early.

### 3.4 Integration with existing modules

| Module | Integration |
|---|---|
| **Compliance** (`compliance_records`) | Prequal documents and compliance records overlap (insurance, bonding). When a sub uploads insurance via prequal, prompt the sub at upload time to also create/update the corresponding `compliance_records` row. **Not auto-synced** in v1. |
| **Invitation-accept flow** | This is the assignment hook target. The existing invitation-accept handler (somewhere in `src/app/api/`; trace before wiring) gets a call to `checkPrequalForAssignment(contractorOrgId, subOrgId, projectId)` inside the txn. Result surfaces to the **inviter** (the contractor user) — not the invitee — at invite time, since the inviter is the one with prequal authority. The actual invitation row creation is gated on the result for `block` mode; warns and proceeds for `warn` mode (with audit). For details on the assignment hook and warn/block UX, see Sub-step 5 of the build guide. |
| **Notifications** | Add to `src/lib/notification-catalog.ts`: `prequal.invited`, `prequal.submitted`, `prequal.approved`, `prequal.rejected`, `prequal.expired`, `prequal.expiring_soon`, `prequal.override_used`. Routed through existing notification preferences (Step 16). The recipient resolver needs a new `orgMembersByPortal(orgId, portalType)` helper since prequal events route to "all members of org X" without a project context. |
| **Audit events** (`audit_events`) | Object types: `prequal_template`, `prequal_submission`, `prequal_project_exemption`, `prequal_assignment_override`. Note: `activity_feed_items.project_id` nullability needs a quick check during implementation — most prequal events have no project, so they either skip the activity feed or require a nullable column. |

### 3.5 Memoization

`getActivePrequalForPair(contractorOrgId, subOrgId)` is the workhorse for the badge + assignment hook. Wrap with `import { cache } from "react"` so multiple badges on one page don't re-query. Note: this is the **first** use of `react.cache` in this codebase — not an existing pattern, but the right tool.

---

## 4. Acceptance criteria (locked, revised v2)

1. **Template lifecycle.** Contractor admin creates a template with at least 5 questions covering all 6 question types, sets a pass threshold, marks one question as gating, sets validity to 12 months, marks as default for "Electrical" trade. Saves successfully. Template appears in template list. Audit event recorded.

2. **Sub invitation.** Contractor invites sub "Northline Electrical" to prequalify using the Electrical template. Sub gets a notification + email. Sub sees a new row in `/subcontractor/prequalification`.

3. **Sub fills and submits.** Sub fills out form, uploads bond + insurance + safety manual + 2 references + financial statement to the self-contained `prequal_documents` storage. Submits. Status flips to "submitted". Score is computed server-side. Contractor gets notification + email.

4. **Contractor reviews.** Contractor opens submission. Sees answers, score breakdown, uploaded docs (clickable to view via signed-URL retrieval), gating-question pass/fail. Adds reviewer notes. Approves. Status flips to "approved". `expiresAt` populated to approval date + 12 months. Sub gets notification + email.

5. **Badge appears in compliance workspace.** Sub's row in the contractor's compliance workspace shows green "Approved — expires <date>" badge alongside compliance status. *(Project sub roster surface deferred — no roster page exists today.)*

6. **Invitation with `warn` mode.** Contractor with `prequalEnforcementMode = 'warn'` invites a sub without an active prequal to a project (via the existing invitation-accept flow). Inviter sees warning banner with prequal-status reason + "Proceed anyway" button. Inviter proceeds. Invitation succeeds. Audit event records `prequal_assignment_override`.

7. **Invitation with `block` mode.** Same flow but `mode = 'block'`. Invitation is blocked at the inviter's confirmation step. Inviter must either invite the sub to prequalify first, wait for approval, or grant a `prequal_project_exemptions` row for that (project, sub). Granting the exemption requires a reason and is audit-trailed; once granted, the invitation proceeds.

8. **Rejection path.** Contractor reviews a submission, marks one gating question as failed (or scores below threshold), rejects with reason. Status flips to "rejected". Sub sees rejection + reviewer note. Sub can resubmit (creates new submission row).

9. **Expiry job.** A submission with `expiresAt` set to `now() - 1 day`. Run the sweep manually (`npx trigger.dev@3 dev --task prequal-expiry-sweep`). Submission flips to "expired". `remindersSentJson` updated. Notifications sent. Re-running the sweep doesn't double-notify.

10. **Plan gating.** A Starter-plan contractor org cannot see prequal in nav or settings. A Professional-plan contractor org can. `requireFeature` throws cleanly when called from an unprivileged context.

11. **`npm run build && npm run lint && npm run test`** clean. New tests added: `prequal-flow.test.ts`, `prequal-policy.test.ts`, `prequal-scoring.test.ts`.

---

## 5. Out of scope for v1 (deferred)

- **Auto-decision based on score.** v1 is human-in-the-loop.
- **Prequal templates shareable across contractor orgs.** Each org maintains their own templates. No marketplace.
- **Sub-side analytics** ("how does my prequal score compare?"). Not v1.
- **Bulk re-invitation.** "Invite all my subs to redo prequal because I changed the template" — useful but v1 leaves it as one-by-one.
- **Conditional questions.** Skip-logic adds form-engine complexity; defer.
- **Multi-step / save-draft form.** v1 is single-page; the `draft` status is reserved in the enum but not exposed in UI. Adding draft-save later requires no schema change.
- **PDF export of approved prequal package.** Useful for owner/lender requests but defer.
- **Project sub roster + global subcontractor directory pages.** Not blocked on Step 49 — when these pages land in a future step, the existing `<PrequalBadge>` component drops in.

---

## 6. Migration & rollout

- New tables, new enums, new column on `organizations`. Migration is additive only.
- Existing contractor orgs default to `prequalEnforcementMode = 'off'` — no behavior change until they opt in.
- Plan-feature flag `prequalification: "professional"` added; flag absence on existing subscriptions = not granted.
- Schema workflow: edit → `npm run db:generate` → review SQL → `npm run db:migrate`. No `db:push`.

---

## 7. Estimated work

| Area | Effort |
|---|---|
| Schema + migration | 0.5 day |
| Loaders + actions + policy + new `getOrgContext` helper | 1.5 days |
| Template management UI | 1 day |
| Sub intake UI (form renderer + self-contained doc upload) | 1.5 days |
| Contractor review UI | 1 day |
| Badge component + integration into compliance + invitation surfaces | 0.5 day |
| Invitation-accept assignment hook + warn/block UX + exemption grant flow | 1 day |
| Expiry sweep job + notifications (incl. new recipient resolver helper) | 0.5 day |
| Tests | 1 day |
| **Total** | **~8.5 days (matches "M" effort estimate)** |
