import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getContractorIntegrationsView } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

import { IntegrationsView } from "./integrations-ui";

export default async function ContractorIntegrationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getContractorIntegrationsView({
      session: session.session as unknown as { appUserId?: string | null },
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <IntegrationsView view={view} />
    </main>
  );
}
