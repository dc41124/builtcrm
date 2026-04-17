import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { roleAssignments, users } from "@/db/schema";
import { getContractorIntegrationsView } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

import { SettingsView, type TeamMember } from "./settings-ui";

export default async function ContractorSettingsPage() {
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

  const teamRows = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      roleKey: roleAssignments.roleKey,
      isPrimary: roleAssignments.isPrimary,
    })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(eq(roleAssignments.organizationId, view.context.organization.id));

  const team: TeamMember[] = teamRows
    .filter((r) => /contractor/i.test(r.roleKey) || r.isPrimary)
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      displayName: r.displayName,
      roleKey: r.roleKey,
      isPrimary: r.isPrimary,
    }));

  return <SettingsView view={view} team={team} nowMs={Date.now()} />;
}
