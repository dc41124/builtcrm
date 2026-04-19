# BuiltCRM

Multi-portal construction project-management SaaS. Four portals (contractor, subcontractor, commercial client, residential client) sharing one data layer with role-scoped views.

See [CLAUDE.md](./CLAUDE.md) for the architecture overview, tech stack, commands, and conventions. Detailed specs live under [docs/specs/](./docs/specs/); visual references under [docs/design/](./docs/design/) and [docs/prototypes/](./docs/prototypes/).

## Quick start

```bash
npm install
cp .env.example .env      # fill in the required secrets
npm run db:migrate
npm run db:seed
npm run dev
```

## Third-party integrations — sandbox vs. production

The integrations framework (OAuth handshake, token encryption, token refresh, webhook verification, sync-event audit log) is production-ready. The outbound data-sync against each third-party accounting provider is **stubbed**: the "Sync now" action writes a `sync_events` row with `status='skipped'` and a `resultData.stubbed=true` payload showing what *would* be pushed, but no HTTP call reaches the provider.

This is deliberate. Production sync against QuickBooks, Xero, or Sage requires each provider's app-review process, which in turn requires a registered business entity and a published marketplace app. The portfolio build stops at sandbox OAuth completion; production sync is a post-revenue concern.

### QuickBooks Online

**Sandbox (today):**

