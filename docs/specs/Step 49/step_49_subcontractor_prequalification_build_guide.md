# Step 49 — Subcontractor Prequalification — Build Guide

**Phase:** 5 (Commercial GC Parity), section 5.3, item #49
**Mode:** Locked design — execute end-to-end. Stop and ask only at the schema-confirmation gate (sub-step 1) and at the new-dependency gate (none expected).
**Effort:** M (~8.5 working days)
**Priority:** P1
**Revision:** v2 (post Claude Code repo audit, 2026-04-25)

> **For Claude Code:** Read these companion files before starting:
>
> - `docs/specs/step_49_subcontractor_prequalification_design_proposal.md` (v2)
> - `docs/schema/drizzle_schema_phase5_prequal.ts` (v2)
> - `docs/specs/current_repo_state_2026-04-20.md`
> - `CLAUDE.md`
>
> All design ambiguity is resolved in the proposal. Sub-step numbering matches the proposal's structure. If repo state has shifted since the audit, surface the question in chat before guessing.

---

## Sub-step 1 — Schema confirmation gate

> **Stop and ask gate.** Before running migrations, confirm with the human:
>
> 1. The 4 new tables (`prequal_templates`, `prequal_submissions`, `prequal_documents`, `prequal_project_exemptions`) match the proposal.
> 2. The 3 new enums match.
> 3. The new `organizations.prequal_enforcement_mode NOT NULL DEFAULT 'off'` column is acceptable on the live DB.
> 4. `prequal_documents` is self-contained (no FK to `documents.id`) — confirmed via the audit decision (B4).
> 5. `prequal_project_exemptions` exists as a real table for block-mode escapes — confirmed via the audit decision (S8).
>
> Run `npm run db:generate` and show the migration SQL preview. Wait for explicit confirmation before `npm run db:migrate`.

After confirmation, copy `drizzle_schema_phase5_prequal.ts` into `src/db/schema/prequal.ts`. Replace the commented stub imports at the top with real imports from `./identity` (organizations, users), `./projects` (projects), and `./_shared` (timestamps spread). Replace the inline `createdAt`/`updatedAt` definitions with `...timestamps`. Wire the new tables into `src/db/schema/index.ts`. Run `npm run db:generate`, review the SQL, then `npm run db:migrate`.

Also: add `prequalEnforcementMode` to the `organizations` table definition in `src/db/schema/identity.ts`:

```ts
prequalEnforcementMode: prequalEnforcementModeEnum("prequal_enforcement_mode")
  .default("off")
  .notNull(),
```

Quick check during this sub-step: confirm `activity_feed_items.project_id` nullability. Most prequal events have no project; if `project_id` is NOT NULL, prequal events skip the activity feed in v1 (acceptable — they still appear in notifications + audit). If it's nullable, route them through normally.

---

## Sub-step 2 — Update permissions

`src/domain/permissions.ts` shape: `POLICY: Record<Resource, Partial<Record<Action, Set<EffectiveRole>>>>`. `Action` is `read | write | approve`.

Add to the `Resource` union:

```ts
| "prequal_template"
| "prequal_submission"
| "prequal_enforcement_settings"
```

Add to the `POLICY` map:

```ts
prequal_template: {
  read:    new Set(["contractor_admin", "contractor_pm"]),
  write:   new Set(["contractor_admin"]),
},
prequal_submission: {
  read:    new Set(["contractor_admin", "contractor_pm", "subcontractor_user"]),
  write:   new Set(["subcontractor_user"]),                // sub fills the form
  approve: new Set(["contractor_admin", "contractor_pm"]), // contractor decides
},
prequal_enforcement_settings: {
  read:    new Set(["contractor_admin"]),
  write:   new Set(["contractor_admin"]),
},
```

**Per-row ownership** is enforced inside the action handlers (existing convention), not in the policy map:

- `prequal_submission:write` — actor's org must equal `submission.submittedByOrgId`.
- `prequal_submission:read` for sub roles — actor's org must equal `submission.submittedByOrgId`.
- `prequal_submission:read` for contractor roles — actor's org must equal `submission.contractorOrgId`.
- `prequal_submission:approve` — actor's org must equal `submission.contractorOrgId`.
- `prequal_template:write` — actor's org must equal `template.orgId`.

