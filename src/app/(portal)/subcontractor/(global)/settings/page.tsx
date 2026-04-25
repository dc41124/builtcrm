import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getUserSettingsView } from "@/domain/loaders/user-settings";
import { listOrganizationMembers } from "@/domain/loaders/organization-members";
import { listInvitationsForOrganization } from "@/domain/loaders/invitations";
import {
  getSubcontractorOrgContext,
  listSubOrgComplianceRecords,
} from "@/domain/loaders/subcontractor-compliance";
import {
  getOrganizationProfile,
  listOrganizationCertifications,
  listOrganizationLicenses,
} from "@/domain/loaders/organization-profile";
import { AuthorizationError } from "@/domain/permissions";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function SubcontractorSettingsPage() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const view = await getUserSettingsView({
      session: sessionShim,
      sessionId: session.id,
      portalType: "subcontractor",
    });

    // Sub context is best-effort — if a signed-in user doesn't yet have a sub
    // org assignment (e.g. first-time invitee mid-onboarding), render the page
    // without the bundle so the shared tabs still work.
    let subBundle:
      | {
          orgId: string;
          orgName: string;
          role: "subcontractor_owner" | "subcontractor_user";
          currentUserId: string;
          compliance: Awaited<ReturnType<typeof listSubOrgComplianceRecords>>;
          members: Awaited<ReturnType<typeof listOrganizationMembers>>;
          invitations: Awaited<ReturnType<typeof listInvitationsForOrganization>>;
          orgProfile: Awaited<ReturnType<typeof getOrganizationProfile>>;
          orgLicenses: Awaited<ReturnType<typeof listOrganizationLicenses>>;
          orgCertifications: Awaited<ReturnType<typeof listOrganizationCertifications>>;
        }
      | undefined;

    try {
      const ctx = await getSubcontractorOrgContext(sessionShim);
      const [
        compliance,
        members,
        invitations,
        orgProfile,
        orgLicenses,
        orgCertifications,
      ] = await Promise.all([
        listSubOrgComplianceRecords(ctx.organization.id),
        listOrganizationMembers(ctx.organization.id),
        listInvitationsForOrganization(ctx.organization.id),
        getOrganizationProfile(ctx.organization.id),
        listOrganizationLicenses(ctx.organization.id),
        listOrganizationCertifications(ctx.organization.id),
      ]);
      subBundle = {
        orgId: ctx.organization.id,
        orgName: ctx.organization.name,
        role: ctx.role,
        currentUserId: ctx.user.id,
        compliance,
        members,
        invitations,
        orgProfile,
        orgLicenses,
        orgCertifications,
      };
    } catch (err) {
      if (!(err instanceof AuthorizationError)) throw err;
      // Swallow forbidden/not-found here; subBundle stays undefined.
    }

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
        <SettingsShell view={view} subcontractor={subBundle} />
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
