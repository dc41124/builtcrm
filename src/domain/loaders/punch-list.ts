import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  documents,
  organizations,
  projects,
  punchItemComments,
  punchItemPhotos,
  punchItems,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import type { PunchStatus } from "@/lib/punch-list/config";
import { presignDownloadUrl } from "@/lib/storage";

// Role-aware punch-list loaders. Three access tiers:
//
//  - Contractor: sees all items on their projects, all fields.
//  - Subcontractor: sees only items where assigneeOrgId = their org.
//  - Residential client: redacted shape (title, description, location,
//    clientFacingNote, photos, friendly-labeled status + dates). Never
//    sees raw enum names, internal comments, or rejection reasons.
//    Also only sees items when project.currentPhase = 'closeout';
//    otherwise the page renders its empty-state block.
//  - Commercial client: NO access in Phase 4 (deferred to Phase 5).
//
// Each loader gates upfront via getEffectiveContext and returns the
// shape tailored to that role. Clients get the redacted type union
// member; sub/contractor get the full shape.

export type PunchItemPriority = "low" | "normal" | "high" | "urgent";

export type PunchItemPhotoRow = {
  id: string;
  documentId: string;
  caption: string | null;
  sortOrder: number;
  url: string;
  title: string;
};

export type PunchItemListRow = {
  id: string;
  sequentialNumber: number;
  title: string;
  description: string;
  location: string | null;
  priority: PunchItemPriority;
  status: PunchStatus;
  assigneeOrgId: string | null;
  assigneeOrgName: string | null;
  assigneeUserId: string | null;
  assigneeUserName: string | null;
  dueDate: string | null;
  createdByUserId: string;
  createdByName: string | null;
  rejectionReason: string | null;
  voidReason: string | null;
  verifiedByUserId: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  lastTransitionAt: string;
  clientFacingNote: string | null;
  photoCount: number;
  commentCount: number;
  createdAt: string;
  ageDays: number;
};

export type PunchItemCommentRow = {
  id: string;
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  isSystem: boolean;
  createdAt: string;
};

export type PunchItemDetailFull = PunchItemListRow & {
  mode: "full";
  photos: PunchItemPhotoRow[];
  comments: PunchItemCommentRow[];
};

// Residential redacted shape — strip internal-only fields, drop the
// raw status enum, friendly-label it upstream.
export type PunchItemResidentialRow = {
  id: string;
  sequentialNumber: number;
  title: string;
  description: string;
  location: string | null;
  status: PunchStatus; // UI passes through RESIDENTIAL_FRIENDLY[status]
  clientFacingNote: string | null;
  photos: PunchItemPhotoRow[];
  addedOnIso: string;
  updatedOnIso: string | null;
};

// -----------------------------------------------------------------
// getPunchItems — list view.
// -----------------------------------------------------------------

