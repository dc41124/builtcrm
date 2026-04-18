import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getUserSettingsView } from "@/domain/loaders/user-settings";
import { listOrganizationAuditEvents } from "@/domain/loaders/audit-log";
import { listOrganizationMembers } from "@/domain/loaders/organization-members";
import {
  getOrganizationProfile,
  listOrganizationLicenses,
} from "@/domain/loaders/organization-profile";
import { listInvitationsForOrganization } from "@/domain/loaders/invitations";
import {
  getContractorIntegrationsView,
  getContractorOrgContext,
} from "@/domain/loaders/integrations";
import { getContractorPaymentsView } from "@/domain/loaders/payments";
import {
  getContractorBillingSummary,
  getOrgPlanContext,
} from "@/domain/loaders/billing";
import { listRecentDataExports } from "@/domain/loaders/data-exports";
import { getSsoProviderByOrg } from "@/domain/loaders/sso";
import { AuthorizationError } from "@/domain/permissions";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function ContractorSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const sessionShim = session.session as unknown as { appUserId?: string | null };

  try {
    const view = await getUserSettingsView({
      session: sessionShim,
      sessionId: (session.session as { id?: string }).id,
      portalType: "contractor",
    });

    const ctx = await getContractorOrgContext(sessionShim);
    const nowMs = Date.now();

    // Load contractor-scoped bundle in parallel — settings is a read-heavy
    // surface and these queries don't depend on each other.
    const [
      members,
      invitations,
      auditEvents,
      integrations,
      payments,
      orgProfile,
      orgLicenses,
      billing,
      planContext,
      recentExports,
      ssoProvider,
    ] = await Promise.all([
      listOrganizationMembers(ctx.organization.id),
      listInvitationsForOrganization(ctx.organization.id),
      listOrganizationAuditEvents(ctx.organization.id, { limit: 200 }),
      getContractorIntegrationsView({ session: sessionShim }),
      getContractorPaymentsView({ session: sessionShim }),
      getOrganizationProfile(ctx.organization.id),
      listOrganizationLicenses(ctx.organization.id),
      getContractorBillingSummary(ctx.organization.id),
      getOrgPlanContext(ctx.organization.id),
      listRecentDataExports(ctx.organization.id, { limit: 20 }),
      getSsoProviderByOrg(ctx.organization.id),
    ]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 26,
              fontWeight: 750,
              letterSpacing: "-.03em",
              margin: 0,
            }}
          >
            Settings
          </h1>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--t2)",
              marginTop: 4,
              marginBottom: 0,
              fontWeight: 520,
              lineHeight: 1.5,
              maxWidth: 680,
            }}
          >
            Manage your profile, security, notifications, and appearance.
          </p>
        </div>
        <SettingsShell
          view={view}
          showDangerZone
          contractor={{
            orgId: ctx.organization.id,
            orgName: ctx.organization.name,
            role: ctx.role,
            currentUserId: ctx.user.id,
            members,
            invitations,
            auditEvents,
            integrations,
            payments,
            orgProfile,
            orgLicenses,
            billing,
            planContext,
            recentExports,
            ssoProvider,
            nowMs,
          }}
        />
      </div>
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
