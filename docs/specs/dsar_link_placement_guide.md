# Step 65 — DSAR Intake Link Placement Guide

**Phase 4+ · Phase 9-lite · Item 9-lite.1 #65 (companion)**
**Public path:** `/privacy/dsar`
**Authored:** May 1, 2026

This is the placement plan for the public DSAR intake form built in
`builtcrm_privacy_officer_law25_paired.jsx` (View 02). The intake page
itself has no shell and no auth — the question is how visitors find it.

The pattern across the construction-software market (Procore, Autodesk
Construction Cloud, Buildertrend) is a single canonical entry from
`Footer → Privacy` plus several deep links from contextual moments
(privacy policy, sign-up, settings). Below is the concrete plan.

---

## Anchor placements (build with Step 65 ship)

These are the placements that should land in the same commit as the
DSAR intake page. Without them, the page exists but is unreachable.

### 1. Marketing footer — primary entry

Already partly there. The marketing prototype
(`builtcrm_marketing_website.jsx` line ~365) has a bottom-strip
`Privacy` link that's currently dead. Wire it, and add a new
**Privacy** column before **Company**.

**Existing footer columns:** Product · Solutions · Company

**Proposed footer columns:** Product · Solutions · Privacy · Company

The new Privacy column contains:
- Privacy Policy → `/privacy`
- Privacy Officer → `/privacy/officer`
- **Submit a request → `/privacy/dsar`**
- Cookie preferences → `/privacy#cookies`
- Subprocessors → `/privacy#share`

The bottom-strip "Privacy" link continues to point to `/privacy`. The
DSAR link lives one click deeper, which is appropriate — the policy
page is the discovery surface, the form is the action surface.

### 2. Privacy Policy page — "Your rights" section

The privacy-policy prototype already has this:
- Inline DSAR banner at the end of section 8 ("Your privacy rights")
- Sticky TOC has a CTA card pinned below the section list with
  "Open the request form"
- Section 13 ("Contact us") shows the Privacy Officer details and
  a link over to `/privacy/officer`

This is the highest-converting placement — visitors who reach the
"Your rights" section have already self-identified as wanting to
exercise one of those rights.

### 3. Privacy Officer page — primary CTA

The officer page prototype already has a `dsar-banner` block as its
second section ("Have a privacy request?") explicitly labelled
*"The fastest way to reach our Privacy Officer with a formal request
is the secure intake form."* Visitors land here looking for a person
to talk to; the banner redirects them to the form, which is faster
for both sides.

### 4. Sign-up flow consent block

When a new user creates an account, the sign-up form's consent
checkbox group should include a footer line:

