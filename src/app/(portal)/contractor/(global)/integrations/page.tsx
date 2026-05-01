import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getContractorIntegrationsView } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

import { IntegrationsView } from "../settings/integrations/integrations-ui";
import { IntegrationsGalleryBody } from "@/components/integrations/IntegrationsGalleryBody";

// Step 64 — Single contractor integrations page.
//
// Folds two previously-separate surfaces into one:
//   1. Active connections (Step 28 / Step 4C.1 OAuth + sync UI):
//      `<IntegrationsView>` lifted from the old
//      /contractor/settings/integrations route.
//   2. Catalog gallery (~21 providers, status-banded):
//      `<IntegrationsGalleryBody variant="portal">`.
//
// The OAuth callback redirects here after a successful connect/disconnect.
// The Settings sub-nav has an "Integrations" entry that navigates here too.

export const metadata: Metadata = {
  title: "Integrations · BuiltCRM",
};

export default async function ContractorIntegrationsPage() {
  const { session } = await requireServerSession();

  let view;
  try {
    view = await getContractorIntegrationsView({ session });
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

  return (
    <div style={{ padding: 24 }}>
      <IntegrationsView view={view} nowMs={Date.now()} />
      <div
        style={{
          marginTop: 48,
          paddingTop: 32,
          borderTop: "1px solid var(--surface-3, #e2e5e9)",
        }}
      >
        <IntegrationsGalleryBody variant="portal" />
      </div>
    </div>
  );
}
