import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { EndUserConsentManager } from "@/components/privacy/end-user-consent-manager";
import { getOrgContext } from "@/domain/context";
import { loadEndUserPrivacyView } from "@/domain/loaders/privacy";
import { AuthorizationError } from "@/domain/permissions";

// Step 65 Session C — commercial-client end-user consent manager.

export const dynamic = "force-dynamic";

export default async function CommercialPrivacyPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getOrgContext(sessionData.session);
    const view = await loadEndUserPrivacyView({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
    return <EndUserConsentManager view={view} />;
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
