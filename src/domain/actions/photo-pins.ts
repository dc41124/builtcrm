import { and, eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  documents,
  drawingSets,
  drawingSheets,
  photoPins,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// ─────────────────────────────────────────────────────────────────────────
// Photo-pin actions. Every state-changing API route delegates here.
//
// Authorization model:
//   - The caller must have effective context on the project (any portal
//     role with project access). RLS gates reads; the action layer adds
//     the cross-table validation that the sheet and the document belong
//     to the same project.
//   - Mutations (create / move / delete) require that the document and
//     sheet both belong to the same project the caller has access to.
//   - Pin coordinates are validated [0, 1] both at the action layer (so
//     we throw a friendly error) and at the DB level (CHECK constraint
//     defense in depth — see schema).
//
// Note: clients can technically pin if they have project access, but the
// drawing viewer is not exposed to clients in the current UI. Keeping
// authz at the project-membership layer (not role-restricted) means the
// action is honest about who has data access; specific role gating can
// be added at the page level if/when the viewer ships to clients.
// ─────────────────────────────────────────────────────────────────────────

export class PinValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class PinAccessError extends Error {
  constructor() {
    super("Photo or sheet not in the project the caller can access");
  }
}

interface BaseInput {
  session: SessionLike | null | undefined;
}

function assertCoord(name: "x" | "y", value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new PinValidationError(`${name} must be a fraction in [0, 1]`);
  }
}

// Resolve the project for a (sheet, document) pair. Throws if either
// parent doesn't exist or they belong to different projects. Runs on
// dbAdmin because we need to read across both parents BEFORE we know
// the caller's tenant — context is then derived from the resolved
// projectId.
async function resolveProject(
  sheetId: string,
  documentId: string,
): Promise<string> {
  const [sheet] = await dbAdmin
    .select({ projectId: drawingSets.projectId })
    .from(drawingSheets)
    .innerJoin(drawingSets, eq(drawingSets.id, drawingSheets.setId))
    .where(eq(drawingSheets.id, sheetId))
    .limit(1);
  if (!sheet) throw new PinAccessError();

  const [doc] = await dbAdmin
    .select({ projectId: documents.projectId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) throw new PinAccessError();

  if (sheet.projectId !== doc.projectId) {
    throw new PinValidationError(
      "Photo and drawing sheet belong to different projects",
    );
  }
  return sheet.projectId;
}

// ─────────────────────────────────────────────────────────────────────────
// createPhotoPin
// ─────────────────────────────────────────────────────────────────────────

export interface CreatePhotoPinInput extends BaseInput {
  sheetId: string;
  documentId: string;
  x: number;
  y: number;
  note?: string | null;
}

export async function createPhotoPin(
  input: CreatePhotoPinInput,
): Promise<{ id: string }> {
  assertCoord("x", input.x);
  assertCoord("y", input.y);

  const projectId = await resolveProject(input.sheetId, input.documentId);
  const ctx = await getEffectiveContext(input.session, projectId);

  return withTenant(ctx.organization.id, async (tx) => {
    const [row] = await tx
      .insert(photoPins)
      .values({
        sheetId: input.sheetId,
        documentId: input.documentId,
        projectId,
        x: input.x.toString(),
        y: input.y.toString(),
        note: input.note ?? null,
        createdByUserId: ctx.user.id,
      })
      .returning({ id: photoPins.id });
    await writeAuditEvent(
      ctx,
      {
        action: "created",
        resourceType: "photo_pin",
        resourceId: row.id,
        details: {
          nextState: {
            sheetId: input.sheetId,
            documentId: input.documentId,
            x: input.x,
            y: input.y,
          },
        },
      },
      tx,
    );
    return { id: row.id };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// movePhotoPin — drag a marker on the sheet to a new (x, y).
// ─────────────────────────────────────────────────────────────────────────

export interface MovePhotoPinInput extends BaseInput {
  id: string;
  x: number;
  y: number;
  note?: string | null;
}

export async function movePhotoPin(input: MovePhotoPinInput): Promise<void> {
  assertCoord("x", input.x);
  assertCoord("y", input.y);

  const [row] = await dbAdmin
    .select({
      projectId: photoPins.projectId,
      x: photoPins.x,
      y: photoPins.y,
      note: photoPins.note,
    })
    .from(photoPins)
    .where(eq(photoPins.id, input.id))
    .limit(1);
  if (!row) throw new AuthorizationError("Pin not found", "not_found");

  const ctx = await getEffectiveContext(input.session, row.projectId);

  await withTenant(ctx.organization.id, async (tx) => {
    await tx
      .update(photoPins)
      .set({
        x: input.x.toString(),
        y: input.y.toString(),
        note: input.note !== undefined ? input.note : undefined,
      })
      .where(eq(photoPins.id, input.id));
    await writeAuditEvent(
      ctx,
      {
        action: "moved",
        resourceType: "photo_pin",
        resourceId: input.id,
        details: {
          previousState: { x: Number(row.x), y: Number(row.y) },
          nextState: { x: input.x, y: input.y },
        },
      },
      tx,
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────
// deletePhotoPin
// ─────────────────────────────────────────────────────────────────────────

export interface DeletePhotoPinInput extends BaseInput {
  id: string;
}

export async function deletePhotoPin(
  input: DeletePhotoPinInput,
): Promise<void> {
  const [row] = await dbAdmin
    .select({
      projectId: photoPins.projectId,
      sheetId: photoPins.sheetId,
      documentId: photoPins.documentId,
    })
    .from(photoPins)
    .where(eq(photoPins.id, input.id))
    .limit(1);
  if (!row) throw new AuthorizationError("Pin not found", "not_found");

  const ctx = await getEffectiveContext(input.session, row.projectId);

  await withTenant(ctx.organization.id, async (tx) => {
    await tx
      .delete(photoPins)
      .where(and(eq(photoPins.id, input.id)));
    await writeAuditEvent(
      ctx,
      {
        action: "deleted",
        resourceType: "photo_pin",
        resourceId: input.id,
        details: {
          previousState: {
            sheetId: row.sheetId,
            documentId: row.documentId,
          },
        },
      },
      tx,
    );
  });
}