1. Register a free developer account at [developer.intuit.com](https://developer.intuit.com).
2. Create a new app. Under the "Keys & OAuth" section, copy the **Client ID** and **Client Secret** from the *Development* environment into `.env`:
   - `QUICKBOOKS_CLIENT_ID`
   - `QUICKBOOKS_CLIENT_SECRET`
3. Set the redirect URI in the Intuit app config to `<your-app-base>/api/oauth/quickbooks_online/callback` (e.g. `http://localhost:3000/api/oauth/quickbooks_online/callback` for local dev).
4. Optional — to exercise the webhook signature verifier, configure a webhook subscription in the Intuit portal pointing at `<your-app-base>/api/webhooks/quickbooks_online` and copy the verifier token into `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`.
5. In the app's integrations page, click **Connect QuickBooks**. You'll land on Intuit's sandbox authorize screen, approve the sandbox company, and return to the integrations page with a *Connected* card. Clicking **Sync now** writes a stubbed sync event — inspect it via the sync-events history panel or the integrations export endpoint to see the `wouldSend` payload.

**Production deployment — what is currently missing:**

| Requirement | Status | Notes |
|---|---|---|
| Intuit app review application | Not submitted | Requires a real business entity. Application reviewed by Intuit for security, UX, and API usage correctness. |
| Business entity verification | Not completed | Intuit requires a registered LLC / corporation with a business email and phone. |
| Privacy policy URL | Not published | Must describe how QuickBooks data is stored, used, and deleted. Hosted on the marketing site. |
| Terms of service URL | Not published | Customer-facing terms covering the connector. |
| App published on Intuit marketplace | No | After review, the app is published and production OAuth scopes (`com.intuit.quickbooks.accounting`) become available. |
| Real data mappers | Stubbed | The `syncToQuickBooks` function in `src/lib/integrations/providers/quickbooks-sync.ts` emits a shape-accurate payload but does not execute the HTTP call. Production work replaces the stub body with the actual push and swaps `status='skipped'` for `status='succeeded'`. |

### Xero

**Sandbox (today):**

1. Register a free developer account at [developer.xero.com](https://developer.xero.com).
2. Create a new app. Under "Configuration", copy the **Client ID** and **Client Secret** into `.env`:
   - `XERO_CLIENT_ID`
   - `XERO_CLIENT_SECRET`
3. Set the redirect URI in the Xero app config to `<your-app-base>/api/oauth/xero/callback`.
4. Optional — to exercise the webhook signature verifier, configure a webhook subscription in the Xero portal pointing at `<your-app-base>/api/webhooks/xero` and copy the webhook key into `XERO_WEBHOOK_KEY`.
5. In the integrations page, click **Connect Xero**. You'll land on Xero's login screen, approve tenant access (Xero's "demo company" works fine for sandbox), and return to the integrations page with a *Connected* card. Clicking **Sync now** writes a stubbed sync event with a Xero-shaped `wouldSend` payload (Accounting API 2.0 `POST /Invoices`, `/Payments`, `/Contacts`).

**Production deployment — what is currently missing:**

| Requirement | Status | Notes |
|---|---|---|
| Xero app review application | Not submitted | Required to move from sandbox to published. Review covers security, UX, and OAuth scope usage. |
| Business entity verification | Not completed | Same underlying requirement as QuickBooks — a registered business entity with a verifiable contact. |
| Privacy policy URL | Not published | Must describe how Xero tenant data is stored, used, and deleted. |
| Terms of service URL | Not published | Customer-facing terms covering the connector. |
| App published on Xero marketplace | No | After review, the app is published and production OAuth scopes become available. |
| Real data mappers | Stubbed | `syncToXero` in `src/lib/integrations/providers/xero-sync.ts` emits a shape-accurate Accounting API 2.0 payload but does not execute the HTTP call. Production work replaces the stub body with the actual push and swaps `status='skipped'` for `status='succeeded'`. |

### Sage Business Cloud Accounting

**Sandbox (today):**

1. Register a developer account at [developer.sage.com](https://developer.sage.com). Sage provides a free sandbox business tied to your developer account.
2. Create a new app under "My Apps". Copy the **Client ID** and **Client Secret** into `.env`:
   - `SAGE_CLIENT_ID`
   - `SAGE_CLIENT_SECRET`
3. Set the redirect URI in the Sage app config to `<your-app-base>/api/oauth/sage_business_cloud/callback`.
4. The provider config defaults to `country=CA, locale=en-CA` on the authorize URL (see `src/lib/integrations/providers/sage.ts`). Switch the `extraAuthorizeParams` for a different region if you're testing against a US/UK/IE/DE/FR/ES sandbox.
5. Optional — set `SAGE_WEBHOOK_SECRET` if you configure a webhook subscription. Sage's webhook signing is documented sparsely; the verifier assumes HMAC-SHA256/base64 with header `x-sage-signature`. Revisit when the live endpoint ships.
6. In the integrations page, click **Connect Sage**. You'll land on Sage's authorize screen, approve the sandbox business, and return *Connected*. **Sync now** writes a stubbed sync event with a Sage Accounting v3.1 `wouldSend` payload (`/sales_invoices`, `/contact_payments`, `/contacts`).

**Production deployment — what is currently missing:**

| Requirement | Status | Notes |
|---|---|---|
| Sage partner program approval | Not submitted | Production apps go through Sage's partner program — a higher bar than Sage's developer portal. |
| Business entity verification | Not completed | Required by the partner program. |
| Privacy policy URL | Not published | Must describe how Sage business data is stored, used, and deleted. |
| Terms of service URL | Not published | Customer-facing terms covering the connector. |
| Multi-region configuration | Single-region (CA) | `extraAuthorizeParams` hardcodes country/locale. Production needs per-connection region selection (UK/IE/US/CA/DE/FR/ES) exposed in the connect flow. |
| Real data mappers | Stubbed | `syncToSage` in `src/lib/integrations/providers/sage-sync.ts` emits a shape-accurate Sage Accounting v3.1 payload but does not execute the HTTP call. Production work replaces the stub body with the actual push and swaps `status='skipped'` for `status='succeeded'`. |

## Repository layout

```
src/
  app/           Next.js App Router pages and API routes
  components/    Shared UI components
  lib/           Business logic, integrations, utilities
  domain/        Domain models, loaders, policies
  db/            Drizzle schema, migrations, queries
  auth/          Better Auth config, session helpers
  jobs/          Trigger.dev background jobs
docs/            Architecture specs, design mockups, prototypes
```

## License

Proprietary. All rights reserved.