export type GetPunchItemsInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getPunchItems(
  input: GetPunchItemsInput,
): Promise<PunchItemListRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Only contractors and subcontractors use this loader",
      "forbidden",
    );
  }

  const whereParts = [eq(punchItems.projectId, input.projectId)];
  if (isSub) {
    whereParts.push(eq(punchItems.assigneeOrgId, ctx.organization.id));
  }

  // Alias tables for the multiple-user joins. Drizzle v0.41+ supports
  // alias() but a simpler approach: do the main query with
  // reporter/verifier joins then look up names in a second batch.
  const { rows, userNameById, photoBy, commentBy } = await withTenant(
    ctx.organization.id,
    async (tx) => {
      const rows = await tx
        .select({
          id: punchItems.id,
          sequentialNumber: punchItems.sequentialNumber,
          title: punchItems.title,
          description: punchItems.description,
          location: punchItems.location,
          priority: punchItems.priority,
          status: punchItems.status,
          assigneeOrgId: punchItems.assigneeOrgId,
          assigneeOrgName: organizations.name,
          assigneeUserId: punchItems.assigneeUserId,
          dueDate: punchItems.dueDate,
          createdByUserId: punchItems.createdByUserId,
          rejectionReason: punchItems.rejectionReason,
          voidReason: punchItems.voidReason,
          verifiedByUserId: punchItems.verifiedByUserId,
          verifiedAt: punchItems.verifiedAt,
          lastTransitionAt: punchItems.lastTransitionAt,
          clientFacingNote: punchItems.clientFacingNote,
          createdAt: punchItems.createdAt,
        })
        .from(punchItems)
        .leftJoin(
          organizations,
          eq(organizations.id, punchItems.assigneeOrgId),
        )
        .where(and(...whereParts))
        .orderBy(desc(punchItems.lastTransitionAt));

      if (rows.length === 0) {
        return {
          rows,
          userNameById: new Map<string, string | null>(),
          photoBy: new Map<string, number>(),
          commentBy: new Map<string, number>(),
        };
      }

      // Batch user lookups.
      const userIds = new Set<string>();
      for (const r of rows) {
        userIds.add(r.createdByUserId);
        if (r.assigneeUserId) userIds.add(r.assigneeUserId);
        if (r.verifiedByUserId) userIds.add(r.verifiedByUserId);
      }
      const userRows = await tx
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));
      const userNameById = new Map(userRows.map((u) => [u.id, u.displayName]));

      // Counts: photos + non-system comments grouped by item id.
      const itemIds = rows.map((r) => r.id);
      const [photoCounts, commentCounts] = await Promise.all([
        tx
          .select({
            itemId: punchItemPhotos.punchItemId,
            c: sql<number>`count(*)::int`,
          })
          .from(punchItemPhotos)
          .where(inArray(punchItemPhotos.punchItemId, itemIds))
          .groupBy(punchItemPhotos.punchItemId),
        tx
          .select({
            itemId: punchItemComments.punchItemId,
            c: sql<number>`count(*)::int`,
          })
          .from(punchItemComments)
          .where(
            and(
              inArray(punchItemComments.punchItemId, itemIds),
              eq(punchItemComments.isSystem, false),
            ),
          )
          .groupBy(punchItemComments.punchItemId),
      ]);
      const photoBy = new Map(photoCounts.map((p) => [p.itemId, p.c]));
      const commentBy = new Map(commentCounts.map((p) => [p.itemId, p.c]));

      return { rows, userNameById, photoBy, commentBy };
    },
  );

  if (rows.length === 0) return [];

  const now = new Date();
  return rows.map((r) => {
    const createdAt = r.createdAt;
    return {
      id: r.id,
      sequentialNumber: r.sequentialNumber,
      title: r.title,
      description: r.description,
      location: r.location,
      priority: r.priority,
      status: r.status,
      assigneeOrgId: r.assigneeOrgId,
      assigneeOrgName: r.assigneeOrgName,
      assigneeUserId: r.assigneeUserId,
      assigneeUserName: r.assigneeUserId
        ? userNameById.get(r.assigneeUserId) ?? null
        : null,
      dueDate: r.dueDate,
      createdByUserId: r.createdByUserId,
      createdByName: userNameById.get(r.createdByUserId) ?? null,
      rejectionReason: r.rejectionReason,
      voidReason: r.voidReason,
      verifiedByUserId: r.verifiedByUserId,
      verifiedByName: r.verifiedByUserId
        ? userNameById.get(r.verifiedByUserId) ?? null
        : null,
      verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
      lastTransitionAt: r.lastTransitionAt.toISOString(),
      clientFacingNote: r.clientFacingNote,
      photoCount: photoBy.get(r.id) ?? 0,
      commentCount: commentBy.get(r.id) ?? 0,
      createdAt: createdAt.toISOString(),
      ageDays: Math.max(
        0,
        Math.floor((now.getTime() - createdAt.getTime()) / 86400000),
      ),
    };
  });
}

// -----------------------------------------------------------------
// getPunchItem — detail view, full shape with photos + comments.
// -----------------------------------------------------------------

export type GetPunchItemInput = {
  session: SessionLike | null | undefined;
  itemId: string;
};

