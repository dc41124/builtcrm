import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { ssoProviders } from "@/db/schema";

export type SsoProviderView = {
  id: string;
  organizationId: string;
  name: string;
  entityId: string;
  ssoUrl: string;
  certificatePem: string;
  allowedEmailDomain: string;
  status: "active" | "disabled";
  lastLoginAt: Date | null;
};

export async function getSsoProviderByOrg(
  organizationId: string,
): Promise<SsoProviderView | null> {
  const [row] = await db
    .select()
    .from(ssoProviders)
    .where(eq(ssoProviders.organizationId, organizationId))
    .limit(1);
  if (!row) return null;
  return mapRow(row);
}

export async function getSsoProviderById(
  providerId: string,
): Promise<SsoProviderView | null> {
  const [row] = await db
    .select()
    .from(ssoProviders)
    .where(eq(ssoProviders.id, providerId))
    .limit(1);
  if (!row) return null;
  return mapRow(row);
}

function mapRow(row: typeof ssoProviders.$inferSelect): SsoProviderView {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    entityId: row.entityId,
    ssoUrl: row.ssoUrl,
    certificatePem: row.certificatePem,
    allowedEmailDomain: row.allowedEmailDomain,
    status: row.status as "active" | "disabled",
    lastLoginAt: row.lastLoginAt,
  };
}
