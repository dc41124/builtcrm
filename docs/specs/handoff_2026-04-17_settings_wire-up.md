# Handoff — Settings wire-up session (2026-04-17)

## Summary

This session wired the settings area across all 4 portals end-to-end, except for 4 tabs that hit architectural blockers (Stripe Billing, Data exports, SSO/SAML, Stripe Checkout for client payments — each needs its own dedicated phase). 8 commits of work shipped on top of the pre-existing shared `SettingsShell`. Three schema migrations applied.

## What's live now

**All 4 portals share the same `SettingsShell`** (`src/components/settings/settings-shell.tsx`). Tabs are gated per portal via `view.portalType`.

| Portal | Live tabs | Static / blocked |
|---|---|---|
| Contractor | Profile, Security, Notifications, Appearance, Organization, Team & roles, Integrations, Payments, Org security (domain lock + audit log) | Plan & billing (🔴), Data (🔴), SSO + Require-2FA (🔴), Session-timeout enforcement (🟡) |
| Subcontractor | All 6 tabs | None — fully wired |
| Commercial | Profile, Security, Notifications, Appearance, Company, Team members | Payment methods (🔴) |
| Residential | Profile, Security, Notifications, Appearance, Household profile, Co-owner access | Payment methods (🔴) |

Full per-tab status + blockers are tracked in the **Settings Wiring Backlog** section at the end of `docs/specs/phase_4plus_build_guide.md`.

## Commits in this session (not yet committed to git)

Commits numbered for readability — each corresponds to a conceptual unit; actual `git log` entries are up to the user.

| # | Scope | Files |
|---|---|---|
| 1 | **Schema migration 0001** — Organization settings fields (22 nullable cols on `organizations`) + `organization_licenses` + `organization_certifications` tables | `src/db/schema/identity.ts`, `src/db/migrations/0001_org_settings_fields.sql` |
| 2 | **Contractor Organization tab live** — `getOrganizationProfile` loader + `PATCH /api/org/profile` (tax_id redacted in audit) + logo presign/finalize + licenses CRUD routes + `ContractorOrganizationLiveTab` | `src/domain/loaders/organization-profile.ts`, `src/app/api/org/profile/*`, `src/app/api/org/logo/*`, `src/app/api/org/licenses/*`, settings-shell.tsx |
| 3 | **Subcontractor Organization tab live** — reuses all commit-2 routes with sub-specific fields + sub-specific logo gradient | Sub page.tsx, settings-shell.tsx |
| 4 | **Subcontractor certifications + trade summary live** — `POST/DELETE /api/org/certifications*` routes, trade summary reads from real `orgProfile`, sub compliance snapshot pulls carrier/coverage from `metadata_json` | `src/app/api/org/certifications/*`, `src/domain/loaders/subcontractor-compliance.ts`, settings-shell.tsx |
| 5 | **Schema migration 0002** — `organizations.allowed_email_domains`, `organizations.session_timeout_minutes`, `compliance_records.metadata_json` + `PATCH /api/org/security` route + domain-lock enforcement in `POST /api/invitations` + audit log reads real `auditEvents` | `src/db/schema/identity.ts`, `src/db/schema/workflows.ts`, `src/db/migrations/0002_org_security_and_compliance_metadata.sql`, `src/app/api/org/security/route.ts`, `src/domain/loaders/audit-log.ts`, `src/lib/audit-categories.ts`, settings-shell.tsx |
| 6 | **Commercial + residential portal tabs (UI, sample data)** — 3 tabs each: Company/Team/Payment methods (commercial), Household/Co-owner/Payment methods (residential). Shared `ClientMembersPanel` + `ClientPaymentMethodsTab` (variant-gated) | settings-shell.tsx |
| 7 | **Commercial + residential team tabs live** — `getCommercialClientOrgContext` + `getResidentialClientOrgContext` loaders + generic `resolveOrgOwnerContext` / `requireOrgAdminContext` helpers + all `/api/org/members/*` + `/api/org/invitations/*` + `/api/invitations` routes generalized to accept any portal-owner + `ClientTeamLiveTab` shared between both client portals | `src/domain/loaders/client-context.ts`, `src/domain/loaders/org-owner-context.ts`, all member/invitation routes, commercial + residential page.tsx, settings-shell.tsx |
| 8 | **Schema migration 0003** — 10 nullable cols for commercial (`industry`, `company_size`, `invoice_delivery`) + residential (`project_name`, `preferred_name`, `preferred_channel`, `preferred_time`, `emergency_name`, `emergency_relation`, `emergency_phone`) + `CommercialCompanyLiveTab` + `ResidentialHouseholdLiveTab` using the shared `/api/org/profile` + logo routes | `src/db/schema/identity.ts`, `src/db/migrations/0003_client_profile_fields.sql`, `src/app/api/org/profile/route.ts`, `src/domain/loaders/organization-profile.ts`, commercial + residential page.tsx, settings-shell.tsx |