> By creating an account, you agree to our [Terms](#) and
> [Privacy Policy](/privacy). You can [request access, correction,
> or deletion of your data](/privacy/dsar) at any time.

The third link is the DSAR shortcut. It's redundant for users who
read the Privacy Policy, but it surfaces the right at the moment of
data collection — which is when consent law expects it to be visible.

### 5. In-product Settings → Privacy & consents (logged-in users)

Already built in View 03 of the Step 65 paired prototype. The
"Your data" tab has four action cards (Access copy / Correction /
Portable export / Deletion). Each card opens an in-product flow
that posts directly to the DSAR backend — logged-in users
**don't** route through `/privacy/dsar` because we already know
who they are. This is the preferred path for authenticated users.

The end-user consent manager should also have a footer line on
every tab:

> Need to make a request as a non-account holder, or on behalf of
> someone else? Use the [public privacy request form](/privacy/dsar).

---

## Deferred placements (Phase 4+ later, or as needed)

These are good ideas that don't need to land with Step 65. Add them
as the relevant features ship.

### 6. Cookie banner (when implemented)

When the cookie consent banner ships, add a "Privacy choices" footer
link inside the banner that opens `/privacy#cookies` (top of cookies
section), not `/privacy/dsar` directly. The banner is about prospective
control of new cookies; the DSAR form is for retrospective requests.
Linking them together confuses both purposes.

### 7. Account deletion flow (Phase 10 cleanup)

When/if a self-serve "Delete my account" flow is added, the confirmation
screen should mention the DSAR form for users who want a copy of their
data exported before deletion:

> Want a copy of your data before deletion? Submit a
> [portability request](/privacy/dsar?type=portability) first.

The query-string seeds the form's request type — small UX win.

### 8. Public marketing pages — "Trust" or "Security" section

If/when a dedicated **Security** or **Trust** page is added (linked
from the marketing footer's Company column), include a "Privacy" card
with three sub-links: Policy, Officer, Submit a request. This
duplicates the footer column but is appropriate on a trust page.

### 9. Email footer for transactional and marketing emails

Add a small "Privacy" link to the footer of every outgoing email
template, pointing to `/privacy`. The DSAR form is reachable from
there in one more click. Avoid linking directly to `/privacy/dsar`
from email — this can be abused as a phishing vector if scraped, and
the canonical path through `/privacy` is more discoverable.

### 10. Contact form fallback

If/when a `/contact` form exists, add a small note above the form:

> Looking to exercise a privacy right (access, correction, deletion)?
> Please use our [privacy request form](/privacy/dsar) instead — it's
> handled by our Privacy Officer with a 30-day SLA.

This routes privacy traffic to the right intake instead of to a
generic support queue.

---

## What NOT to do

- **Do not put the DSAR link in the main top nav.** It's a low-volume,
  high-importance flow. Top nav real estate goes to product, pricing,
  and solutions. Footer + policy-page placement is the convention.
- **Do not auto-link the form from emails or notifications without
  context.** The link is a privacy-sensitive surface; if leaked or
  re-shared, a bare URL gives no clue that it goes to a regulated
  intake. Always link from a labelled anchor.
- **Do not require login to reach the form.** Per Law 25 §32, anyone
  has the right to request access — including former users whose
  accounts have been deleted, journalists, and authorized representatives.
- **Do not pre-fill the requester email from a logged-in session.**
  Logged-in users should use the in-product Settings flow, which is
  faster and avoids identity-verification overhead.

---

## Quick sitemap

```
/privacy                            ← Privacy Policy (marketing aesthetic)
/privacy/officer                    ← Privacy Officer page (marketing aesthetic)
/privacy/dsar                       ← DSAR intake form (no shell, no auth)
/contractor/(global)/settings/privacy  ← Privacy Officer admin (portal)
/[anyRole]/(global)/settings/privacy   ← End-user consent manager (portal)
```

Five surfaces. Three public, two in-product. Each surface has a
distinct purpose and a distinct audience. The placement plan above
gets visitors from any reasonable starting point to the right one.

---

## Implementation notes for Claude Code

When wiring this in the repo:

1. **Footer change is in the marketing layout, not the page.** Edit
   `src/app/(marketing)/layout.tsx` (or wherever the footer component
   lives) to add the Privacy column. Don't edit individual pages.

2. **Sign-up consent block is in the sign-up form component,** not
   the auth layout. Currently lives at
   `src/app/(auth)/signup/SignupForm.tsx` (verify path).

3. **The settings → privacy footer line** should be a shared component
   (`<NonAccountHolderRouting />`) imported into all three tabs of
   View 03, so the copy stays consistent.

4. **All three new public pages** (`/privacy`, `/privacy/officer`,
   `/privacy/dsar`) share the same marketing nav and footer. Extract
   a `<MarketingShell>` wrapper if it doesn't exist yet — both the
   marketing site and these privacy pages should use it.

5. **Verify the DSAR intake page's aesthetic.** The Step 65 paired
   prototype currently styles the intake with the portal palette
   (gray canvas, indigo accent). For consistency with the new
   policy/officer pages, reskin it to the marketing aesthetic
   (cream `#faf9f7`, dark purple `#2c2541`) before shipping. The
   form's CSS lives in the `.intake` block of
   `builtcrm_privacy_officer_law25_paired.jsx`.
