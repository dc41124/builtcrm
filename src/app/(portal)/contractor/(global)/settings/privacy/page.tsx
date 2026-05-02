import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import {
  loadEndUserPrivacyView,
  loadPrivacyAdminView,
} from "@/domain/loaders/privacy";
import { AuthorizationError } from "@/domain/permissions";

import { EndUserConsentManager } from "@/components/privacy/end-user-consent-manager";

import { PrivacyAdminUI } from "./privacy-admin-ui";

// Step 65 Sessions B+C — Privacy surface in the contractor portal.
//
// Path branches on role:
//   - contractor_admin → admin surface (officer card + DSAR queue +
//     consent register + breach register)
//   - contractor_pm    → end-user consent manager (their own data)

export const dynamic = "force-dynamic";

export default async function ContractorPrivacyPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);

    if (ctx.role === "contractor_admin") {
      const view = await loadPrivacyAdminView({
        organizationId: ctx.organization.id,
        organizationName: ctx.organization.name,
      });
      return <PrivacyAdminUI view={view} currentUserId={ctx.user.id} />;
    }

    const endUserView = await loadEndUserPrivacyView({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
    });
    return <EndUserConsentManager view={endUserView} />;
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
