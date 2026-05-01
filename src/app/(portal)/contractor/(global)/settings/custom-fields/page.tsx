import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { listDefinitionsForOrg } from "@/domain/loaders/custom-fields";
import { AuthorizationError } from "@/domain/permissions";

import { CustomFieldsAdminUI } from "./ui";

// Step 61 (Phase 8-lite.2 #61) — Custom fields admin page.
//
// contractor-only. Both contractor_admin and contractor_pm can READ
// the list (so PMs see what's defined for the forms they fill); only
// contractor_admin can mutate. The UI guards mutations by role.

export const dynamic = "force-dynamic";

export default async function ContractorCustomFieldsPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    const definitions = await listDefinitionsForOrg(ctx.organization.id, {
      includeArchived: true,
    });
    return (
      <CustomFieldsAdminUI
        orgName={ctx.organization.name}
        viewerRole={ctx.role}
        definitions={definitions.map((d) => ({
          id: d.id,
          entityType: d.entityType,
          key: d.key,
          label: d.label,
          description: d.description,
          fieldType: d.fieldType,
          optionsJson: d.optionsJson,
          isRequired: d.isRequired,
          orderIndex: d.orderIndex,
          isActive: d.isActive,
          archivedAtIso: d.archivedAt?.toISOString() ?? null,
          createdAtIso: d.createdAt.toISOString(),
        }))}
      />
    );
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