export async function getPunchItem(
  input: GetPunchItemInput,
): Promise<PunchItemDetailFull> {
  // Pre-tenant head lookup: tenant unknown until project resolves.
  const [itemHead] = await dbAdmin
    .select({ id: punchItems.id, projectId: punchItems.projectId })
    .from(punchItems)
    .where(eq(punchItems.id, input.itemId))
    .limit(1);
  if (!itemHead) {
    throw new AuthorizationError("Punch item not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, itemHead.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Clients use the residential walkthrough loader",
      "forbidden",
    );
  }

  const [heads] = await Promise.all([
    getPunchItems({ session: input.session, projectId: itemHead.projectId }),
  ]);
  const head = heads.find((h) => h.id === input.itemId);
  if (!head) {
    throw new AuthorizationError("Punch item not found", "not_found");
  }

  // Sub filter enforcement — if they land here via a direct URL for
  // someone else's item, 403.
  if (isSub && head.assigneeOrgId !== ctx.organization.id) {
    throw new AuthorizationError(
      "Not assigned to your organization",
      "forbidden",
    );
  }

  const { photos, comments } = await withTenant(ctx.organization.id, async (tx) => {
    const [photos, comments] = await Promise.all([
      queryPhotos(tx, input.itemId),
      queryComments(tx, input.itemId),
    ]);
    return { photos, comments };
  });

  return { ...head, mode: "full", photos, comments };
}

// -----------------------------------------------------------------
// getResidentialWalkthroughItems — phase-gated, redacted list.
//
// Returns empty array (and the UI renders the empty-state help card)
// when project.currentPhase !== 'closeout'. Void items are NEVER
// surfaced regardless of phase.
// -----------------------------------------------------------------

export type GetResidentialWalkthroughItemsInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export type ResidentialWalkthroughView = {
  project: {
    id: string;
    name: string;
    currentPhase: string;
    inCloseout: boolean;
  };
  items: PunchItemResidentialRow[];
};

export async function getResidentialWalkthroughItems(
  input: GetResidentialWalkthroughItemsInput,
): Promise<ResidentialWalkthroughView> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "residential_client") {
    throw new AuthorizationError(
      "Only residential clients see this loader",
      "forbidden",
    );
  }

  type WalkRow = {
    id: string;
    sequentialNumber: number;
    title: string;
    description: string;
    location: string | null;
    status: PunchStatus;
    clientFacingNote: string | null;
    addedOn: Date;
    updatedOn: Date;
  };
  const { projectRow, rows } = await withTenant(ctx.organization.id, async (tx) => {
    const [projectRow] = await tx
      .select({
        id: projects.id,
        name: projects.name,
        currentPhase: projects.currentPhase,
      })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);
    if (!projectRow) {
      return { projectRow: null, rows: [] as WalkRow[] };
    }

    const inCloseout = projectRow.currentPhase === "closeout";
    if (!inCloseout) {
      return { projectRow, rows: [] as WalkRow[] };
    }

    const rows: WalkRow[] = await tx
      .select({
        id: punchItems.id,
        sequentialNumber: punchItems.sequentialNumber,
        title: punchItems.title,
        description: punchItems.description,
        location: punchItems.location,
        status: punchItems.status,
        clientFacingNote: punchItems.clientFacingNote,
        addedOn: punchItems.createdAt,
        updatedOn: punchItems.lastTransitionAt,
      })
      .from(punchItems)
      .where(
        and(
          eq(punchItems.projectId, input.projectId),
          // Void items never surface for residential per handoff doc.
          sql`${punchItems.status} <> 'void'`,
        ),
      )
      .orderBy(desc(punchItems.lastTransitionAt));

    return { projectRow, rows };
  });

  if (!projectRow) {
    throw new AuthorizationError("Project not found", "not_found");
  }

  const inCloseout = projectRow.currentPhase === "closeout";
  if (!inCloseout) {
    return {
      project: {
        id: projectRow.id,
        name: projectRow.name,
        currentPhase: projectRow.currentPhase,
        inCloseout: false,
      },
      items: [],
    };
  }

  if (rows.length === 0) {
    return {
      project: {
        id: projectRow.id,
        name: projectRow.name,
        currentPhase: projectRow.currentPhase,
        inCloseout: true,
      },
      items: [],
    };
  }

  const itemIds = rows.map((r) => r.id);
  const photoRows = await withTenant(ctx.organization.id, (tx) =>
    queryPhotosForMany(tx, itemIds),
  );
  const photosByItem = new Map<string, PunchItemPhotoRow[]>();
  for (const p of photoRows) {
    const arr = photosByItem.get(p.itemId) ?? [];
    arr.push({
      id: p.id,
      documentId: p.documentId,
      caption: p.caption,
      sortOrder: p.sortOrder,
      url: p.url,
      title: p.title,
    });
    photosByItem.set(p.itemId, arr);
  }

  return {
    project: {
      id: projectRow.id,
      name: projectRow.name,
      currentPhase: projectRow.currentPhase,
      inCloseout: true,
    },
    items: rows.map((r) => ({
      id: r.id,
      sequentialNumber: r.sequentialNumber,
      title: r.title,
      description: r.description,
      location: r.location,
      status: r.status,
      clientFacingNote: r.clientFacingNote,
      photos: photosByItem.get(r.id) ?? [],
      addedOnIso: r.addedOn.toISOString(),
      updatedOnIso: r.updatedOn ? r.updatedOn.toISOString() : null,
    })),
  };
}

