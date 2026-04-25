# `organizations.tax_id` Encryption Plan

**Status:** Plan only — no code shipped. Review and approve before implementation begins.
**Owner:** TBD
**Estimated scope:** 1 implementation session.

This doc is the unblocker for [security_posture.md §6 `organizations.tax_id` encryption](security_posture.md#organizationstax_id-encryption). Read that entry for context — encryption was deferred pending product decisions on display masking and access policy. Both decisions are made (2026-04-25); this plan turns them into code.

---

## 1. Why now

`tax_id` is the only sensitive field still stored plaintext where encryption is feasible without major refactoring. The 2026-04-23 hardening pass deferred it pending product input on:
- How admins should see it in the UI (always full vs masked-with-reveal vs always masked)
- Who should be able to see the full value (any admin vs audit-on-reveal)
- How exports / PDFs should treat it (out of scope today; matters once W-9 / year-end-summary flows are built)

Now resolved. Encryption itself is mechanically simple — the existing AES-256-GCM helper at [src/lib/integrations/crypto.ts](../../src/lib/integrations/crypto.ts) extends cleanly with a separate key. The bulk of the work is the UI masking + reveal + audit, not the cryptography.

---

## 2. Current-state grounding (2026-04-25 audit)

| Fact | Detail |
|---|---|
| Column | `organizations.tax_id` — `varchar(40)`, nullable, no index |
| Read sites | **1** — `getOrganizationProfile()` at [src/domain/loaders/organization-profile.ts:71](../../src/domain/loaders/organization-profile.ts#L71) |
| Write sites | **1** — `PATCH /api/org/profile` at [src/app/api/org/profile/route.ts](../../src/app/api/org/profile/route.ts), gated `contractor_admin` / `subcontractor_owner` |
| Audit-event redaction | Already in place — `REDACTED_KEYS = new Set(["taxId"])` at [src/app/api/org/profile/route.ts:53-62](../../src/app/api/org/profile/route.ts#L53-L62) |
| Used in any export / PDF / search / WHERE / JOIN | **No** — grep confirms zero references in CSV builders, PDF templates, search queries |
| Encryption helper to extend | [src/lib/integrations/crypto.ts](../../src/lib/integrations/crypto.ts) — `encryptToken()` / `decryptToken()` with AES-256-GCM, base64(iv ‖ authTag ‖ ciphertext) |
| Existing key (not for reuse) | `INTEGRATION_ENCRYPTION_KEY` (32 bytes base64) |

**Critical implication:** the field is read-for-display only. There is no business logic that depends on its plaintext value at query time, and nothing prevents encrypting it. The single read path means there's exactly one decrypt call site to add. The single write path means there's exactly one encrypt call site to add.

---

## 3. Approach (decided 2026-04-25)

### 3.1 Encryption: AES-256-GCM with a dedicated key

Reuse the [src/lib/integrations/crypto.ts](../../src/lib/integrations/crypto.ts) pattern but generalize the key handling. Two paths:

- **A** — Promote the existing helper to take a key parameter: `encrypt(plaintext, key)` / `decrypt(ciphertext, key)`. Add wrapper functions per use case (`encryptIntegrationToken`, `encryptTaxId`, etc.) that pass their respective keys.
- **B** — Copy the helper into a new `src/lib/crypto/tax-id.ts` with `TAX_ID_ENCRYPTION_KEY` hardcoded. Two parallel implementations.

**Recommendation: A.** Avoids divergence drift and makes future encrypted columns trivial to add. Renaming `src/lib/integrations/crypto.ts` → `src/lib/crypto/index.ts` (or similar) is acceptable churn since there are only ~5 import sites in the integrations code.

**New env var:** `TAX_ID_ENCRYPTION_KEY` — 32 bytes, base64-encoded. Generated via `openssl rand -base64 32`. Documented in `.env.example` and [docs/specs/security_posture.md §3](security_posture.md#3-master-key-better_auth_secret) (separate-key rationale: defense in depth — a leak of `INTEGRATION_ENCRYPTION_KEY` doesn't compromise tax IDs and vice versa).

### 3.2 Display: masked-by-default with click-to-reveal + audit

**UI behavior in the org profile settings page:**
- On load, the form shows `***-**-1234` (last 4 chars of plaintext, padded `***-**-` prefix). For nullable case, shows blank with placeholder "Not set".
- A "Reveal" button next to the field exposes the full value in the input. Reveal triggers a NEW endpoint `POST /api/org/tax-id/reveal` that returns the plaintext.
- The reveal endpoint writes an audit event: `action: "tax_id.revealed"`, `resourceType: "organization"`, `resourceId: <orgId>`, with `metadata: { actorUserId, revealedAt }`. The `previousState` / `nextState` blobs do NOT carry the value (no plaintext leak in audit events).
- After 30 seconds of revealed state with no further interaction, the UI auto-collapses back to masked. (UX nicety; not a security claim — the user already saw it.)
- Editing the field works normally: clearing + retyping a new value updates as today. The PATCH endpoint encrypts on write.

**Why masked-by-default:** reduces shoulder-surfing risk in an open office; gives a paper trail of every full-value access for customer-trust auditability ("who at our SaaS provider looked at our EIN?"). The audit signal also caps insider-threat risk — if an admin starts revealing many orgs' tax IDs, the pattern is visible.

**Why a separate reveal endpoint instead of just returning plaintext in the loader:** if `getOrganizationProfile()` returned plaintext, every settings page load would need an audit event — too noisy. The reveal endpoint isolates the rare "I really need to see this" case from the common "I'm just on the settings page" case.

### 3.3 Exports / PDFs: decrypt on demand, audit per render

Forward-looking decision (no code today; documents the policy when the first export/PDF needing tax_id ships):

- CSV exports default to masked (`***-**-1234`). Admin can opt into a "with EIN" variant that decrypts and writes a per-row audit event.
- PDF generation (W-9, lien waivers, year-end summaries) decrypts on render. Single audit event per PDF render: `action: "tax_id.rendered_in_pdf"`, with `metadata: { documentType, renderedAt, recipientUserId }`.
- The audit pattern mirrors `tax_id.revealed`: actor + timestamp + context, never the value itself.

**Document this as a §6-style "when added, follow this pattern" entry in security_posture.md** so the policy isn't relitigated when the first PDF/CSV consumer arrives.

### 3.4 Schema: column type stays `varchar(40)`, ciphertext fits

Encrypted ciphertext (base64 of `iv(12) ‖ tag(16) ‖ ciphertext(N)`) for a max-40-char plaintext is roughly:
- IV (12 bytes) + tag (16 bytes) + ciphertext (≤40 bytes) = 68 bytes raw → base64 ≈ 92 chars

`varchar(40)` is **too small** for ciphertext. Two options:
- **A** Widen the column to `varchar(120)` (or just `text`) via migration. Existing plaintext rows are NULL/short and survive.
- **B** Encrypt before storage with a smaller cipher overhead (e.g. AES-CTR with shorter IV) — not recommended; loses authenticated-encryption guarantee.

**Recommendation: A.** Widen to `text` (no length limit, simpler than picking an arbitrary number). The migration is additive (no data loss).

### 3.5 Migration of existing plaintext rows

A backfill is needed: any existing `tax_id` rows are plaintext and won't decrypt against the new key.

**Pattern:** one-off SQL script via `scripts/apply-sql.ts`:
```sql
-- Pseudocode; actual script reads each row, encrypts in app code, updates.
-- Done in a Node script (scripts/backfill-encrypt-tax-id.ts), not raw SQL,
-- because the encryption happens in the app layer.
```

The backfill script:
1. Reads all `organizations` rows with non-null `tax_id`
2. For each: `encryptedValue = encryptTaxId(row.tax_id)`
3. Updates `tax_id` = `encryptedValue`
4. Writes a per-org audit event: `tax_id.encrypted_in_backfill` (no plaintext in metadata)
5. Verifies by reading back + decrypting

**Run order during deploy:**
1. Ship migration that widens column (additive, safe — old code keeps working)
2. Set `TAX_ID_ENCRYPTION_KEY` in prod env
3. Deploy app code that encrypts on new writes (and decrypts on read with a fallback: try decrypt; if it fails, treat as plaintext and re-encrypt-on-next-write — covers the brief overlap window)
4. Run the backfill script to encrypt all existing rows
5. Remove the plaintext fallback in a follow-up deploy (post-backfill)

**Decision: include the plaintext-fallback in the initial deploy?** Yes — cleanest expand-contract pattern, follows `docs/specs/rollback_strategy.md` §3a discipline. Removed in a small follow-up commit once the backfill confirms.

---

## 4. Schema changes

```typescript
// src/db/schema/identity.ts — organizations table
// Was: taxId: varchar("tax_id", { length: 40 })
// Becomes:
taxId: text("tax_id"), // ciphertext; AES-256-GCM via TAX_ID_ENCRYPTION_KEY. See docs/specs/tax_id_encryption_plan.md.
```

Also: update the comment block above the column declaration to point at this plan instead of "stored plaintext behind disk-level encryption + org-admin access policy."

Universal stop-and-ask trigger: schema change. Surface for review before applying.

---

## 5. Phases

### Phase 1 — Crypto helper + schema + env var (small)
- Generalize `src/lib/integrations/crypto.ts` to take a key parameter; add `encryptTaxId` / `decryptTaxId` wrappers
- Add `TAX_ID_ENCRYPTION_KEY` to `.env.example` with generation instructions
- Migration: widen `organizations.tax_id` from `varchar(40)` to `text`
- Update [src/lib/env.ts](../../src/lib/env.ts) Zod schema to require `TAX_ID_ENCRYPTION_KEY`
- Run `npm run build && npm run lint`

### Phase 2 — Read/write paths
- Loader [src/domain/loaders/organization-profile.ts](../../src/domain/loaders/organization-profile.ts): instead of returning plaintext `taxId`, return:
  - `taxIdMasked: "***-**-1234"` (or null)
  - `taxIdHasValue: boolean` (so the UI knows whether to render the reveal button)
  - Plaintext is NOT in the loader response.
- Write endpoint [src/app/api/org/profile/route.ts](../../src/app/api/org/profile/route.ts): on PATCH, encrypt `taxId` before update
- New endpoint `POST /api/org/tax-id/reveal`: validates admin role, decrypts, returns `{ taxId: "<plaintext>" }`, writes `tax_id.revealed` audit event
- Plaintext-fallback decrypt path: if `decryptTaxId(value)` throws (likely a plaintext leftover), treat the stored value as plaintext, re-encrypt on next write

### Phase 3 — UI: masking + reveal flow
- Settings page (4 portals — contractor admin, subcontractor owner, commercial client, residential client): replace the plaintext input with masked display + "Reveal" button + edit affordance
- Confirm the audit event lands when reveal is clicked
- Empty-state and edit-state both work

### Phase 4 — Backfill + cleanup
- One-off `scripts/backfill-encrypt-tax-id.ts` — encrypts all existing plaintext rows; idempotent (skip rows where `decryptTaxId` succeeds)
- After backfill confirms, remove the plaintext-fallback path in the loader (follow-up commit)
- Update [docs/specs/security_posture.md §2](security_posture.md#2-data-at-rest-protections-table-by-table) — move `tax_id` from "Plaintext in Postgres (deliberate)" table to "Encrypted (application-layer, AES-256-GCM)" table
- Update [docs/specs/security_posture.md §6](security_posture.md#organizationstax_id-encryption) — mark RESOLVED
- Update [docs/specs/security_posture.md §3](security_posture.md#3-master-key-better_auth_secret) — note `TAX_ID_ENCRYPTION_KEY` as a separate master key with its own rotation impact
- Update [docs/specs/compliance_map.md](compliance_map.md) — add `tax_id` to the encryption row in CC5.2

---

## 6. Failure modes + tests

| Failure mode | Test |
|---|---|
| Decrypt fails on a plaintext-leftover row before backfill completes | Loader catches the exception, returns the value as-is (treats as plaintext fallback). Test: insert a plaintext row, load org profile, verify masking still works correctly. |
| Reveal endpoint called by a non-admin | Endpoint enforces `assertCan(ctx.permissions, "organization", "write")` (or a more specific permission). Test: call as `contractor_pm`, verify 403. |
| Audit event for reveal leaks the plaintext value | The audit event's `metadata` field carries `revealedAt` + `actorUserId` only, NEVER the value. Test: read the audit row after a reveal, confirm value is absent. |
| Plaintext-fallback removed too early — pre-backfill row breaks the page | Post-backfill commit only ships AFTER a manual confirmation that all rows decrypt cleanly. Verify with: `SELECT count(*) FROM organizations WHERE tax_id IS NOT NULL` matches the count of rows that decrypt successfully. |
| `TAX_ID_ENCRYPTION_KEY` is rotated → existing rows can't decrypt | Same impact as `BETTER_AUTH_SECRET` rotation (documented in §3). Rotation requires a re-encrypt pass with old-and-new-keys both available. Note in §3 of security_posture.md. |
| Migration widens column but app deploy hasn't shipped yet → old code reads `varchar(40)` ciphertext truncated | Schema migration is `varchar(40)` → `text`, additive. Old code reading `text` as a string still works (Drizzle returns text as string regardless). No truncation since column was widened, not narrowed. |
| Backfill script run twice → re-encrypts already-encrypted rows | Idempotent: backfill tries `decryptTaxId(value)`; if it succeeds (already encrypted), skip. Test by running the script twice; second run reports zero updates. |

---

## 7. Open design questions (decide before phase 1)

1. **Helper file rename / structure.** Promote `src/lib/integrations/crypto.ts` to `src/lib/crypto/index.ts` (or similar)? Recommendation: **keep `src/lib/integrations/crypto.ts`** as the home for now — rename only if a third encrypted column appears. Add `encryptTaxId` / `decryptTaxId` as exports from the same file with a comment delineating the "for tax_id" section.
2. **Reveal cooldown.** Should we limit how often an admin can hit `POST /api/org/tax-id/reveal` (e.g. 5/min via `@upstash/ratelimit`)? Recommendation: **yes**, defend against script-driven enumeration. Use the same ratelimit infra as the auth endpoints.
3. **Sub-org tax_id.** Subcontractor orgs and client orgs also have `tax_id` (same column). The reveal pattern applies uniformly; the audit event's `resourceId` is the org id regardless of org type. Confirm in phase 2 that all 4 portal settings pages render the masked field correctly.
4. **`text` vs `varchar(120)` for the widened column.** Recommendation: **`text`** (simpler, no arbitrary cap). Postgres' `text` and `varchar` have identical performance; the cap was a UX/UI signal, not a storage one.
5. **Should writes also audit?** Today the write writes an audit event with the value redacted. After encryption, this stays the same — just the encrypted value passes through the redaction step instead of the plaintext. No change. Confirm in phase 2.

---

## 8. Non-goals (explicit)

- **Encrypting other org fields.** This sprint covers `tax_id` only. If `phone`, `addressLine1`, etc. should be encrypted too, that's a separate scope decision; not pre-deciding here.
- **Searching by tax_id.** Encrypted columns can't be `WHERE` filtered without deterministic encryption (which this AES-256-GCM scheme is not — IV is random). No business case for searching, so no-op.
- **Field-level access for non-admins.** Today, only `contractor_admin` / `subcontractor_owner` can see the org profile at all (the loader is gated). This sprint preserves that gate; doesn't add a separate "view but not edit" role.
- **Bulk export with full tax IDs.** Forward-looking exports (§3.3) decrypt on demand and audit. No batch decrypt in this sprint.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Backfill silently misses rows (e.g. a row added during backfill window) | Run backfill twice; second run should report zero. Audit event count should equal the row count. |
| Reveal endpoint becomes a vector for enumeration | Rate-limit (§7 question 2) + audit signal makes pattern visible. |
| Separate-key model adds operational complexity | Documented in security_posture.md §3 alongside `BETTER_AUTH_SECRET` and `INTEGRATION_ENCRYPTION_KEY`. The trade-off favors defense-in-depth over single-key simplicity. |
| UI regression — masked field looks broken to users who don't know about reveal | Phase 3 includes a small inline help text next to the field: "Hidden for security. Click Reveal to see the full ID." |
| First PDF/CSV consumer that needs tax_id forgets the audit pattern | Phase 4 documentation step adds the §6 forward-looking entry. |

---

## 10. Definition of done

The sprint is complete when:
1. `organizations.tax_id` is encrypted at rest with AES-256-GCM via `TAX_ID_ENCRYPTION_KEY`
2. UI shows masked value by default; reveal flow works and writes an audit event
3. PATCH writes encrypt; reads decrypt transparently in the loader (or stay masked depending on which path is taken)
4. Backfill script run successfully against all environments; zero plaintext rows remain
5. Plaintext-fallback path removed in a follow-up commit after backfill confirmation
6. `security_posture.md §2` has `tax_id` moved to the encrypted column table
7. `security_posture.md §6` `tax_id` entry marked RESOLVED
8. `security_posture.md §3` documents `TAX_ID_ENCRYPTION_KEY` as a separate master key with its own rotation story
9. `compliance_map.md` CC5.2 lists `tax_id` alongside the existing OAuth-token + 2FA-secret encryption
10. No regressions in the existing org-profile flows across all 4 portals