## Uncommitted file status (end of session)

```
 M src/app/(portal)/commercial/(global)/settings/page.tsx
 M src/app/(portal)/residential/(global)/settings/page.tsx
 M src/app/api/invitations/route.ts
 M src/app/api/org/invitations/[id]/resend/route.ts
 M src/app/api/org/invitations/[id]/route.ts
 M src/app/api/org/members/[userId]/role/route.ts
 M src/app/api/org/members/[userId]/route.ts
 M src/app/api/org/profile/route.ts
 M src/components/settings/settings-shell.tsx
 M src/db/schema/identity.ts
 M src/domain/loaders/organization-members.ts
 M src/domain/loaders/organization-profile.ts
?? src/db/migrations/0003_client_profile_fields.sql
?? src/domain/loaders/client-context.ts
?? src/domain/loaders/org-owner-context.ts
```

Plus uncommitted files from prior sessions (see git status for full list). Build is clean: `npm run build` → ✅ compiled successfully.

## DB migrations applied this session

All three applied against the shared Neon DB. Schema TS + migration SQL are both in source.

1. [0001_org_settings_fields.sql](../../src/db/migrations/0001_org_settings_fields.sql) — 22 org cols + licenses + certifications tables
2. [0002_org_security_and_compliance_metadata.sql](../../src/db/migrations/0002_org_security_and_compliance_metadata.sql) — domain lock + session timeout + compliance metadata_json
3. [0003_client_profile_fields.sql](../../src/db/migrations/0003_client_profile_fields.sql) — commercial + residential client profile fields

## Remaining architectural blockers

Each is its own multi-session phase — do not attempt incrementally:

1. **Stripe Billing** — contractor Plan & billing tab. Distinct from Stripe Connect (already wired). Needs `subscription_plans` / `organization_subscriptions` / `subscription_invoices` / `stripe_customers` tables + webhook handlers + customer-portal URL flow. Gated behind the Phase 4+ portfolio scope's Billing phase.
2. **Data exports (contractor Data tab)** — needs Trigger.dev v3 export jobs + R2 ZIP streaming + `data_exports` tracking table. Memory note: Trigger.dev v4 upgrade deferred between phases. Procore/Buildertrend imports are V2+ (OAuth partnership-gated).
3. **SSO / SAML (contractor Org security)** — needs `sso_providers` + `sso_mappings` tables + SAML handler routes + Better Auth SAML plugin + Enterprise-tier gating. Depends on Billing.
4. **Stripe Checkout for client draw payments (commercial + residential Payment methods)** — parallel to Stripe Billing but for *clients paying draws*. Needs client-side PaymentMethod storage + Checkout session creation + webhook handling for completed payments. Separate from both Stripe Connect and Stripe Billing.
5. **Session-timeout enforcement (contractor Org security)** — preference stores fine; Better Auth is globally configured and per-org TTL needs a session-lifecycle hook. Small follow-up, could be done standalone.