Each action calls `assertCan(ctx, resource, action)` first, then performs the org-match check explicitly with a clear error if it fails.

---

## Sub-step 3 — Plan-feature gating

`src/domain/policies/plan.ts` exposes `requireFeature(ctx: PlanContext, feature: PlanFeatureKey)`. Add `"prequalification"` to the `PlanFeatureKey` literal union. Add to `PLAN_FEATURES`:

```ts
"prequalification": "professional"
```

(Same tier as `approvals.workflows` and `import.csv_excel`.)

Loaders build `PlanContext` from `organization_subscriptions` per existing pattern, then call:

```ts
requireFeature(planCtx, "prequalification");
```

early in the loader. Nav rendering hides the prequal entries when the feature is off.

---

## Sub-step 4 — Loaders

Most prequal pages aren't project-scoped. The existing `getEffectiveContext(session, projectId)` requires a project and throws `not_found` without one. Add a sibling resolver:

**File:** `src/domain/context.ts` (extend, don't replace)

```ts
export async function getOrgContext(session): Promise<OrgContext> {
  // Resolve user → primary org → role.
  // No project lookup. Throws AuthorizationError if user has no active org membership.
  // Returns: { user, organization, role, permissions } — same shape as
  // EffectiveContext but with project=null.
}
```

Project-scoped prequal calls (just the assignment hook, really) keep using `getEffectiveContext`.

Then create `src/domain/loaders/prequal.ts`:

```ts
// Contractor surfaces (org-scoped — use getOrgContext)
export async function getPrequalTemplatesView(session)
export async function getPrequalTemplateDetailView(session, templateId)
export async function getPrequalReviewQueueView(session, filters?)
export async function getPrequalSubmissionDetailView(session, submissionId)
export async function getPrequalSubcontractorHistoryView(session, subOrgId)
export async function getPrequalEnforcementSettingsView(session)

// Subcontractor surfaces (org-scoped)
export async function getSubPrequalListView(session)
export async function getSubPrequalFormView(session, contractorOrgId)
export async function getSubPrequalSubmissionView(session, submissionId)

// Shared — used by the badge component and the assignment-block hook
export async function getActivePrequalForPair(
  contractorOrgId: string,
  subOrgId: string,
): Promise<{
  status: "approved" | "pending" | "rejected" | "expired" | "none",
  submissionId?: string,
  expiresAt?: Date,
}>
```

`getActivePrequalForPair`: query the most recent `prequal_submissions` row for the (contractorOrgId, subOrgId) pair. Map status → public values: drafts → "none"; submitted/under_review → "pending"; approved → "approved" (or "expired" if `expiresAt` has passed but the sweep hasn't run yet); rejected → "rejected"; expired → "expired".

**Memoize per request** by wrapping with `import { cache } from "react"`. Note: this is the **first** use of `react.cache` in this codebase. It's the right tool, but call it out as a fresh introduction in the PR description.

---

## Sub-step 5 — Actions

Create `src/domain/prequal/` folder. One file per mutation, following the standard 8-step pattern (resolve actor → resolve context → load → policy check → state validate → mutate in txn → audit → return result).

```
src/domain/prequal/
  create-template.ts            # POST template
  update-template.ts            # PATCH template (re-validate questions JSON)
  archive-template.ts           # soft-archive
  set-default-template.ts       # mark default for (org, trade), un-default siblings
  invite-sub-to-prequalify.ts   # create draft submission + notify
  save-submission-draft.ts      # sub edits in-flight (status stays 'draft')
  submit-submission.ts          # status draft → submitted, compute score+gating
  attach-document.ts            # presigned upload + add prequal_documents row
  remove-document.ts
  decide-submission.ts          # contractor approves/rejects (sets expires_at)
  override-rejection.ts         # contractor approves despite gating-fail (audit)
  set-enforcement-mode.ts       # contractor org owner sets warn/block/off
  grant-project-exemption.ts    # block-mode escape (writes prequal_project_exemptions)
  revoke-project-exemption.ts   # soft-revoke an exemption
  check-assignment.ts           # called by the invitation-accept hook
```

### Score computation (`submit-submission.ts`)

```ts
function computeScore(template, answers) {
  let total = 0;
  const gatingFailures: string[] = [];

  for (const q of template.questionsJson) {
    const ans = answers[q.key];
    if (q.gating && matchesGatingFailValue(template.scoringRules.gatingFailValues[q.key], ans)) {
      gatingFailures.push(q.key);
    }
    total += pointsFor(q, ans);
  }

  return { scoreTotal: total, gatingFailures };
}
```

`pointsFor` per question type:
- `yes_no` → ans === true ? q.weight : 0
- `number` → match against `q.scoreBands`, return matching `points`
- `select_one` → look up `q.options[choiceKey].points`
- `multi_select` → sum `points` for each selected key
- `short_text` / `long_text` → 0 (qualitative, doesn't score)

### Document upload (`attach-document.ts`)

Self-contained storage flow (no `documents` table involvement):

1. Action receives metadata (filename, mime type, size, type tag).
2. Generates an R2 storage key (e.g. `prequal/{submissionId}/{uuid}-{slugified-filename}`).
3. Returns a presigned PUT URL to the client. Client uploads directly to R2.
4. Client posts back a confirmation; action writes the `prequal_documents` row.

Same R2 strategy as the documents table. Retrieval is via signed GET URLs, mediated server-side via `getPrequalDocumentDownloadUrl(submissionId, documentId)`.

### Assignment hook (`check-assignment.ts`)

```ts
export async function checkPrequalForAssignment(
  contractorOrgId: string,
  subOrgId: string,
  projectId: string,
): Promise<
  | { kind: "ok" }
  | { kind: "warn"; reason: string; activeStatus: string; submissionId?: string }
  | { kind: "block"; reason: string; activeStatus: string; submissionId?: string }
> {
  const mode = await getEnforcementMode(contractorOrgId);
  if (mode === "off") return { kind: "ok" };

  const active = await getActivePrequalForPair(contractorOrgId, subOrgId);
  if (active.status === "approved") return { kind: "ok" };

  // Block-mode-only escape: project exemption.
  if (mode === "block") {
    const exempted = await hasActiveProjectExemption(projectId, subOrgId);
    if (exempted) return { kind: "ok" };
  }

  if (mode === "warn") return {
    kind: "warn",
    reason: friendlyReason(active.status),
    activeStatus: active.status,
    submissionId: active.submissionId,
  };

  return {
    kind: "block",
    reason: friendlyReason(active.status),
    activeStatus: active.status,
    submissionId: active.submissionId,
  };
}
```

### Wiring the hook — invitation-accept path

The hook target is the **existing invitation-accept handler** (the only path today that creates `project_organization_memberships`; nothing in `src/app` does direct inserts). Steps:

1. Trace the invitation-accept handler. Search `src/app/api` for the route handling invitation acceptance — likely something like `src/app/api/invitations/[token]/accept/route.ts` or similar. Read it to confirm the handler shape and the txn boundary.

2. Inside the txn, before the `project_organization_memberships` insert, call `checkPrequalForAssignment(contractorOrgId, subOrgId, projectId)`.

3. The result surfaces to the **inviter** (the contractor user who sent the invite), not the invitee. The inviter is the one with prequal authority and decision context. UX:
   - `kind: "ok"` → invitation flows normally.
   - `kind: "warn"` → the inviter sees the warning at invite-creation time (before the invite is sent), with "Proceed anyway" as a confirm step. Override accepted → invitation is sent + audit event `prequal_assignment_override` written. Override declined → invitation cancelled.
   - `kind: "block"` → the inviter cannot send the invite. UI offers two paths: (a) invite the sub to prequalify first (calls `invite-sub-to-prequalify`), or (b) grant a project exemption (calls `grant-project-exemption`). Once either succeeds, retry the invite.

4. The check writes `prequal_assignment_override` audit events for warns. Block-mode exemptions write `prequal_project_exemption.granted` audit events.

> **Note for Claude Code:** if the existing invitation-accept handler shape doesn't fit this hook cleanly (e.g., warn-mode UI surfacing isn't possible because the handler is purely API-side without a UI confirm step), surface the question. Don't build a parallel "Assign sub to project" modal — that's scope creep. The expected solution is a small UI tweak to the invite-creation flow that consults `checkPrequalForAssignment` before posting to the accept handler.

---

## Sub-step 6 — Pages

Build in dependency order.

### 6a. Contractor template management

**Route:** `src/app/(portal)/contractor/settings/prequalification/templates/page.tsx`

List view: table of templates (Name, Trade, Default, Validity, Question count, Last updated, Actions). Toolbar: "New template" button.

**Route:** `src/app/(portal)/contractor/settings/prequalification/templates/[templateId]/page.tsx`

Detail view editor with three tabs:
- Settings (name, description, trade category, validity months, default toggle)
- Questions (drag-to-reorder list; click to edit; "Add question" picker for the 6 types)
- Scoring rules (pass threshold input, gating-question summary auto-built from Questions tab)

React Hook Form + Zod for validation. Zod discriminated union per question type. Save calls `update-template`.

### 6b. Subcontractor intake

**Route:** `src/app/(portal)/subcontractor/prequalification/page.tsx`

List view: one card per contractor that has invited the sub or that the sub has already submitted to. Each card shows status pill, last-action date, "Open" button.

**Route:** `src/app/(portal)/subcontractor/prequalification/[contractorOrgId]/page.tsx`

Form view: `<PrequalFormRenderer template mode="fill" />`. Document-upload sections (one per document type) below the questions, using the self-contained presigned-upload flow. Submit button at the bottom.

### 6c. Contractor review queue

**Route:** `src/app/(portal)/contractor/prequalification/page.tsx`

Cross-project review inbox. Filters: status (default = submitted + under_review), trade, sub org, expiring in < N days. Table columns: Sub, Trade, Submitted, Score, Status, Action.

**Route:** `src/app/(portal)/contractor/prequalification/[submissionId]/page.tsx`

Review detail: `<PrequalFormRenderer mode="review" />` showing answers. Side panel:
- Score breakdown per question with weight + earned points. **Internal only.**
- Gating failures list (red-flagged).
- Documents list (clickable; signed-URL retrieval).
- Reviewer notes textarea (visible to sub on decision).
- Decision buttons: Approve / Reject. Approve sets `expires_at`. Reject requires notes.
- "Override gating failure and approve anyway" — visible only when there are gating failures, requires confirm + reason; writes a distinct audit event.

### 6d. Per-sub history

**Route:** `src/app/(portal)/contractor/subcontractors/[subOrgId]/prequalification/page.tsx`

List of all submissions from this sub to this contractor over time. Most recent at top. Active-status badge prominently displayed. "Invite to re-prequalify" button (creates a new draft submission + notifies the sub).

If `/contractor/subcontractors/[subOrgId]/page.tsx` doesn't exist as a sub profile root, this can stand alone — link to it from the compliance workspace and from invite confirmations.

### 6e. Settings — enforcement mode

**Route:** `src/app/(portal)/contractor/settings/prequalification/page.tsx`

Section card with three radio options (off / warn / block) plus explanatory copy for each. Save calls `set-enforcement-mode`. Audit-logged.

This page is also the parent route for `/templates`. Breadcrumb: Settings → Prequalification → Templates.

Add the prequal section to the existing contractor settings shell (find the shell + nav config — likely in `src/components/settings/settings-shell.tsx` per the repo state doc).

### 6f. Shared components

**`src/components/prequal/PrequalBadge.tsx`** — reads via `getActivePrequalForPair`, renders status pill + expiry date. Three sizes: `sm`, `md`, `lg`.

**`src/components/prequal/PrequalFormRenderer.tsx`** — renders questions array with mode prop:
- `fill` (sub editing): editable inputs, save-draft + submit buttons.
- `view` (sub viewing submitted): read-only answers, no score.
- `review` (contractor reviewing): read-only answers + score column per question.

**`src/components/prequal/PrequalReviewPanel.tsx`** — review side panel. Decision buttons + override flow.

---

## Sub-step 7 — Badge integration (revised v2 — only real surfaces)

Wire `<PrequalBadge>` into existing surfaces. Audit confirmed only two:

1. **Compliance workspace** — find the existing module that lists sub orgs (loader: `src/domain/loaders/subcontractor-compliance.ts` or `compliance-report.ts`). Add a badge column adjacent to compliance status.

2. **Invitation flow** — when the inviter is creating an invite for a sub, the form/modal that picks the sub shows the badge next to each candidate. On submission, the warn/block UX (Sub-step 5) takes over.

**Deferred (not built in this step):**
- Project sub roster — no `/contractor/project/[projectId]/team` page exists. When a roster page lands later, the badge plugs in for free.
- Global `/contractor/subcontractors` directory — also doesn't exist. Same plug-in pattern when it lands.

Each surface reads through `getActivePrequalForPair` (memoized via `react.cache`).

---

## Sub-step 8 — Subcontractor portal nav entry

Edit `src/lib/portal-nav.ts`. The subcontractor portal cross-project nav (around line 174-215 per the audit) currently has Today Board / Daily Logs / RFIs / Upload Requests / Schedule / Documents / Compliance / Messages.

Add "Prequalification" under the Compliance group. Plan-feature-gated visibility: the entry shows when the feature is on for any contractor that has invited this sub. (Implementation: the nav builder loads a small `getSubPrequalNavVisibility(session)` flag — `true` if there's at least one prequal_submissions row for this sub_org_id where contractor_org has the feature.)

Also add nav entries to the contractor settings shell (Settings → Prequalification → Templates).

---

## Sub-step 9 — Notifications

Add to `src/lib/notification-catalog.ts` (mirror the closeout-events pattern that's already there):

```
prequal.invited            → sub: "{Contractor} invited you to prequalify"
prequal.submitted          → contractor: "{Sub} submitted prequalification"
prequal.approved           → sub: "Your prequalification with {Contractor} was approved"
prequal.rejected           → sub: "Your prequalification with {Contractor} was rejected"
prequal.expired            → both: "Prequalification with {Contractor/Sub} has expired"
prequal.expiring_soon      → both: 30/14/7-day warnings
prequal.override_used      → contractor admins (audit visibility, not actionable)
```

Email templates follow the existing notification email style.

**New recipient resolver helper.** In `src/lib/notifications/recipients.ts`, none of the existing cases route to "all members of org X" without a project context. Add:

```ts
export function orgMembersByPortal(orgId: string, portalType: PortalType)
```

Used by all 7 prequal events. Returns the list of users in the org whose portal type matches, filtered by their notification preferences.

---

## Sub-step 10 — Trigger.dev expiry sweep

**File:** `src/jobs/prequal-expiry-sweep.ts` (Trigger.dev v3 — `@trigger.dev/sdk/v3`).

Schedule: daily at 02:00 UTC. Logic:

1. Find all `prequal_submissions` where `status = 'approved' AND expires_at < now()`. For each: update status to `expired`, write audit event, emit `prequal.expired` notification.

2. Find all approved submissions where `expires_at` falls within 30/14/7 days of now. For each: check `remindersSentJson` for the relevant key ("30" / "14" / "7"); if null, send `prequal.expiring_soon` notification and set the key to the current ISO timestamp.

Idempotency: the sweep is safe to run multiple times per day; the `remindersSentJson` keys prevent duplicate emails.

---

## Sub-step 11 — Tests

Add to `tests/`:

**`prequal-flow.test.ts`** — full happy-path:
1. Seed contractor + sub orgs + users.
2. Contractor creates template via action.
3. Contractor invites sub.
4. Sub fills + submits (with mock R2 upload).
5. Assert `scoreTotal` and `gatingFailures` correctly computed.
6. Contractor approves.
7. Assert `expiresAt` set correctly.
8. Assert `getActivePrequalForPair` returns `approved`.
9. Assignment via invitation-accept: assert allowed under `warn`, blocked under `block`, allowed under `block` with active exemption.

**`prequal-policy.test.ts`** — assignment-block matrix:
- Mode × active status × exemption → expected outcome (table-driven).
- Cross-org leakage: sub from org A can't see sub from org B's submissions; contractor from org X can't review org Y's templates; per-row ownership checks fire correctly.

**`prequal-scoring.test.ts`** — pure unit tests of `computeScore`:
- All 6 question types.
- Gating failure detection (yes_no, multi_select gating values).
- Score-bands edge cases (boundary values for `number` questions).

---

## Sub-step 12 — Build verification

```bash
npm run build && npm run lint && npm run test
```

Must be clean.

---

## Sub-step 13 — Manual clickthrough

Run through every acceptance criterion from §4 of the design proposal. Use seeded contractor + sub orgs from `db:seed` (extend the seed to include one prequal template + one approved submission so reviewers have realistic data on first login).

---

## Commit

```bash
git add .
git commit -m "Step 49 (5.3 #49): Subcontractor prequalification — templates, intake, review, badge, invitation hook"
```

---

## Phase 5 wrap (after Step 49 lands)

```bash
npm run build && npm run lint && npm run test
```

Phase 5 done. (Wait for human to ask for status writeup before producing one — context window protocol.)

---

## Files added in this step

```
# Schema
src/db/schema/prequal.ts                                          # new
src/db/schema/index.ts                                            # modified (export 4 new tables)
src/db/schema/identity.ts                                         # modified (organizations.prequalEnforcementMode)

# Domain
src/domain/context.ts                                             # modified (add getOrgContext)
src/domain/permissions.ts                                         # modified (3 new resources)
src/domain/policies/plan.ts                                       # modified (prequalification feature)
src/domain/loaders/prequal.ts                                     # new
src/domain/prequal/                                               # new folder, ~15 files
  ├ create-template.ts
  ├ update-template.ts
  ├ archive-template.ts
  ├ set-default-template.ts
  ├ invite-sub-to-prequalify.ts
  ├ save-submission-draft.ts
  ├ submit-submission.ts
  ├ attach-document.ts
  ├ remove-document.ts
  ├ decide-submission.ts
  ├ override-rejection.ts
  ├ set-enforcement-mode.ts
  ├ grant-project-exemption.ts
  ├ revoke-project-exemption.ts
  └ check-assignment.ts

# Pages
src/app/(portal)/contractor/settings/prequalification/page.tsx                          # new
src/app/(portal)/contractor/settings/prequalification/templates/page.tsx                # new
src/app/(portal)/contractor/settings/prequalification/templates/[templateId]/page.tsx   # new
src/app/(portal)/contractor/prequalification/page.tsx                                   # new
src/app/(portal)/contractor/prequalification/[submissionId]/page.tsx                    # new
src/app/(portal)/contractor/subcontractors/[subOrgId]/prequalification/page.tsx         # new
src/app/(portal)/subcontractor/prequalification/page.tsx                                # new
src/app/(portal)/subcontractor/prequalification/[contractorOrgId]/page.tsx              # new

# Components
src/components/prequal/PrequalBadge.tsx                           # new
src/components/prequal/PrequalFormRenderer.tsx                    # new
src/components/prequal/PrequalReviewPanel.tsx                     # new

# Nav + notifications
src/lib/portal-nav.ts                                             # modified (sub portal entry, contractor settings entry)
src/lib/notification-catalog.ts                                   # modified (7 new events)
src/lib/notifications/recipients.ts                               # modified (orgMembersByPortal helper)

# Jobs
src/jobs/prequal-expiry-sweep.ts                                  # new

# Tests
tests/prequal-flow.test.ts                                        # new
tests/prequal-policy.test.ts                                      # new
tests/prequal-scoring.test.ts                                     # new
```

Plus modifications to:

- The existing compliance workspace component/loader (badge column).
- The existing invitation-create UI (badge in sub picker; warn/block hook).
- The existing seed script (one prequal template + one approved submission per contractor org).
- Whichever invitation-accept route handler is wired by the hook (add `checkPrequalForAssignment` call inside the txn).
