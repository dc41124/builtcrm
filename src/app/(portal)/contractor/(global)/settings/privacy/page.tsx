import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { loadPrivacyAdminView } from "@/domain/loaders/privacy";
import { AuthorizationError } from "@/domain/permissions";

import { PrivacyAdminUI } from "./privacy-admin-ui";

// Step 65 Session B — Privacy & Law 25 contractor admin page.
//
// Contractor admins only. PMs see a "forbidden" message. Loader pulls
// the current Privacy Officer designation, candidate user pool, and the
// DSAR queue for this org.

export const dynamic = "force-dynamic";

export default async function ContractorPrivacyAdminPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    if (ctx.role !== "contractor_admin") {
      return (
        <div style={{ padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 720, marginBottom: 8 }}>Privacy & Law 25</h1>
          <p style={{ color: "var(--t2)", maxWidth: 540 }}>
            Only contractor admins can view this page. If you need access, ask your org admin to
            elevate your role.
          </p>
        </div>
      );
    }

    const view = await loadPrivacyAdminView({
      organizationId: ctx.organization.id,
      organizationName: ctx.organization.name,
    });

    return <PrivacyAdminUI view={view} currentUserId={ctx.user.id} />;
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
