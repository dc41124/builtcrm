import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  organizationCertifications,
  organizationLicenses,
  organizations,
} from "@/db/schema";
import { decryptTaxId } from "@/lib/integrations/crypto";
import { presignDownloadUrl } from "@/lib/storage";
import { maskTaxId } from "@/lib/tax-id-mask";

// Settings-page shape for the organizations row. Everything except `id`,
// `name`, and `organizationType` is nullable in the DB; we preserve that here.
export type OrganizationProfile = {
  id: string;
  organizationType: string;
  // Shared
  displayName: string; // stored in organizations.name
  legalName: string | null;
  // Mask form of the stored tax_id ("***-**-1234") — never the plaintext.
  // Plaintext is only ever returned by POST /api/org/tax-id/reveal which
  // writes a tax_id.revealed audit event. See
  // docs/specs/tax_id_encryption_plan.md.
  taxId: string | null;
  taxIdHasValue: boolean;
  website: string | null;
  phone: string | null;
  addr1: string | null;
  addr2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  country: string | null;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  billingContactName: string | null;
  billingEmail: string | null;
  logoStorageKey: string | null;
  logoPreviewUrl: string | null;
  // Sub-specific — null on contractor rows
  primaryTrade: string | null;
  secondaryTrades: string[] | null;
  yearsInBusiness: string | null;
  crewSize: string | null;
  regions: string[] | null;
  // Org-security (commit 5). Null = unrestricted / no preference set.
  allowedEmailDomains: string[] | null;
  sessionTimeoutMinutes: number | null;
  // Professional+ gated. Preference persists; login-time enforcement hook
  // deferred to the SSO phase (both touch src/auth/config.ts).
  requireTwoFactorOrg: boolean;
  // Commercial-client-specific (commit 8). Null on other portals.
  industry: string | null;
  companySize: string | null;
  invoiceDelivery: string | null;
  // Residential-client-specific (commit 8). Null on other portals.
  projectName: string | null;
  preferredName: string | null;
  preferredChannel: string | null;
  preferredTime: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
};

export async function getOrganizationProfile(
  organizationId: string,
): Promise<OrganizationProfile | null> {
  const [row] = await db
    .select({
      id: organizations.id,
      organizationType: organizations.organizationType,
      name: organizations.name,
      legalName: organizations.legalName,
      taxId: organizations.taxId,
      website: organizations.website,
      phone: organizations.phone,
      addr1: organizations.addr1,
      addr2: organizations.addr2,
      city: organizations.city,
      stateRegion: organizations.stateRegion,
      postalCode: organizations.postalCode,
      country: organizations.country,
      primaryContactName: organizations.primaryContactName,
      primaryContactTitle: organizations.primaryContactTitle,
      primaryContactEmail: organizations.primaryContactEmail,
      primaryContactPhone: organizations.primaryContactPhone,
      billingContactName: organizations.billingContactName,
      billingEmail: organizations.billingEmail,
      logoStorageKey: organizations.logoStorageKey,
      primaryTrade: organizations.primaryTrade,
      secondaryTrades: organizations.secondaryTrades,
      yearsInBusiness: organizations.yearsInBusiness,
      crewSize: organizations.crewSize,
      regions: organizations.regions,
      allowedEmailDomains: organizations.allowedEmailDomains,
      sessionTimeoutMinutes: organizations.sessionTimeoutMinutes,
      requireTwoFactorOrg: organizations.requireTwoFactorOrg,
      industry: organizations.industry,
      companySize: organizations.companySize,
      invoiceDelivery: organizations.invoiceDelivery,
      projectName: organizations.projectName,
      preferredName: organizations.preferredName,
      preferredChannel: organizations.preferredChannel,
      preferredTime: organizations.preferredTime,
      emergencyName: organizations.emergencyName,
      emergencyRelation: organizations.emergencyRelation,
      emergencyPhone: organizations.emergencyPhone,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!row) return null;

  let logoPreviewUrl: string | null = null;
  if (row.logoStorageKey) {
    try {
      logoPreviewUrl = await presignDownloadUrl({
        key: row.logoStorageKey,
        expiresInSeconds: 60 * 60,
      });
    } catch {
      logoPreviewUrl = null;
    }
  }

  // tax_id is encrypted at rest. Decrypt to compute the mask we ship to
  // the client. A decrypt failure indicates a real data integrity bug
  // (post-backfill, every non-null tax_id row is well-formed
  // ciphertext) — let it propagate.
  const taxIdPlain = row.taxId ? decryptTaxId(row.taxId) : null;
  const taxIdMasked = taxIdPlain ? maskTaxId(taxIdPlain) : null;

  return {
    id: row.id,
    organizationType: row.organizationType,
    displayName: row.name,
    legalName: row.legalName,
    taxId: taxIdMasked,
    taxIdHasValue: taxIdPlain !== null,
    website: row.website,
    phone: row.phone,
    addr1: row.addr1,
    addr2: row.addr2,
    city: row.city,
    stateRegion: row.stateRegion,
    postalCode: row.postalCode,
    country: row.country,
    primaryContactName: row.primaryContactName,
    primaryContactTitle: row.primaryContactTitle,
    primaryContactEmail: row.primaryContactEmail,
    primaryContactPhone: row.primaryContactPhone,
    billingContactName: row.billingContactName,
    billingEmail: row.billingEmail,
    logoStorageKey: row.logoStorageKey,
    logoPreviewUrl,
    primaryTrade: row.primaryTrade,
    secondaryTrades: row.secondaryTrades,
    yearsInBusiness: row.yearsInBusiness,
    crewSize: row.crewSize,
    regions: row.regions,
    allowedEmailDomains: row.allowedEmailDomains,
    sessionTimeoutMinutes: row.sessionTimeoutMinutes,
    requireTwoFactorOrg: row.requireTwoFactorOrg,
    industry: row.industry,
    companySize: row.companySize,
    invoiceDelivery: row.invoiceDelivery,
    projectName: row.projectName,
    preferredName: row.preferredName,
    preferredChannel: row.preferredChannel,
    preferredTime: row.preferredTime,
    emergencyName: row.emergencyName,
    emergencyRelation: row.emergencyRelation,
    emergencyPhone: row.emergencyPhone,
  };
}

export type OrganizationLicense = {
  id: string;
  kind: string;
  licenseNumber: string;
  stateRegion: string | null;
  expiresOn: string | null; // ISO date (YYYY-MM-DD)
  createdAt: Date;
};

export async function listOrganizationLicenses(
  organizationId: string,
): Promise<OrganizationLicense[]> {
  const rows = await db
    .select()
    .from(organizationLicenses)
    .where(eq(organizationLicenses.organizationId, organizationId))
    .orderBy(asc(organizationLicenses.createdAt));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    licenseNumber: r.licenseNumber,
    stateRegion: r.stateRegion,
    expiresOn: r.expiresOn ?? null,
    createdAt: r.createdAt,
  }));
}

export type OrganizationCertification = {
  id: string;
  kind: string;
  holder: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  createdAt: Date;
};

export async function listOrganizationCertifications(
  organizationId: string,
): Promise<OrganizationCertification[]> {
  const rows = await db
    .select()
    .from(organizationCertifications)
    .where(eq(organizationCertifications.organizationId, organizationId))
    .orderBy(asc(organizationCertifications.createdAt));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    holder: r.holder,
    issuedOn: r.issuedOn,
    expiresOn: r.expiresOn,
    createdAt: r.createdAt,
  }));
}
