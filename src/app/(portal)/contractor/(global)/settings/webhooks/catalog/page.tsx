import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

import { WebhookCatalogUI } from "./catalog-ui";

// Step 57 (Phase 8-lite.1 #57) — Webhook Event Catalog page.
//
// Contractor-only docs surface listing every outbound webhook event
// BuiltCRM emits, with payload schemas, copy-ready examples, and
// signature verification guidance. The actual emission code is not
// yet wired (Step 26 covered the receiver side); this page documents
// the *intended* event surface so partner integrations can be built
// against a stable contract.
//
// Auth gate: getContractorOrgContext throws AuthorizationError if the
// session is unauth'd or the user isn't a contractor (admin or PM).
// Subs and clients hit the redirect / forbidden branches.

export const dynamic = "force-dynamic";

export default async function ContractorWebhookCatalogPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    return <WebhookCatalogUI orgName={ctx.organization.name} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div style={{ padding: 24 }}>
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }
}
