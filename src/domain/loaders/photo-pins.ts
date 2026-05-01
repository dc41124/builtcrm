import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  documents,
  drawingSets,
  drawingSheets,
  photoPins,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// ─────────────────────────────────────────────────────────────────────────
// Loader DTOs
// ─────────────────────────────────────────────────────────────────────────

export interface PhotoPinRow {
  id: string;
  sheetId: string;
  documentId: string;
  documentTitle: string;
  documentStorageKey: string;
  x: number;
  y: number;
  note: string | null;
  createdAt: Date;
  createdByUserId: string | null;
  createdByName: string | null;
}

export interface SheetPinView {
  sheetId: string;
  pins: PhotoPinRow[];
}

// ─────────────────────────────────────────────────────────────────────────
// getSheetPins — every pin on one sheet. Used by the drawing-sheet viewer
// to render markers.
// ─────────────────────────────────────────────────────────────────────────

export async function getSheetPins(input: {
  session: SessionLike | null | undefined;
  sheetId: string;
}): Promise<SheetPinView> {
  // Resolve the project from the sheet so getEffectiveContext can run.
  const [sheet] = await dbAdmin
    .select({ projectId: drawingSets.projectId })
    .from(drawingSheets)
    .innerJoin(drawingSets, eq(drawingSets.id, drawingSheets.setId))
    .where(eq(drawingSheets.id, input.sheetId))
    .limit(1);
  if (!sheet) {
    throw new AuthorizationError("Sheet not found", "not_found");
  }
  const ctx = await getEffectiveContext(input.session, sheet.projectId);

  const rows = await withTenant(ctx.organization.id, async (tx) => {
    return tx
      .select({
        id: photoPins.id,
        sheetId: photoPins.sheetId,
        documentId: photoPins.documentId,
        documentTitle: documents.title,
        documentStorageKey: documents.storageKey,
        x: photoPins.x,
        y: photoPins.y,
        note: photoPins.note,
        createdAt: photoPins.createdAt,
        createdByUserId: photoPins.createdByUserId,
        createdByName: users.displayName,
      })
      .from(photoPins)
      .innerJoin(documents, eq(documents.id, photoPins.documentId))
      .leftJoin(users, eq(users.id, photoPins.createdByUserId))
      .where(eq(photoPins.sheetId, input.sheetId))
      .orderBy(asc(photoPins.createdAt));
  });

  return {
    sheetId: input.sheetId,
    pins: rows.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      documentStorageKey: r.documentStorageKey,
      x: Number(r.x),
      y: Number(r.y),
      note: r.note,
      createdAt: r.createdAt,
      createdByUserId: r.createdByUserId,
      createdByName: r.createdByName,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// getDocumentPins — every pin a single photo has across all sheets it's
// dropped on. Powers the photo-detail "Pinned on" rail.
// ─────────────────────────────────────────────────────────────────────────

export interface DocumentPinRow {
  id: string;
  sheetId: string;
  sheetNumber: string;
  sheetTitle: string;
  setId: string;
  x: number;
  y: number;
  note: string | null;
  createdAt: Date;
}

export interface DocumentPinView {
  documentId: string;
  pins: DocumentPinRow[];
}

export async function getDocumentPins(input: {
  session: SessionLike | null | undefined;
  documentId: string;
}): Promise<DocumentPinView> {
  // Resolve project from the document.
  const [doc] = await dbAdmin
    .select({ projectId: documents.projectId })
    .from(documents)
    .where(eq(documents.id, input.documentId))
    .limit(1);
  if (!doc) {
    throw new AuthorizationError("Document not found", "not_found");
  }
  const ctx = await getEffectiveContext(input.session, doc.projectId);

  const rows = await withTenant(ctx.organization.id, async (tx) => {
    return tx
      .select({
        id: photoPins.id,
        sheetId: photoPins.sheetId,
        sheetNumber: drawingSheets.sheetNumber,
        sheetTitle: drawingSheets.sheetTitle,
        setId: drawingSheets.setId,
        x: photoPins.x,
        y: photoPins.y,
        note: photoPins.note,
        createdAt: photoPins.createdAt,
      })
      .from(photoPins)
      .innerJoin(drawingSheets, eq(drawingSheets.id, photoPins.sheetId))
      .where(eq(photoPins.documentId, input.documentId))
      .orderBy(desc(photoPins.createdAt));
  });

  return {
    documentId: input.documentId,
    pins: rows.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      sheetNumber: r.sheetNumber,
      sheetTitle: r.sheetTitle,
      setId: r.setId,
      x: Number(r.x),
      y: Number(r.y),
      note: r.note,
      createdAt: r.createdAt,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// listProjectPhotosForPicker — image-mime documents on a project, used by
// the "Pin here" picker. Hits documents directly with a coarse mime-type
// filter. Returns up to 200 rows.
// ─────────────────────────────────────────────────────────────────────────

export interface PickerPhotoRow {
  id: string;
  title: string;
  storageKey: string;
  uploadedAt: Date;
}

export async function listProjectPhotosForPicker(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<PickerPhotoRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);

  const rows = await withTenant(ctx.organization.id, async (tx) => {
    return tx
      .select({
        id: documents.id,
        title: documents.title,
        storageKey: documents.storageKey,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, input.projectId),
          inArray(documents.documentStatus, ["active"]),
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(200);
  });
  // The documents table doesn't carry a discrete mime/file-type column;
  // the picker filters client-side by storage_key extension. We surface
  // every document and let the client narrow — same approach the
  // safety-forms wizard uses for the photo field.
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    storageKey: r.storageKey,
    uploadedAt: r.createdAt,
  }));
}
