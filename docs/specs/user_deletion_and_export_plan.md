# User Deletion + GDPR Article 15 Export Sprint Plan

**Status:** Plan only — no code shipped. Review and approve before any phase begins.
**Owner:** TBD
**Estimated scope:** 2 implementation sessions (deletion first, then export). They ship together — the user-facing settings page should expose both at once or neither.

This doc is the unblocker for [compliance_map.md Privacy P4 + P5](compliance_map.md) and [security_posture.md §8 Identity gaps](security_posture.md). Read those entries first for context — both are listed as blockers for EU/CA launch.

---

## 1. Why now

Two paired compliance gaps:

- **P4 (use, retention, disposal):** No user-initiated account deletion. EU users have an enforceable "right to erasure" (GDPR Article 17); CA's CCPA has equivalent "right to delete." Without a self-serve flow, the only path is `support@builtcrm.com` → manual ops, which doesn't scale and is the wrong default.
- **P5 (access to personal info):** No "export my data" flow. GDPR Article 15 requires the data subject can obtain a copy of all personal data we hold on them, "without undue delay" and at no cost.

Both are listed as **the primary blocker for CA/EU launch** in compliance_map.md. Shipping them unblocks that market without forcing a customer-by-customer manual process.

The trade-off this plan navigates: GDPR's "right to erasure" wording ("without undue delay") sits in tension with construction PM's legitimate-interest retention obligations. RFI creators, lien waiver signers, change-order originators, and similar contractually-immutable identities are protected by 39 RESTRICT FKs in the current schema. Hard-deleting a user would either break that audit chain (if FKs become SET NULL) or fail at the DB layer (if they stay RESTRICT).

**Resolution: anonymize, don't hard-delete.** Replace the user's identifying fields with non-identifying tombstones; keep the row + all its inbound references for legal continuity. This is the standard interpretation for systems with legitimate-interest retention (financial services, construction PM, medical records all do this).

---

## 2. Current-state grounding (2026-04-25 audit)

| Fact | Number / detail |
|---|---|
| FKs on `users.id` total | 92 across 28 schema files |
| FKs RESTRICT (block hard delete) | **39** — RFI/CO/lien-waiver creators, draw-request reviewers, closeout sign-off, etc. |
| FKs SET NULL (already drop reference on delete) | 45 — soft-revocable links (project memberships, invitation acceptors, etc.) |
| FKs CASCADE (purge on delete) | 8 — personal data only (notification prefs, role assignments, org memberships) |
| Tables holding user-attributable data (for export) | ~45–55 — user OWNS some (profile, preferences); user APPEARS IN others (audit, messages, attribution fields) |
| Existing delete endpoint | [src/app/api/user/delete/route.ts](../../src/app/api/user/delete/route.ts) — stub returning 501 |
| Existing org-level export infrastructure | [src/db/schema/exports.ts](../../src/db/schema/exports.ts) `dataExports` table + Trigger.dev job pattern. Org-scoped only — not directly reusable but the queue + job mechanism transfers cleanly. |
| Better Auth ↔ domain user link | `authUser.appUserId` is **not** a FK constraint. Deleting a `users` row does NOT cascade into Better Auth — manual `UPDATE auth_user SET app_user_id = NULL WHERE app_user_id = $1` required, otherwise the Better Auth row ghosts and sessions stay valid until token expiry. |

**Critical implication for design:** the 39 RESTRICT FKs are not a bug — they're a contractual requirement. The schema comments in `billing.ts`, `workflows.ts`, `closeoutPackages.ts` explicitly say creator identity must survive user departure for warranty / lien / dispute purposes. The chosen approach must preserve those references.

---

## 3. Approach (decided 2026-04-25)

### 3.1 Deletion: anonymize with 30-day grace period

**User flow:**
1. User clicks "Delete my account" in settings.
2. Modal: re-authentication required (re-enter password). Reason: deletion is destructive enough that a logged-in-but-unattended browser shouldn't be able to trigger it.
3. Confirmation email sent with a one-time tokenized "Cancel deletion" link valid for 30 days.
4. User's `users` row gets a new `pendingDeletionAt: timestamp` flag set to `now() + interval '30 days'`. Account is immediately signed out everywhere; sessions revoked. UI behavior: subsequent login attempts show "This account is pending deletion. [Cancel deletion?] [Sign out]"
5. After 30 days, a daily Trigger.dev job (`account-anonymization-sweep`) finds all rows where `pendingDeletionAt < now()` and anonymizes them.

