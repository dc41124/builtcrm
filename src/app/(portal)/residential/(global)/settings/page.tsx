import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getUserSettingsView } from "@/domain/loaders/user-settings";
import { getResidentialClientOrgContext } from "@/domain/loaders/client-context";
import { listOrganizationMembers } from "@/domain/loaders/organization-members";
import { listInvitationsForOrganization } from "@/domain/loaders/invitations";
import { getOrganizationProfile } from "@/domain/loaders/organization-profile";
import { AuthorizationError } from "@/domain/permissions";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function ResidentialSettingsPage() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const view = await getUserSettingsView({
      session: sessionShim,
      sessionId: session.id,
      portalType: "residential",
    });

    // Residential-client bundle is best-effort — users mid-onboarding may not
    // have a client-org assignment yet; the shared tabs still render.
    let residentialBundle:
      | {
          orgId: string;
          orgName: string;
          role: "owner" | "member";
          currentUserId: string;
          members: Awaited<ReturnType<typeof listOrganizationMembers>>;
          invitations: Awaited<ReturnType<typeof listInvitationsForOrganization>>;
          orgProfile: Awaited<ReturnType<typeof getOrganizationProfile>>;
        }
      | undefined;
    try {
      const ctx = await getResidentialClientOrgContext(sessionShim);
      const [members, inv, orgProfile] = await Promise.all([
        listOrganizationMembers(ctx.organization.id, "residential"),
        listInvitationsForOrganization(ctx.organization.id),
        getOrganizationProfile(ctx.organization.id),
      ]);
      residentialBundle = {
        orgId: ctx.organization.id,
        orgName: ctx.organization.name,
        role: ctx.role,
        currentUserId: ctx.user.id,
        members,
        invitations: inv,
        orgProfile,
      };
    } catch (err) {
      if (!(err instanceof AuthorizationError)) throw err;
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
        <SettingsShell view={view} residential={residentialBundle} />
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
