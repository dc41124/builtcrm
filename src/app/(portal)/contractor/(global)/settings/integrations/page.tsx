import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getContractorIntegrationsView } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

import { IntegrationsView } from "./integrations-ui";

export default async function ContractorIntegrationsPage() {
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getContractorIntegrationsView({
      session: session,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <IntegrationsView view={view} nowMs={Date.now()} />;
}