// -----------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------

type TxOrDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function queryPhotos(
  tx: TxOrDb,
  itemId: string,
): Promise<PunchItemPhotoRow[]> {
  const rows = await tx
    .select({
      id: punchItemPhotos.id,
      documentId: punchItemPhotos.documentId,
      caption: punchItemPhotos.caption,
      sortOrder: punchItemPhotos.sortOrder,
      storageKey: documents.storageKey,
      title: documents.title,
    })
    .from(punchItemPhotos)
    .innerJoin(documents, eq(documents.id, punchItemPhotos.documentId))
    .where(eq(punchItemPhotos.punchItemId, itemId))
    .orderBy(asc(punchItemPhotos.sortOrder));
  const urls = await Promise.all(
    rows.map((r) =>
      presignDownloadUrl({ key: r.storageKey, expiresInSeconds: 600 }).catch(
        () => "",
      ),
    ),
  );
  return rows.map((r, i) => ({
    id: r.id,
    documentId: r.documentId,
    caption: r.caption,
    sortOrder: r.sortOrder,
    url: urls[i],
    title: r.title,
  }));
}

async function queryPhotosForMany(
  tx: TxOrDb,
  itemIds: string[],
): Promise<Array<PunchItemPhotoRow & { itemId: string }>> {
  if (itemIds.length === 0) return [];
  const rows = await tx
    .select({
      id: punchItemPhotos.id,
      itemId: punchItemPhotos.punchItemId,
      documentId: punchItemPhotos.documentId,
      caption: punchItemPhotos.caption,
      sortOrder: punchItemPhotos.sortOrder,
      storageKey: documents.storageKey,
      title: documents.title,
    })
    .from(punchItemPhotos)
    .innerJoin(documents, eq(documents.id, punchItemPhotos.documentId))
    .where(inArray(punchItemPhotos.punchItemId, itemIds))
    .orderBy(asc(punchItemPhotos.sortOrder));
  const urls = await Promise.all(
    rows.map((r) =>
      presignDownloadUrl({ key: r.storageKey, expiresInSeconds: 600 }).catch(
        () => "",
      ),
    ),
  );
  return rows.map((r, i) => ({
    id: r.id,
    itemId: r.itemId,
    documentId: r.documentId,
    caption: r.caption,
    sortOrder: r.sortOrder,
    url: urls[i],
    title: r.title,
  }));
}

async function queryComments(
  tx: TxOrDb,
  itemId: string,
): Promise<PunchItemCommentRow[]> {
  const rows = await tx
    .select({
      id: punchItemComments.id,
      authorUserId: punchItemComments.authorUserId,
      authorName: users.displayName,
      body: punchItemComments.body,
      isSystem: punchItemComments.isSystem,
      createdAt: punchItemComments.createdAt,
    })
    .from(punchItemComments)
    .leftJoin(users, eq(users.id, punchItemComments.authorUserId))
    .where(eq(punchItemComments.punchItemId, itemId))
    .orderBy(asc(punchItemComments.createdAt));
  return rows.map((r) => ({
    id: r.id,
    authorUserId: r.authorUserId,
    authorName: r.authorName,
    body: r.body,
    isSystem: r.isSystem,
    createdAt: r.createdAt.toISOString(),
  }));
}