**Anonymization payload (run inside a transaction):**
- `users.email` → `deleted-{uuid}@anonymized.local` (uuid is the user's existing id, so the value stays unique and deterministic)
- `users.displayName` → `Deleted User`
- `users.avatar`, `phone`, `title`, `theme`, `timezone`, `language` → NULL
- `users.isActive` → `false`
- `users.pendingDeletionAt` → NULL (state advances to "deleted")
- `users.deletedAt` → `now()` (new column, see §3.3)
- CASCADE-delete fires on the 8 CASCADE FKs (notification prefs, role assignments, org memberships)
- SET NULL fires on the 45 SET NULL FKs (soft-revocable links nullified)
- The 39 RESTRICT FKs still point at the now-anonymized `users` row → audit trail preserved, identity scrubbed
- `UPDATE auth_user SET app_user_id = NULL WHERE app_user_id = '<uuid>'` (manual step — Better Auth doesn't FK us)
- Better Auth: revoke any remaining sessions via `auth.api.revokeUserSessions()`
- Audit event: `user.account_anonymized` with `previousState: { email, displayName }` redacted to `{ email: "<redacted>", displayName: "<redacted>" }` and `metadata: { deletionRequestedAt, completedAt, requestedByUserId }`. The audit row references `actorUserId = SYSTEM_USER_ID` since the job runs system-side.

**Cancel-deletion flow:**
- Tokenized link → token verified (SHA-256 hashed at rest, like invitations) → `pendingDeletionAt` set to NULL → user can sign in again normally.

### 3.2 Export: Trigger.dev job + R2 download

**User flow:**
1. User clicks "Export my data" in settings.
2. Modal: re-authentication. Confirmation: "We'll prepare your export and email you a download link within 24 hours."
3. New row in `dataExports` table: `exportKind: 'user_data_gdpr'`, `requestedByUserId`, `status: 'queued'`.
4. Trigger.dev job (`user-data-export`) picks it up:
   - Gathers from ~45–55 tables. Two query passes:
     - **OWNS pass:** profile, preferences, saved reports, drawing markups (rows where `userId` is the primary owner)
     - **APPEARS IN pass:** audit events, messages, daily logs, meetings, notifications, billing/workflow/closeout attributions (rows where the user is referenced as actor / participant / sender)
   - Composes a JSON manifest (`{ schemaVersion: "1.0", generatedAt, userId, sections: { profile, preferences, audit, messages, ... } }`) + per-table CSVs.
   - Zips the bundle, uploads to R2 at key `gdpr-exports/{userId}/{exportId}.zip`.
   - Generates a presigned download URL valid for 7 days.
   - Updates `dataExports.status: 'ready'`, `dataExports.storageKey`, `dataExports.completedAt`.
   - Emails the user a download link with the 7-day expiry.
5. User downloads. After 7 days, the R2 key is deleted by the existing R2-orphan cleanup (when 1.6 ships) or by an explicit `dataExports`-driven cleanup job added in this sprint.

**Why this pattern:** reuses the `dataExports` table + Trigger.dev job queue that org-level exports already use. The payload composition is brand-new (45–55 tables of user-attributable data), but the queue + state machine + audit-event-on-completion patterns are proven.

### 3.3 Schema changes

Two columns added to `users`:

```typescript
// src/db/schema/identity.ts — users table
pendingDeletionAt: timestamp("pending_deletion_at", { withTimezone: true }),
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

One enum value added to `dataExports.exportKind`:

```typescript
export const dataExportKindEnum = pgEnum("data_export_kind", [
  // ... existing values ...
  "user_data_gdpr",
]);
```

Universal stop-and-ask trigger: schema changes. Both must be reviewed before phase 1 starts.

### 3.4 Anonymization job: `src/jobs/account-anonymization-sweep.ts`

- Daily schedule (e.g. 05:00 UTC, after the 04:30 retention sweeps)
- Predicate: `pendingDeletionAt < now()`
- Each user processed in its own transaction (one anonymization failure doesn't block others)
- Audit event per user
- Batch summary audit event at the end (`account-anonymization-sweep.run_complete` with `anonymizedCount`)

### 3.5 Re-authentication helper

Both flows require re-authentication before kicking off destructive work. Better Auth's `freshAge` config (already pinned at 24h in [src/auth/config.ts](../../src/auth/config.ts)) supports this — sensitive operations check the session's age and reject if it's been more than 24h since password entry. The deletion flow forces a password re-prompt regardless.

A small helper in `src/auth/session.ts` to check `session.createdAt > now() - freshAge` and prompt for re-auth if not.

---

## 4. Failure modes + tests

| Failure mode | Test |
|---|---|
| User cancels deletion mid-grace, but a sub-system fails to clear `pendingDeletionAt` | Cancel flow is a single SQL `UPDATE`. Test: set the flag, fire the cancel endpoint, verify flag is NULL. |
| Anonymization job runs partway, fails, leaves user half-deleted | Each user processed in its own transaction (rollback on failure). Test: simulate failure mid-anonymization, verify all-or-nothing. |
| Better Auth session ghosts after anonymization (because `appUserId` link nullify is missed) | Test: anonymize user, attempt to use a previously-issued session token, verify 401. |
| Export job times out for a heavy user (years of audit events) | Test: seed a user with 100k audit events; verify export completes within Trigger.dev's max duration (10min); if not, paginate the export across multiple job runs. |
| Export bundle leaks tenant data (a user's audit events reference projects across orgs they no longer have access to) | Test: anonymize / remove user from one org, verify export only includes data from orgs the user STILL has access to OR explicitly scope the export to the user's CURRENT memberships. Decision: scope to current memberships; legal interpretation favors "what we hold on you right now". |
| 30-day grace expires while user is on vacation | Email reminder sent at day 23 (one week before anonymization). Cancel link still works up to the moment the job runs. |
| Race: user clicks cancel at the moment the anonymization job is processing them | Job fetches `pendingDeletionAt` inside the transaction; if it's NULL or in the future, skip. Test: simulate the race. |
| GDPR export bundle includes another user's PII (e.g. messages where deleted-user wrote a message ABOUT another user) | The export should include the message *content* the user authored, but not other users' profile data. Verify by inspection of the bundle for one seeded user. |

---

## 5. Phased rollout

### Phase 1 — Schema + deletion (1 session)

**Deliverables:**
- Migration: add `users.pendingDeletionAt` and `users.deletedAt` columns
- Migration: add `'user_data_gdpr'` to `dataExportKindEnum` (set up for phase 2)
- New endpoint `POST /api/user/delete` — accepts re-auth, sets `pendingDeletionAt`, sends confirmation email, revokes sessions
- New endpoint `GET /api/user/cancel-deletion` (tokenized) — clears `pendingDeletionAt`
- New job `src/jobs/account-anonymization-sweep.ts` — daily, anonymizes users past their grace period
- New job `src/jobs/deletion-reminder-sweep.ts` — daily, emails users at day 23 of grace
- UI: settings page surfaces "Delete my account" with re-auth modal + confirmation
- UI: login flow detects `pendingDeletionAt` set and offers cancel-deletion shortcut
- Audit events for: deletion requested, deletion canceled, deletion completed (anonymization)
- Update [docs/specs/security_posture.md §6](security_posture.md) and [docs/specs/compliance_map.md](compliance_map.md) — mark P4 RESOLVED

**Stop-and-ask triggers:**
- `db/schema/identity.ts` (universal trigger — schema change)
- New `src/jobs/` files (no trigger, but worth surfacing the new scheduled cron times)
- Email infrastructure: this is the first user-facing transactional email. Today the password-reset flow logs to console (dev stub per [src/auth/config.ts](../../src/auth/config.ts)). Phase 1 needs a real SMTP provider OR explicit deferral that emails-are-noop in dev.

**Verification:**
- Manual: trigger deletion, confirm pendingDeletionAt set, sign out occurs, sign in shows cancel banner, cancel works, deletion 30d later anonymizes correctly
- All failure-mode tests in §4 pass
- `npm run build && npm run lint` clean

### Phase 2 — Export (1 session)

**Deliverables:**
- New endpoint `POST /api/user/data-export` — accepts re-auth, queues a `dataExports` row, returns the export id
- New endpoint `GET /api/user/data-export/:id/status` — polls status (queued / running / ready / failed)
- New job `src/jobs/user-data-export.ts` — gathers from ~45–55 tables, composes JSON + CSVs, uploads to R2, presigns URL, sends email
- New job `src/jobs/data-export-cleanup.ts` — daily, deletes R2 keys for `dataExports` rows older than 7d (this also serves the org-level exports' retention need — drop the existing per-export TTL if any)
- UI: settings page surfaces "Export my data" with re-auth modal
- UI: list of past export requests with status + download link (when ready)
- Audit events for: export requested, export completed, export downloaded

**Stop-and-ask triggers:** None new (schema already migrated in phase 1).

**Verification:**
- Seed a user with realistic data (mix of profile, audit events, messages, attribution rows)
- Trigger export, verify all expected tables appear in bundle
- Verify bundle does NOT include other users' PII
- Verify R2 cleanup runs after 7d
- All failure-mode tests in §4 pass

### Phase 3 — Documentation + polish (0.25 session)

- Update `docs/specs/security_posture.md` Identity row — note the new self-serve deletion + export
- Update `docs/specs/compliance_map.md` — mark P4 + P5 RESOLVED
- Update `CLAUDE.md` if any new conventions emerged

---

## 6. Open design questions (decide before phase 1)

1. **Email infrastructure for phase 1.** The deletion confirmation + cancel-link + day-23 reminder need real email. Today the only email path (password reset) logs to console. Options:
   - **A** Wire up Postmark / SendGrid (catalog entries already exist in `src/lib/integrations/registry.ts`). Pulls a real provider into the loop.
   - **B** Defer email to phase 1.5 — phase 1 ships with deletion confirmed via in-app UI only (no out-of-band confirmation). Less safe.
   - **C** Use Better Auth's `sendResetPassword` console-log as a stub for dev; phase 1 explicitly defers prod email until after the SMTP provider is live.
   Recommendation: **C** for phase 1 (don't block on email infra), **A** as a follow-up before EU/CA launch since the regulatory requirement assumes real email delivery.

2. **Export bundle format.** JSON manifest only, or also per-table CSVs? Recommendation: both. JSON for completeness, CSVs for human-readable inspection.

3. **Export scope: current vs historical orgs.** If a user was a member of org A in the past but is no longer, do we include audit events from org A in the export? GDPR favors "all data we hold on you" → yes. But that includes data the user can no longer see in the app. Recommendation: include all orgs the user has EVER had a `roleAssignments` row for; explicitly note in the bundle README which orgs the data spans.

4. **Pending-deletion sign-in behavior.** Block sign-in entirely (force them to use the cancel link), or allow sign-in with a banner offering to cancel? Recommendation: **block sign-in.** Reduces footgun risk (logging in could create new audit events that survive anonymization).

5. **Grace period length.** 30 days is the default. Some interpretations (Google, Apple) use 30; some (Meta) use 14; some compliance consultants recommend 7. Recommendation: **30 days** (most user-friendly, matches industry baseline).

6. **What happens if the LAST owner of an org clicks delete?** Today's policy matrix in `src/domain/permissions.ts` doesn't prevent this. After anonymization, the org has no admin → no one can manage it. Options:
   - **A** Block deletion if the user is the sole owner of any org. Force them to transfer ownership first.
   - **B** Allow deletion; the org becomes orphaned and ops has to handle it.
   - **C** Soft-delete the org alongside (cascade the user-deletion intent).
   Recommendation: **A** — it's the only interpretation that preserves the org's usability for invited collaborators (subs, clients).

---

## 7. Non-goals (explicit)

- **True hard-delete.** Not feasible without breaking 39 RESTRICT FKs and the construction-contract audit chain. Anonymization is the chosen interpretation.
- **Anonymization of audit-event metadata content.** If a user's name appears inside another audit event's `metadata_json` blob (e.g. "User X assigned RFI to User Y"), that text isn't scrubbed. Scope-limited to the structured `actor_user_id` FK references. Trade-off: completeness vs feasibility.
- **R2 file deletion.** Files the user uploaded (`documents`, `daily_log_photos`, etc.) keep their R2 keys after anonymization — same long-tail-compliance reasoning as the 39 RESTRICT FKs. The R2-orphan-cleanup work (deferred §6) handles this separately.
- **Export of raw R2 file contents.** GDPR Article 15 covers personal data the data controller holds. Photos uploaded to a project are arguably the org's data, not the user's. Export bundle includes file METADATA (uploadedAt, fileName, size, R2 key) but not the file bytes themselves. If the user wants the bytes, they download them via the app's normal flow while still a member.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| User clicks delete by accident, doesn't notice the cancel email | 30-day grace + day-23 reminder email + in-app banner on every sign-in attempt during the grace window. |
| Anonymization breaks a query that assumed `users.email` is a real email | Audit query patterns in phase 1: `SELECT email FROM users WHERE email LIKE '%@%'` etc. Most queries should be FK joins, not email LIKE; verify. |
| Export bundle leaks tenant data | Failure-mode test in §4. Manual review of the first generated bundle. |
| R2 cost growth from never-downloaded export bundles | 7-day TTL via `data-export-cleanup` job. |
| Last-owner deletion creates an orphan org | Phase 1 deliverable enforces "block delete if sole owner" per §6 question 6. |
| Better Auth's `sendResetPassword` console-log stub doesn't notice when email infrastructure is needed for deletion confirmations | Phase 1 surfaces this as a known limitation; add a runtime check that warns if `EMAIL_PROVIDER` env var is unset and the deletion endpoint is hit. |

---

## 9. Definition of done

The sprint is complete when:
1. User can self-serve initiate account deletion from settings; confirmation email + 30-day grace + cancel link all work end-to-end
2. After 30 days, anonymization job completes with all FKs preserved (RESTRICT) and personal data scrubbed
3. User can self-serve request a data export from settings; receives email with 7-day download link; bundle is JSON + zipped CSVs
4. Failure-mode test suite (§4) is green
5. Sole-owner deletion is blocked with a clear "transfer ownership first" message
6. `security_posture.md §6` Identity gap entry and `compliance_map.md` Privacy P4 + P5 marked RESOLVED
7. No new RESTRICT FKs introduced; the construction-contract audit chain is intact
8. Email infrastructure decision documented (real provider or explicit deferral)
