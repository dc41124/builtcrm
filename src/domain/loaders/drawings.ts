// Read-side loaders for the drawings module. Three views:
//   - getDrawingSetsIndex: contractor + sub sets list (sets view)
//   - getDrawingSetIndex:  per-set sheet index (thumbnail grid view)
//   - getDrawingSheetDetail: per-sheet detail (PDF viewer page)
//
// Sub-scoped filtering: when the role is subcontractor_user, the loader
// looks up the sub org's scope_discipline on project_organization_memberships
// and restricts drawing_sheets to that discipline (nulls included so
// the sub at least sees uncoded cover sheets). Contractors + clients are
// unscoped. If a sub membership has NULL scope_discipline, the sub sees
// everything (the NULL is the "no filter" signal, not "empty filter").

import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  drawingComments,
  drawingMarkups,
  drawingMeasurements,
  drawingSets,
  drawingSheets,
  organizations,
  projectOrganizationMemberships,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";

export type DrawingsPortal = "contractor" | "subcontractor" | "client";

export type DrawingSetSummary = {
  id: string;
  family: string;
  name: string;
  version: number;
  status: "current" | "superseded" | "historical";
  asBuilt: boolean;
  sheetCount: number;
  fileSizeBytes: number | null;
  supersedesId: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  note: string | null;
  processingStatus: "pending" | "processing" | "ready" | "failed";
};

export type SheetSummary = {
  id: string;
  setId: string;
  pageIndex: number;
  sheetNumber: string;
  sheetTitle: string;
  discipline: string | null;
  autoDetected: boolean;
  thumbnailKey: string | null;
  changedFromPriorVersion: boolean;
  markupCount: number;
  commentCount: number;
};

export type MarkupDoc = {
  id: string;
  userId: string;
  userName: string | null;
  userInitials: string;
  markupData: unknown;
};

export type MeasurementDoc = {
  id: string;
  userId: string;
  userName: string | null;
  userInitials: string;
  measurementData: unknown;
};

export type CommentRow = {
  id: string;
  parentCommentId: string | null;
  userId: string;
  userName: string | null;
  userInitials: string;
  pinNumber: number | null;
  x: number;
  y: number;
  text: string;
  resolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
};

async function resolveScopeDiscipline(
  ctx: EffectiveContext,
): Promise<string | null> {
  if (ctx.role !== "subcontractor_user") return null;
  const [row] = await db
    .select({ scope: projectOrganizationMemberships.scopeDiscipline })
    .from(projectOrganizationMemberships)
    .where(
      and(
        eq(projectOrganizationMemberships.projectId, ctx.project.id),
        eq(projectOrganizationMemberships.organizationId, ctx.organization.id),
      ),
    )
    .limit(1);
  return row?.scope ?? null;
}

function initialsFrom(displayName: string | null, email?: string): string {
  const source = displayName || email || "";
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export type DrawingsSetsView = {
  context: EffectiveContext;
  portal: DrawingsPortal;
  canUpload: boolean;
  sets: DrawingSetSummary[];
  activity: Array<{
    kind: "upload" | "supersede" | "asbuilt";
    text: string;
    time: string;
  }>;
};

function portalFor(ctx: EffectiveContext): DrawingsPortal {
  if (ctx.role === "contractor_admin" || ctx.role === "contractor_pm")
    return "contractor";
  if (ctx.role === "subcontractor_user") return "subcontractor";
  return "client";
}

export async function getDrawingSetsIndex(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<DrawingsSetsView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);

  const rows = await db
    .select({
      id: drawingSets.id,
      family: drawingSets.family,
      name: drawingSets.name,
      version: drawingSets.version,
      status: drawingSets.status,
      asBuilt: drawingSets.asBuilt,
      sheetCount: drawingSets.sheetCount,
      fileSizeBytes: drawingSets.fileSizeBytes,
      supersedesId: drawingSets.supersedesId,
      note: drawingSets.note,
      processingStatus: drawingSets.processingStatus,
      uploadedAt: drawingSets.uploadedAt,
      uploadedByName: users.displayName,
      uploadedByEmail: users.email,
    })
    .from(drawingSets)
    .leftJoin(users, eq(users.id, drawingSets.uploadedByUserId))
    .where(eq(drawingSets.projectId, input.projectId))
    .orderBy(desc(drawingSets.uploadedAt));

  const sets: DrawingSetSummary[] = rows.map((r) => ({
    id: r.id,
    family: r.family,
    name: r.name,
    version: r.version,
    status: r.status,
    asBuilt: r.asBuilt,
    sheetCount: r.sheetCount,
    fileSizeBytes: r.fileSizeBytes,
    supersedesId: r.supersedesId,
    uploadedByName: r.uploadedByName ?? r.uploadedByEmail ?? null,
    uploadedAt: r.uploadedAt.toISOString(),
    note: r.note,
    processingStatus: r.processingStatus,
  }));

  const activity = sets.slice(0, 12).map((s) => ({
    kind: "upload" as const,
    text: `${s.uploadedByName ?? "Someone"} uploaded ${s.name} v${s.version}${
      s.sheetCount ? ` (${s.sheetCount} sheets)` : ""
    }`,
    time: s.uploadedAt,
  }));

  return {
    context: ctx,
    portal: portalFor(ctx),
    canUpload: ctx.permissions.can("drawing", "write"),
    sets,
    activity,
  };
}

