import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { customFieldDefinitions, customFieldValues } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { normalizeCustomFieldValue } from "@/lib/custom-fields/normalize";

// Step 61 — Bulk write custom-field values for one entity row.
//
// POST /api/contractor/custom-fields/values
// body: {
//   entityType: 'project' | 'subcontractor' | 'document' | 'rfi',
//   entityId:   uuid,
//   values:     { definitionId: string; value: unknown }[]
// }
//
// Validation: every (definitionId, value) is run through
// normalizeCustomFieldValue. If any fails, the whole call fails — we
// don't accept partial writes because the entity edit form already
// rendered all fields together; a partial write would leave the user
// with stale state.
//
// Authorization: this V1 helper is contractor-only. The "edit-access
// to the parent entity" check is the entity's own concern — we trust
// the caller to have established that. Future: add an entity-resolver
// table and run a generic per-entity guard here.
//
// Idempotency: we DELETE+INSERT inside one transaction. Cheaper than
// a per-row upsert when the value list is small (≤20 fields per
// entity is the realistic ceiling).

const BodySchema = z.object({
  entityType: z.enum(["project", "subcontractor", "document", "rfi"]),
  entityId: z.string().uuid(),
  values: z
    .array(
      z.object({
        definitionId: z.string().uuid(),
        value: z.unknown(),
      }),
    )
    .max(200),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { entityType, entityId, values } = parsed.data;

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Custom fields are a contractor-only feature.",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Load the relevant definitions in one query so we can validate
      // every value against the right type.
      const definitionIds = values.map((v) => v.definitionId);
      const defs =
        definitionIds.length === 0
          ? []
          : await tx
              .select()
              .from(customFieldDefinitions)
              .where(
                and(
                  eq(customFieldDefinitions.organizationId, ctx.organization.id),
                  eq(customFieldDefinitions.entityType, entityType),
                  inArray(customFieldDefinitions.id, definitionIds),
                ),
              );

      const defsById = new Map(defs.map((d) => [d.id, d]));
      const errors: { definitionId: string; error: string }[] = [];
      const normalized: { definitionId: string; value: unknown }[] = [];

      for (const v of values) {
        const def = defsById.get(v.definitionId);
        if (!def) {
          errors.push({
            definitionId: v.definitionId,
            error: "Definition not found or wrong entity type.",
          });
          continue;
        }
        const r = normalizeCustomFieldValue(
          {
            key: def.key,
            label: def.label,
            fieldType: def.fieldType,
            optionsJson: def.optionsJson,
            isRequired: def.isRequired,
          },
          v.value,
        );
        if (!r.ok) {
          errors.push({ definitionId: v.definitionId, error: r.error });
          continue;
        }
        // Skip null values — equivalent to "leave blank". We also skip
        // archived/inactive definitions so admins can hide them from
        // forms without invalidating in-flight writes.
        if (r.value === null || !def.isActive) continue;
        normalized.push({ definitionId: def.id, value: r.value });
      }

      if (errors.length > 0) {
        return { ok: false as const, errors };
      }

      // DELETE+INSERT under one tx. Anything we wrote previously for
      // (entity, def) is replaced; missing entries are removed.
      await tx
        .delete(customFieldValues)
        .where(
          and(
            inArray(
              customFieldValues.definitionId,
              defs.map((d) => d.id),
            ),
            eq(customFieldValues.entityId, entityId),
          ),
        );
      if (normalized.length > 0) {
        await tx.insert(customFieldValues).values(
          normalized.map((n) => ({
            definitionId: n.definitionId,
            entityId,
            valueJson: n.value as never,
          })),
        );
      }

      return { ok: true as const, count: normalized.length };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "validation_failed", errors: result.errors },
        { status: 422 },
      );
    }

    await writeOrgAuditEvent(ctx, {
      action: "custom_field.values_set",
      resourceType: "custom_field_values",
      resourceId: entityId,
      details: { metadata: { entityType, count: result.count } },
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code = err.code === "unauthenticated" ? 401 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    // eslint-disable-next-line no-console
    console.error("[custom-fields/values] error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Something went wrong." },
      { status: 500 },
    );
  }
}
