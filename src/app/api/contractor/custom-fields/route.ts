import { NextResponse } from "next/server";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { customFieldDefinitions } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { listDefinitionsForOrg } from "@/domain/loaders/custom-fields";
import { slugifyKey } from "@/lib/custom-fields/normalize";

// Step 61 — Custom field definitions: list + create.

const FieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "boolean",
]);

const EntityTypeSchema = z.enum([
  "project",
  "subcontractor",
  "document",
  "rfi",
]);

const OptionSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
});

const CreateBodySchema = z
  .object({
    entityType: EntityTypeSchema,
    label: z.string().min(1).max(120),
    key: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_]+$/, {
        message: "key must be lowercase letters, digits, and underscores only",
      })
      .optional(),
    description: z.string().max(2000).optional().nullable(),
    fieldType: FieldTypeSchema,
    options: z.array(OptionSchema).optional(),
    isRequired: z.boolean().optional().default(false),
  })
  .refine(
    (b) =>
      b.fieldType === "select" || b.fieldType === "multi_select"
        ? Array.isArray(b.options) && b.options.length > 0
        : true,
    { message: "select / multi_select fields require at least one option" },
  );

// GET /api/contractor/custom-fields?entityType=project&includeArchived=1
export async function GET(req: Request) {
  const { session } = await requireServerSession();
  try {
    const ctx = await requireContractorAdminOrPm(session);
    const url = new URL(req.url);
    const entityTypeParam = url.searchParams.get("entityType");
    const includeArchived = url.searchParams.get("includeArchived") === "1";
    const entityType =
      entityTypeParam && EntityTypeSchema.safeParse(entityTypeParam).success
        ? (entityTypeParam as z.infer<typeof EntityTypeSchema>)
        : undefined;
    const rows = await listDefinitionsForOrg(ctx.organization.id, {
      entityType,
      includeArchived,
    });
    return NextResponse.json({ definitions: rows });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/contractor/custom-fields — create a new definition.
// contractor_admin only.
export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = CreateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can manage custom fields.",
        "forbidden",
      );
    }
    const key = body.key ?? slugifyKey(body.label);
    if (!key) {
      return NextResponse.json(
        { error: "invalid_key", message: "Could not derive a key from the label." },
        { status: 400 },
      );
    }

    const created = await withTenant(ctx.organization.id, async (tx) => {
      // Compute next order_index for this (org, entity_type) so the
      // new field appears at the bottom of the list. Concurrent
      // creates can collide — we accept a tie at the same index since
      // ordering is admin-controlled and reorder is one click away.
      const [maxRow] = await tx
        .select({ max: max(customFieldDefinitions.orderIndex) })
        .from(customFieldDefinitions)
        .where(
          and(
            eq(customFieldDefinitions.organizationId, ctx.organization.id),
            eq(customFieldDefinitions.entityType, body.entityType),
          ),
        );
      const nextOrderIndex = (maxRow?.max ?? -1) + 1;

      const [row] = await tx
        .insert(customFieldDefinitions)
        .values({
          organizationId: ctx.organization.id,
          entityType: body.entityType,
          key,
          label: body.label.trim(),
          description: body.description?.trim() || null,
          fieldType: body.fieldType,
          optionsJson:
            body.fieldType === "select" || body.fieldType === "multi_select"
              ? body.options ?? []
              : null,
          isRequired: body.isRequired,
          orderIndex: nextOrderIndex,
        })
        .returning();
      return row;
    });

    await writeOrgAuditEvent(ctx, {
      action: "custom_field.created",
      resourceType: "custom_field_definition",
      resourceId: created.id,
      details: {
        nextState: {
          entityType: created.entityType,
          key: created.key,
          fieldType: created.fieldType,
          isRequired: created.isRequired,
        },
      },
    });

    return NextResponse.json({ definition: created }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------

async function requireContractorAdminOrPm(session: unknown) {
  const ctx = await getOrgContext(session as never);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Custom fields are a contractor-only feature.",
      "forbidden",
    );
  }
  return ctx;
}

function handleError(err: unknown) {
  if (err instanceof AuthorizationError) {
    const code = err.code === "unauthenticated" ? 401 : 403;
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: code },
    );
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
    return NextResponse.json(
      {
        error: "duplicate_key",
        message: "A custom field with this key already exists for this entity type.",
      },
      { status: 409 },
    );
  }
  // eslint-disable-next-line no-console
  console.error("[custom-fields] route error:", err);
  return NextResponse.json(
    { error: "internal_error", message: "Something went wrong." },
    { status: 500 },
  );
}