export type DrawingSetIndexView = {
  context: EffectiveContext;
  portal: DrawingsPortal;
  set: DrawingSetSummary;
  versionChain: DrawingSetSummary[];
  sheets: SheetSummary[];
  scopeDiscipline: string | null;
  canUpload: boolean;
};

export async function getDrawingSetIndex(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  setId: string;
}): Promise<DrawingSetIndexView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const scope = await resolveScopeDiscipline(ctx);

  const allSets = (await getDrawingSetsIndex({
    session: input.session,
    projectId: input.projectId,
  })).sets;

  const set = allSets.find((s) => s.id === input.setId);
  if (!set) throw new Error("drawing set not found");

  const versionChain = allSets
    .filter((s) => s.family === set.family)
    .sort((a, b) => b.version - a.version);

  const baseRows = await db
    .select({
      id: drawingSheets.id,
      setId: drawingSheets.setId,
      pageIndex: drawingSheets.pageIndex,
      sheetNumber: drawingSheets.sheetNumber,
      sheetTitle: drawingSheets.sheetTitle,
      discipline: drawingSheets.discipline,
      autoDetected: drawingSheets.autoDetected,
      thumbnailKey: drawingSheets.thumbnailKey,
      changedFromPriorVersion: drawingSheets.changedFromPriorVersion,
    })
    .from(drawingSheets)
    .where(
      scope
        ? and(
            eq(drawingSheets.setId, input.setId),
            or(
              eq(drawingSheets.discipline, scope),
              isNull(drawingSheets.discipline),
            )!,
          )
        : eq(drawingSheets.setId, input.setId),
    )
    .orderBy(asc(drawingSheets.pageIndex));

  // Counts of markups + comments per sheet (aggregated in app code to keep
  // drizzle usage simple — two narrow SELECTs rather than a window query).
  const ids = baseRows.map((r) => r.id);
  const markupCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();
  if (ids.length > 0) {
    const markupRows = await db
      .select({ sheetId: drawingMarkups.sheetId, id: drawingMarkups.id })
      .from(drawingMarkups)
      .where(inArray(drawingMarkups.sheetId, ids));
    for (const r of markupRows) {
      markupCounts.set(r.sheetId, (markupCounts.get(r.sheetId) ?? 0) + 1);
    }
    const commentRows = await db
      .select({ sheetId: drawingComments.sheetId, id: drawingComments.id })
      .from(drawingComments)
      .where(
        and(
          inArray(drawingComments.sheetId, ids),
          isNull(drawingComments.parentCommentId),
        ),
      );
    for (const r of commentRows) {
      commentCounts.set(r.sheetId, (commentCounts.get(r.sheetId) ?? 0) + 1);
    }
  }

  const sheets: SheetSummary[] = baseRows.map((r) => ({
    ...r,
    markupCount: markupCounts.get(r.id) ?? 0,
    commentCount: commentCounts.get(r.id) ?? 0,
  }));

  return {
    context: ctx,
    portal: portalFor(ctx),
    set,
    versionChain,
    sheets,
    scopeDiscipline: scope,
    canUpload: ctx.permissions.can("drawing", "write"),
  };
}

export type DrawingSheetDetailView = {
  context: EffectiveContext;
  portal: DrawingsPortal;
  currentUserId: string;
  set: DrawingSetSummary;
  versionChain: DrawingSetSummary[];
  sheet: SheetSummary;
  sheetSiblings: SheetSummary[];
  markups: MarkupDoc[];
  measurements: MeasurementDoc[];
  comments: CommentRow[];
  calibration: {
    scale: string | null;
    source: "title_block" | "manual" | null;
    calibratedAt: string | null;
    calibratedByName: string | null;
  };
  presignedSourceUrl: string;
  scopeDiscipline: string | null;
  canAnnotate: boolean;
  canCalibrate: boolean;
};