See the **Settings Wiring Backlog** section at end of `phase_4plus_build_guide.md` for per-blocker detail.

## Small follow-ups (< 1 hour each, not blocking)

- **License edit UI** — the `PATCH /api/org/licenses/[id]` route exists and is authed; the Edit button on license rows in both contractor + sub org tabs just needs an inline-edit mode wired.
- **Audit log CSV export** — streaming CSV endpoint over the existing `listOrganizationAuditEvents` filter. Button in Org Security tab currently no-ops.
- **"Open Compliance" deep-link** — sub compliance tab has a button that should navigate to the sub compliance workspace. Route target: `/subcontractor/project/[projectId]/compliance`, but the sub settings tab is project-agnostic — decide on UX (pick first assigned project? show a picker?).
- **Trigger.dev email job for invitations** — currently logs invite URL. When an email provider (Postmark/SendGrid) is wired, replace the stub in `POST /api/invitations`.
- **Orphan route cleanup** — `src/app/(portal)/contractor/(global)/settings/{integrations,payments,organization,team,invitations}/` routes still exist from pre-shell days. Still reachable by direct URL but not linked. User deferred deletion; drop when confident nothing references them.

## Kickoff prompt for next session

```
Continuing BuiltCRM. Last session shipped the settings wire-up across all 4
portals (Steps 9–12 marked done; 3 schema migrations applied). Backlog for
remaining settings blockers is in the "Settings Wiring Backlog" section of
docs/specs/phase_4plus_build_guide.md.

Current state:
- Contractor: 9/13 tabs live; blocked on Plan & billing, Data, SSO, 2FA
- Subcontractor: fully wired
- Commercial: 6/7 tabs live; blocked on Payment methods (Stripe Checkout)
- Residential: 6/7 tabs live; blocked on Payment methods (Stripe Checkout)

Uncommitted: 12 modified files + 3 new files covering commits 1–8 of the
settings wire-up. Build is clean.

Before starting the next phase, consider:
1. Committing the settings wire-up as a series of focused commits (one per
   schema migration / feature) — the handoff doc at
   docs/specs/handoff_2026-04-17_settings_wire-up.md has the list.
2. Deciding the next target phase: Billing phase (unblocks Plan & billing +
   Require-2FA + SSO dependencies), Exports phase (unblocks Data tab), or
   Payment-from-client phase (unblocks both client portals' Payment methods).

Re-read:
- docs/specs/builtcrm_phase4_portfolio_scope.md (source of truth for scope)
- docs/specs/phase_4plus_build_guide.md (step-by-step execution, including
  the Settings Wiring Backlog)
- This handoff doc for what's in-flight

What phase would you like to tackle next?
```

## Context references

- **Backlog doc** (comprehensive, tab-by-tab):
  `docs/specs/phase_4plus_build_guide.md` → § "Settings Wiring Backlog"
- **Scope doc**: `docs/specs/builtcrm_phase4_portfolio_scope.md`
- **Per-portal JSX specs** (source of truth for UI):
  - `docs/specs/builtcrm_contractor_settings.jsx`
  - `docs/specs/builtcrm_subcontractor_settings.jsx`
  - `docs/specs/builtcrm_commercial_client_settings.jsx`
  - `docs/specs/builtcrm_residential_client_settings.jsx`
- **Live data loaders added this session**:
  - `src/domain/loaders/organization-profile.ts` — org profile + licenses + certifications
  - `src/domain/loaders/organization-members.ts` — portal-aware member list + admin count
  - `src/domain/loaders/audit-log.ts` + `src/lib/audit-categories.ts` — audit log with derived categories
  - `src/domain/loaders/subcontractor-compliance.ts` — sub compliance snapshot with metadata
  - `src/domain/loaders/client-context.ts` — commercial + residential client org contexts
  - `src/domain/loaders/org-owner-context.ts` — generic portal-owner resolver (tries all 4 portals)

*End of handoff.*
