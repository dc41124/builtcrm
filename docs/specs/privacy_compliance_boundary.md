# Privacy / Law 25 — Compliance Boundary

**Phase 4+ · Phase 9-lite · Item 9-lite.1 #65**
**Authored:** 2026-05-01

This document defines what the Step 65 privacy surface does, what it
deliberately does *not* do, and where the boundary between product
features and organizational compliance falls. It exists because Quebec
Law 25 (Loi 25), PIPEDA, and the GDPR are organizational regimes —
real compliance lives in policies, processes, training, and human
judgment, not in any UI.

If you're shipping work that touches the privacy surface, read this
first. The shape of the boundary informs what we will and will not
build.

---

## What the product does

The Step 65 surface gives an organization the **product affordances**
needed to discharge Law 25 obligations. Specifically:

- **Public Privacy Policy** at `/privacy` — discloses what we collect,
  how we use it, and the rights data subjects have. Static content,
  reviewed by counsel before any material change.
- **Public Privacy Officer page** at `/privacy/officer` — names the
  designated Privacy Officer and how to reach them. Listing the officer
  publicly satisfies Law 25 §3.1.
- **Public DSAR intake** at `/privacy/dsar` — anyone can submit an
  access / rectification / deletion / portability request without a
  BuiltCRM account. Submission writes a row to `dsar_requests` with a
  30-day SLA timer.
- **Privacy Officer admin** (contractor portal → Settings → Privacy &
  Law 25) — DSAR queue, consent register, breach register. Lets the
  designated officer triage requests, audit consent state, and log
  incidents.
- **End-user consent manager** (any portal → Settings → Privacy &
  consents) — preferences toggles, consent history timeline, in-product
  DSAR shortcuts for logged-in users.
- **Audit trail** — every state-changing action on this surface
  (officer designation, DSAR status transitions, consent grant/revoke,
  breach lifecycle) writes an audit event.

That's the surface area. Everything below the line is organizational
work that lives outside the product.

---

## What the product deliberately does NOT do

These are not gaps to fill in a future sprint. They are deliberate
non-features. Building them inside the product would either give a
false sense of compliance or duplicate work that has to happen outside
the product anyway.

### CAI (Commission d'accès à l'information) breach notification

The breach register has a `reported_to_cai_at` column. **This column
is informational only.** Setting it does not transmit anything to the
CAI. Real CAI notification requires a regulator account, an upload of
the official incident form, and follow-up correspondence with a CAI
investigator — none of which we model.

The expected flow is:

1. The Privacy Officer logs a breach in the register (containment, scope,
   data types, etc.).
2. If the breach meets Law 25 §3.5 thresholds (incidents likely to cause
   serious harm), the Privacy Officer files the report directly with
   the CAI **outside the product**.
3. Once filed, the Privacy Officer marks `reported_to_cai_at` in the
   register as the date of filing, for our internal audit trail.

We do not auto-prompt the officer to file. We do not have logic that
classifies a breach as "must report" — that's a judgment call the
officer makes.

### User-facing breach notification email — drafts only, no auto-send

When a breach is marked to notify affected users, the system generates
**draft emails** for the Privacy Officer to review. Drafts are not sent
automatically. The officer reviews, edits, and sends each draft (or
a batch) via the existing transactional email path.

Rationale: breach-notification copy is high-stakes, bespoke per incident,
and frequently reviewed by counsel before going out. Auto-sending would
deny the officer the chance to redact, soften, or escalate.

### Identity verification on DSAR requests

Public DSAR submissions include the requester's claim that they are the
data subject (or their authorized representative). The product does
**not** automate identity verification. The Privacy Officer is expected
to request additional proof out-of-band (driver's license, utility bill,
notarized authorization for representatives) when the request is high-
sensitivity (deletion, full export of historical project data).

This matches industry practice — automating identity verification at
intake creates a false negative problem (legitimate subjects rejected)
and a false positive problem (impersonators accepted) that is worse
than the manual review path.

### Privacy-impact assessments (PIAs)

Law 25 §3.3 requires a PIA before any new feature, integration, or
cross-border transfer that materially changes personal-information
handling. We do not surface a PIA workflow in the product — PIAs are
authored as documents (per-project), reviewed by the Privacy Officer,
and stored in the company's compliance archive. The Privacy Officer
page mentions this responsibility, but the artifact itself is a
document, not a UI.

### Cross-jurisdictional rights (e.g. EU GDPR, California CCPA/CPRA)

The DSAR intake form lists Quebec, Ontario, BC, Alberta, and "Other".
The form accepts all of them and routes them all to the same Privacy
Officer queue. The Privacy Officer is responsible for knowing which
regime applies to each request and what additional response obligations
that regime imposes (e.g., GDPR's stricter time limits and data-
portability schema). The product does not branch on jurisdiction.

### Consent revocation propagation to sub-processors

When a user revokes consent for, say, third-party integrations, our
consent register reflects the revocation immediately. We do not
automatically push the revocation downstream to every sub-processor
(QuickBooks, Stripe, Postmark, etc.) — each sub-processor has its own
consent and data-processing surface that may need separate action.
The Privacy Officer is expected to know which downstream actions are
required and execute them.

### Records of processing activity (RoPA)

GDPR Art. 30 requires every controller to maintain a Record of
Processing Activities — what data, what purpose, what retention, who
has access. We do not produce a RoPA in-product. The Privacy Officer
maintains a RoPA document offline, informed by the consent register
and the data retention rules in the privacy policy.

---

## What this means for engineering

When building on the privacy surface:

- **Be explicit about the boundary in code comments.** If a UI element
  triggers a manual out-of-product step (e.g., "Mark as reported to
  CAI"), the comment on the call site must say so. Future engineers
  should not be able to assume the system handles the downstream task.
- **Don't auto-send anything that touches a regulator or a data subject
  during an incident.** Drafts only. The officer is the human in the
  loop on every incident-response email.
- **Don't model judgment calls.** Severity, "likely to cause serious
  harm", "is this person actually the subject?" — these are officer
  decisions. Surface them as fields the officer fills in, not derived
  flags the system computes.
- **Audit everything.** Every state change on the privacy surface is
  audit-logged. This is the artifact the officer relies on when
  responding to a CAI inquiry, a complaint, or a subject's escalation.

If a new requirement seems to push past this boundary — e.g., "auto-
classify breach severity", "auto-send the CAI notification", "verify
identity in-product" — pause and re-read this document before building.
The boundary is intentional.

---

## Reference

- `docs/specs/dsar_link_placement_guide.md` — where the public DSAR
  link surfaces across the marketing site, signup flow, and in-product.
- `docs/prototypes/builtcrm_privacy_pages_paired.jsx` — `/privacy` and
  `/privacy/officer` design contract.
- `docs/prototypes/builtcrm_privacy_officer_law25_paired.jsx` — admin,
  public DSAR intake, and end-user consent manager design contract.
- `docs/specs/security_posture.md §6` — the `dsar_requests` RLS
  exemption rationale (lands with Session B's schema migration).