export async function getDrawingSheetDetail(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  setId: string;
  sheetId: string;
}): Promise<DrawingSheetDetailView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const scope = await resolveScopeDiscipline(ctx);

  const index = await getDrawingSetIndex({
    session: input.session,
    projectId: input.projectId,
    setId: input.setId,
  });
  const sheet = index.sheets.find((s) => s.id === input.sheetId);
  if (!sheet) throw new Error("sheet not found or not in scope");

  // Load full sheet row for calibration info (index summary doesn't carry it).
  const [sheetFull] = await db
    .select()
    .from(drawingSheets)
    .where(eq(drawingSheets.id, input.sheetId))
    .limit(1);
  if (!sheetFull) throw new Error("sheet not found");

  let calibratedByName: string | null = null;
  if (sheetFull.calibratedByUserId) {
    const [u] = await db
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, sheetFull.calibratedByUserId))
      .limit(1);
    calibratedByName = u?.displayName ?? u?.email ?? null;
  }

  const markupRows = await db
    .select({
      id: drawingMarkups.id,
      userId: drawingMarkups.userId,
      markupData: drawingMarkups.markupData,
      displayName: users.displayName,
      email: users.email,
    })
    .from(drawingMarkups)
    .leftJoin(users, eq(users.id, drawingMarkups.userId))
    .where(eq(drawingMarkups.sheetId, input.sheetId));
  const markups: MarkupDoc[] = markupRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.displayName ?? r.email ?? null,
    userInitials: initialsFrom(r.displayName, r.email ?? undefined),
    markupData: r.markupData,
  }));

  const measurementRows = await db
    .select({
      id: drawingMeasurements.id,
      userId: drawingMeasurements.userId,
      measurementData: drawingMeasurements.measurementData,
      displayName: users.displayName,
      email: users.email,
    })
    .from(drawingMeasurements)
    .leftJoin(users, eq(users.id, drawingMeasurements.userId))
    .where(eq(drawingMeasurements.sheetId, input.sheetId));
  const measurements: MeasurementDoc[] = measurementRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.displayName ?? r.email ?? null,
    userInitials: initialsFrom(r.displayName, r.email ?? undefined),
    measurementData: r.measurementData,
  }));

  const commentRows = await db
    .select({
      id: drawingComments.id,
      parentCommentId: drawingComments.parentCommentId,
      userId: drawingComments.userId,
      pinNumber: drawingComments.pinNumber,
      x: drawingComments.x,
      y: drawingComments.y,
      text: drawingComments.text,
      resolved: drawingComments.resolved,
      resolvedAt: drawingComments.resolvedAt,
      createdAt: drawingComments.createdAt,
      displayName: users.displayName,
      email: users.email,
    })
    .from(drawingComments)
    .leftJoin(users, eq(users.id, drawingComments.userId))
    .where(eq(drawingComments.sheetId, input.sheetId))
    .orderBy(asc(drawingComments.pinNumber), asc(drawingComments.createdAt));

  const comments: CommentRow[] = commentRows.map((r) => ({
    id: r.id,
    parentCommentId: r.parentCommentId,
    userId: r.userId,
    userName: r.displayName ?? r.email ?? null,
    userInitials: initialsFrom(r.displayName, r.email ?? undefined),
    pinNumber: r.pinNumber,
    x: Number(r.x),
    y: Number(r.y),
    text: r.text,
    resolved: r.resolved,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  // Presigned GET for the source PDF. Short TTL — regenerated on each page
  // load. The react-pdf viewer streams pages as needed from this URL.
  const [setRow] = await db
    .select({ sourceFileKey: drawingSets.sourceFileKey })
    .from(drawingSets)
    .where(eq(drawingSets.id, input.setId))
    .limit(1);
  if (!setRow?.sourceFileKey)
    throw new Error("set has no source PDF in storage");

  const { presignDownloadUrl } = await import("@/lib/storage");
  const presignedSourceUrl = await presignDownloadUrl({
    key: setRow.sourceFileKey,
    expiresInSeconds: 60 * 30,
  });

  return {
    context: ctx,
    portal: portalFor(ctx),
    set: index.set,
    versionChain: index.versionChain,
    sheet,
    sheetSiblings: index.sheets,
    markups,
    measurements,
    comments,
    calibration: {
      scale: sheetFull.calibrationScale,
      source: sheetFull.calibrationSource,
      calibratedAt: sheetFull.calibratedAt
        ? sheetFull.calibratedAt.toISOString()
        : null,
      calibratedByName,
    },
    presignedSourceUrl,
    scopeDiscipline: scope,
    canAnnotate: ctx.permissions.can("drawing_markup", "write"),
    canCalibrate: ctx.permissions.can("drawing", "write"),
    currentUserId: ctx.user.id,
  };
}

// Discipline counts for the index view's filter chips. Keyed by the single-
// char discipline code; null-bucket is reported under the "all" total only.
export function computeDisciplineCounts(
  sheets: SheetSummary[],
): Record<string, number> {
  const counts: Record<string, number> = { all: sheets.length };
  for (const s of sheets) {
    if (s.discipline) counts[s.discipline] = (counts[s.discipline] ?? 0) + 1;
  }
  return counts;
}

// Org-level subcontractor roster for a project. Used by the drawings module
// in future to show "this sub's scope" badges on sets/sheets — pulled
// separately so pages can decide whether to display.
export async function getProjectSubScopes(projectId: string): Promise<
  Array<{ orgId: string; orgName: string; discipline: string | null }>
> {
  const rows = await db
    .select({
      orgId: organizations.id,
      orgName: organizations.name,
      discipline: projectOrganizationMemberships.scopeDiscipline,
    })
    .from(projectOrganizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, projectOrganizationMemberships.organizationId),
    )
    .where(
      and(
        eq(projectOrganizationMemberships.projectId, projectId),
        eq(projectOrganizationMemberships.membershipType, "subcontractor"),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    );
  return rows;
}
