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
  // Presigned GET for the thumbnail PNG when one exists. Null when the
  // sheet hasn't been thumbnailed yet — the index view falls back to a
  // sheet-number placeholder in that case. Presigns are short-lived;
  // reloading the index refreshes them.
  thumbnailUrl: string | null;
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
  // Editing sheet metadata (number / title / discipline) is a set-wide
  // state operation, so we gate on `drawing:write` — same as upload.
  // Subs who can annotate but not manage sets stay read-only in the
  // index view's thumbnail cards.
  canEditSheets: boolean;
  // Short-lived presigned GET URL for the source PDF — used client-side by
  // the thumbnail minter to render missing thumbnails. Null if the set
  // hasn't finished uploading yet. Separate from the detail-view
  // presigned URL so index-only visits don't pull an expensive one.
  sourcePresignedUrl: string | null;
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

  // Presign thumbnail GET URLs in parallel for any sheet that has one.
  // Short TTL since the index view is a relatively brief browser session
  // and reloads naturally refresh these.
  const { presignDownloadUrl } = await import("@/lib/storage");
  const thumbnailUrlByKey = new Map<string, string>();
  const uniqueKeys = Array.from(
    new Set(baseRows.map((r) => r.thumbnailKey).filter((k): k is string => !!k)),
  );
  if (uniqueKeys.length > 0) {
    const presigned = await Promise.all(
      uniqueKeys.map((k) =>
        presignDownloadUrl({ key: k, expiresInSeconds: 60 * 10 }),
      ),
    );
    uniqueKeys.forEach((k, i) => thumbnailUrlByKey.set(k, presigned[i]));
  }

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
    thumbnailUrl: r.thumbnailKey
      ? thumbnailUrlByKey.get(r.thumbnailKey) ?? null
      : null,
  }));

  // Presign the source PDF only if there's at least one sheet lacking a
  // thumbnail — the URL is consumed by the client-side ThumbnailMinter,
  // and there's no reason to pay for a presign on fully-thumbnailed sets.
  let sourcePresignedUrl: string | null = null;
  const needsMint = sheets.some((s) => !s.thumbnailKey);
  if (needsMint) {
    const [setRow] = await db
      .select({ sourceFileKey: drawingSets.sourceFileKey })
      .from(drawingSets)
      .where(eq(drawingSets.id, input.setId))
      .limit(1);
    if (setRow?.sourceFileKey) {
      const { presignDownloadUrl: presignGet } = await import("@/lib/storage");
      sourcePresignedUrl = await presignGet({
        key: setRow.sourceFileKey,
        expiresInSeconds: 60 * 10,
      });
    }
  }

  return {
    context: ctx,
    portal: portalFor(ctx),
    set,
    versionChain,
    sheets,
    scopeDiscipline: scope,
    canUpload: ctx.permissions.can("drawing", "write"),
    canEditSheets: ctx.permissions.can("drawing", "write"),
    sourcePresignedUrl,
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
  // Compare target: the immediately-preceding version of this sheet,
  // matched on sheet_number. Null when the current set has no
  // supersedesId or when no sheet with the same number exists in the
  // prior set (the sheet was added in this version). The viewer renders
  // an "Added in this version" card in that case.
  compare: {
    priorSet: { id: string; name: string; version: number } | null;
    priorSheet: {
      id: string;
      pageIndex: number;
      sheetNumber: string;
      sheetTitle: string;
    } | null;
    priorPresignedSourceUrl: string | null;
    unmatched: boolean;
  };
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

  // Compare target resolution — the "prior version" of this sheet is the
  // sheet_number-matching row in the set the current one supersedes. If
  // there is no supersedesId, compare mode is simply unavailable. If the
  // supersedesId is set but the sheet doesn't exist there (the sheet was
  // added in this version), we still tell the viewer about the prior set
  // so the toolbar can render an "Added in this version" state card
  // instead of silently hiding the button.
  let compare: DrawingSheetDetailView["compare"] = {
    priorSet: null,
    priorSheet: null,
    priorPresignedSourceUrl: null,
    unmatched: false,
  };
  const [currentSetFull] = await db
    .select({
      supersedesId: drawingSets.supersedesId,
    })
    .from(drawingSets)
    .where(eq(drawingSets.id, input.setId))
    .limit(1);
  if (currentSetFull?.supersedesId) {
    const [priorSetRow] = await db
      .select({
        id: drawingSets.id,
        name: drawingSets.name,
        version: drawingSets.version,
        sourceFileKey: drawingSets.sourceFileKey,
      })
      .from(drawingSets)
      .where(eq(drawingSets.id, currentSetFull.supersedesId))
      .limit(1);
    if (priorSetRow) {
      const [priorSheetRow] = await db
        .select({
          id: drawingSheets.id,
          pageIndex: drawingSheets.pageIndex,
          sheetNumber: drawingSheets.sheetNumber,
          sheetTitle: drawingSheets.sheetTitle,
        })
        .from(drawingSheets)
        .where(
          and(
            eq(drawingSheets.setId, priorSetRow.id),
            eq(drawingSheets.sheetNumber, sheet.sheetNumber),
          ),
        )
        .limit(1);
      const priorPresigned = priorSetRow.sourceFileKey
        ? await presignDownloadUrl({
            key: priorSetRow.sourceFileKey,
            expiresInSeconds: 60 * 30,
          })
        : null;
      compare = {
        priorSet: {
          id: priorSetRow.id,
          name: priorSetRow.name,
          version: priorSetRow.version,
        },
        priorSheet: priorSheetRow
          ? {
              id: priorSheetRow.id,
              pageIndex: priorSheetRow.pageIndex,
              sheetNumber: priorSheetRow.sheetNumber,
              sheetTitle: priorSheetRow.sheetTitle,
            }
          : null,
        priorPresignedSourceUrl: priorPresigned,
        unmatched: !priorSheetRow,
      };
    }
  }

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
    compare,
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

// Closeout integration (Step 48). Returns the as-built drawing sets for a
// project so the closeout package builder can bundle final record sheets.
// Contractor-only data; the closeout flow enforces its own permissions.
// Returns each as-built set with sheet count + source storage key + the
// version label for listing. Ordered newest first so the closeout UI
// surfaces the most recent as-built by default.
export async function getAsBuiltDrawingSetsForCloseout(
  projectId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    version: number;
    family: string;
    sheetCount: number;
    sourceFileKey: string | null;
    uploadedAt: string;
  }>
> {
  const rows = await db
    .select({
      id: drawingSets.id,
      name: drawingSets.name,
      version: drawingSets.version,
      family: drawingSets.family,
      sheetCount: drawingSets.sheetCount,
      sourceFileKey: drawingSets.sourceFileKey,
      uploadedAt: drawingSets.uploadedAt,
    })
    .from(drawingSets)
    .where(
      and(eq(drawingSets.projectId, projectId), eq(drawingSets.asBuilt, true)),
    )
    .orderBy(desc(drawingSets.uploadedAt));
  return rows.map((r) => ({ ...r, uploadedAt: r.uploadedAt.toISOString() }));
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
