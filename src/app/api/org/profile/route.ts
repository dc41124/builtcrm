import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, organizations } from "@/db/schema";
import { resolveOrgEditContext } from "@/domain/loaders/resolve-org-context";
import { AuthorizationError } from "@/domain/permissions";
import { encryptTaxId } from "@/lib/integrations/crypto";
import { looksLikeTaxIdMask } from "@/lib/tax-id-mask";

// All fields are optional: the client sends only what changed. Arrays are
// replace-semantics — send the new full list, not a diff.
const BodySchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  legalName: z.string().trim().max(255).nullable().optional(),
  taxId: z.string().trim().max(40).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  addr1: z.string().trim().max(255).nullable().optional(),
  addr2: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  stateRegion: z.string().trim().max(80).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  primaryContactName: z.string().trim().max(200).nullable().optional(),
  primaryContactTitle: z.string().trim().max(200).nullable().optional(),
  primaryContactEmail: z.string().trim().max(320).nullable().optional(),
  primaryContactPhone: z.string().trim().max(40).nullable().optional(),
  billingContactName: z.string().trim().max(200).nullable().optional(),
  billingEmail: z.string().trim().max(320).nullable().optional(),
  // Sub-specific
  primaryTrade: z.string().trim().max(120).nullable().optional(),
  secondaryTrades: z.array(z.string().max(120)).max(50).nullable().optional(),
  yearsInBusiness: z.string().trim().max(10).nullable().optional(),
  crewSize: z.string().trim().max(10).nullable().optional(),
  regions: z.array(z.string().max(120)).max(50).nullable().optional(),
  // Commercial-client-specific
  industry: z.string().trim().max(120).nullable().optional(),
  companySize: z.string().trim().max(40).nullable().optional(),
  invoiceDelivery: z.string().trim().max(40).nullable().optional(),
  // Residential-client-specific
  projectName: z.string().trim().max(255).nullable().optional(),
  preferredName: z.string().trim().max(120).nullable().optional(),
  preferredChannel: z.string().trim().max(40).nullable().optional(),
  preferredTime: z.string().trim().max(40).nullable().optional(),
  emergencyName: z.string().trim().max(200).nullable().optional(),
  emergencyRelation: z.string().trim().max(80).nullable().optional(),
  emergencyPhone: z.string().trim().max(40).nullable().optional(),
});

// Columns we scrub out of audit payloads. tax_id is the sensitive one; add
// more here if the sensitivity policy evolves.
const REDACTED_KEYS = new Set(["taxId"]);

function redact(snap: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snap)) {
    out[k] = REDACTED_KEYS.has(k) ? (v == null ? null : "[redacted]") : v;
  }
  return out;
}

export async function PATCH(req: Request) {
  const { session } = await requireServerSession();
  const sessionShim = session;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await resolveOrgEditContext(sessionShim);
    if (!ctx.isAdmin) {
      throw new AuthorizationError(
        "Only organization admins can edit org details",
        "forbidden",
      );
    }

    // Build the column-level update payload. The API prop names already match
    // the Drizzle column keys except `displayName` → `name`. Empty strings for
    // nullable fields are coerced to null so we don't store whitespace.
    const patch = parsed.data;
    const updates: Record<string, unknown> = {};
    if (patch.displayName != null) updates.name = patch.displayName;
    if (patch.legalName !== undefined)
      updates.legalName = patch.legalName || null;
    // tax_id: encrypt non-empty new values, null on clear. If the
    // submitted value matches the masked display ("***-**-NNNN"), the
    // user did not edit the field — skip the update so we don't
    // re-encrypt the mask string. See docs/specs/tax_id_encryption_plan.md.
    if (patch.taxId !== undefined) {
      const incoming = patch.taxId;
      if (!incoming) {
        updates.taxId = null;
      } else if (!looksLikeTaxIdMask(incoming)) {
        updates.taxId = encryptTaxId(incoming);
      }
    }
    if (patch.website !== undefined) updates.website = patch.website || null;
    if (patch.phone !== undefined) updates.phone = patch.phone || null;
    if (patch.addr1 !== undefined) updates.addr1 = patch.addr1 || null;
    if (patch.addr2 !== undefined) updates.addr2 = patch.addr2 || null;
    if (patch.city !== undefined) updates.city = patch.city || null;
    if (patch.stateRegion !== undefined)
      updates.stateRegion = patch.stateRegion || null;
    if (patch.postalCode !== undefined)
      updates.postalCode = patch.postalCode || null;
    if (patch.country !== undefined) updates.country = patch.country || null;
    if (patch.primaryContactName !== undefined)
      updates.primaryContactName = patch.primaryContactName || null;
    if (patch.primaryContactTitle !== undefined)
      updates.primaryContactTitle = patch.primaryContactTitle || null;
    if (patch.primaryContactEmail !== undefined)
      updates.primaryContactEmail = patch.primaryContactEmail || null;
    if (patch.primaryContactPhone !== undefined)
      updates.primaryContactPhone = patch.primaryContactPhone || null;
    if (patch.billingContactName !== undefined)
      updates.billingContactName = patch.billingContactName || null;
    if (patch.billingEmail !== undefined)
      updates.billingEmail = patch.billingEmail || null;
    if (patch.primaryTrade !== undefined)
      updates.primaryTrade = patch.primaryTrade || null;
    if (patch.secondaryTrades !== undefined)
      updates.secondaryTrades = patch.secondaryTrades ?? null;
    if (patch.yearsInBusiness !== undefined)
      updates.yearsInBusiness = patch.yearsInBusiness || null;
    if (patch.crewSize !== undefined) updates.crewSize = patch.crewSize || null;
    if (patch.regions !== undefined) updates.regions = patch.regions ?? null;
    if (patch.industry !== undefined)
      updates.industry = patch.industry || null;
    if (patch.companySize !== undefined)
      updates.companySize = patch.companySize || null;
    if (patch.invoiceDelivery !== undefined)
      updates.invoiceDelivery = patch.invoiceDelivery || null;
    if (patch.projectName !== undefined)
      updates.projectName = patch.projectName || null;
    if (patch.preferredName !== undefined)
      updates.preferredName = patch.preferredName || null;
    if (patch.preferredChannel !== undefined)
      updates.preferredChannel = patch.preferredChannel || null;
    if (patch.preferredTime !== undefined)
      updates.preferredTime = patch.preferredTime || null;
    if (patch.emergencyName !== undefined)
      updates.emergencyName = patch.emergencyName || null;
    if (patch.emergencyRelation !== undefined)
      updates.emergencyRelation = patch.emergencyRelation || null;
    if (patch.emergencyPhone !== undefined)
      updates.emergencyPhone = patch.emergencyPhone || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, noop: true });
    }

    // Read current row so the audit payload has a meaningful before/after.
    const [before] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);
    if (!before) {
      throw new AuthorizationError("Organization not found", "not_found");
    }

    await dbAdmin.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, ctx.orgId));

      const prevSnap: Record<string, unknown> = {};
      const nextSnap: Record<string, unknown> = {};
      for (const key of Object.keys(updates)) {
        const k = key as keyof typeof before;
        prevSnap[key] = before[k];
        nextSnap[key] = updates[key];
      }

      await tx.insert(auditEvents).values({
        actorUserId: ctx.userId,
        organizationId: ctx.orgId,
        objectType: "organization",
        objectId: ctx.orgId,
        actionName: "updated",
        previousState: redact(prevSnap),
        nextState: redact(nextSnap),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}
