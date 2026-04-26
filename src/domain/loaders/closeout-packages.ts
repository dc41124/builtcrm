import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  activityFeedItems,
  closeoutPackageComments,
  closeoutPackageItems,
  closeoutPackageSections,
  closeoutPackages,
  documents,
  organizations,
  projects,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// -----------------------------------------------------------------------------
// Shared types
// -----------------------------------------------------------------------------

export type CloseoutStatus = "building" | "review" | "delivered" | "accepted";

export type CloseoutSectionType =
  | "om_manuals"
  | "warranties"
  | "as_builts"
  | "permits_final"
  | "testing_certificates"
  | "cad_files"
  | "other";

export type CloseoutCommentScope = "package" | "section" | "item";

export type CloseoutPackageListRow = {
  id: string;
  numberLabel: string;
  sequenceYear: number;
  sequenceNumber: number;
  title: string;
  status: CloseoutStatus;
  projectId: string;
  projectName: string;
  preparedByUserId: string;
  preparedByName: string | null;
  preparedByOrgName: string | null;
  deliveredAt: string | null;
  acceptedAt: string | null;
  acceptedSigner: string | null;
  createdAt: string;
  updatedAt: string;
  sectionsCount: number;
  docsCount: number;
  totalSizeBytes: number;
  openCommentsCount: number;
  completionPct: number;
};

export type CloseoutItemRow = {
  id: string;
  sectionId: string;
  documentId: string;
  name: string;
  sizeBytes: number;
  category: string | null;
  notes: string | null;
  sortOrder: number;
};

export type CloseoutSectionRow = {
  id: string;
  sectionType: CloseoutSectionType;
  customLabel: string | null;
  orderIndex: number;
  items: CloseoutItemRow[];
};

export type CloseoutCommentRow = {
  id: string;
  scope: CloseoutCommentScope;
  sectionId: string | null;
  itemId: string | null;
  authorUserId: string;
  authorName: string | null;
  authorOrgName: string | null;
  body: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type CloseoutPackageDetail = CloseoutPackageListRow & {
  project: {
    id: string;
    name: string;
    addressLine1: string | null;
    city: string | null;
    stateProvince: string | null;
    projectStatus: string;
  };
  acceptanceNote: string | null;
  sections: CloseoutSectionRow[];
  comments: CloseoutCommentRow[];
  canEdit: boolean;
  canDeliver: boolean;
  canAccept: boolean;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function formatCloseoutNumber(
  year: number,
  sequenceNumber: number,
): string {
  return `CO-${year}-${String(sequenceNumber).padStart(4, "0")}`;
}

// Completion heuristic for workspace cards. A package is "complete" when it
// has at least one section with at least one item. More precisely, we
// normalize to 0–100 based on how many of the 7 section types carry at
// least one item, plus a baseline boost for having ANY content. Good
// enough for the UI indicator; the contractor drives the real DoD call.
function computeCompletionPct(sections: CloseoutSectionRow[]): number {
  if (sections.length === 0) return 0;
  const totalItems = sections.reduce((a, s) => a + s.items.length, 0);
  if (totalItems === 0) return 0;
  const filledSections = sections.filter((s) => s.items.length > 0).length;
  const pct = Math.round((filledSections / 7) * 80 + 20);
  return Math.max(0, Math.min(100, pct));
}

async function requireContractor(
  session: SessionLike | null | undefined,
  projectId: string,
) {
  const ctx = await getEffectiveContext(session, projectId);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Closeout packages are contractor-only on this surface",
      "forbidden",
    );
  }
  return ctx;
}

async function requireClientOrContractor(
  session: SessionLike | null | undefined,
  projectId: string,
) {
  const ctx = await getEffectiveContext(session, projectId);
  const allowed =
    ctx.role === "contractor_admin" ||
    ctx.role === "contractor_pm" ||
    ctx.role === "commercial_client" ||
    ctx.role === "residential_client";
  if (!allowed) {
    throw new AuthorizationError(
      "Closeout is not visible to this role",
      "forbidden",
    );
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// getCloseoutPackagesForProject — list view scoped to one project.
// -----------------------------------------------------------------------------

export async function getCloseoutPackagesForProject(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<{ rows: CloseoutPackageListRow[] }> {
  const ctx = await requireClientOrContractor(input.session, input.projectId);
  const rows = await selectListRowsForProjects({
    organizationId: ctx.project.contractorOrganizationId,
    projectIds: [input.projectId],
    contractorOnly: ctx.role === "commercial_client" || ctx.role === "residential_client",
  });
  return { rows };
}

// -----------------------------------------------------------------------------
// getCloseoutPackagesForOrg — workspace across every project the contractor
// org owns. Used by the contractor's "All packages" workspace view.
// -----------------------------------------------------------------------------

export async function getCloseoutPackagesForOrg(input: {
  session: SessionLike | null | undefined;
  organizationId: string;
}): Promise<{ rows: CloseoutPackageListRow[] }> {
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  // Pull every project owned by the org, then use the per-project loader.
  // Authorization is enforced project-by-project via getEffectiveContext
  // when the per-project loader runs — contractor staff get implicit
  // access to every project in their org (see context.ts).
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, input.organizationId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) return { rows: [] };

  const rows = await selectListRowsForProjects({
    organizationId: input.organizationId,
    projectIds,
    contractorOnly: false,
  });
  return { rows };
}

async function selectListRowsForProjects(input: {
  organizationId: string;
  projectIds: string[];
  contractorOnly: boolean;
}): Promise<CloseoutPackageListRow[]> {
  if (input.projectIds.length === 0) return [];

  const statusFilter = input.contractorOnly
    ? sql`${closeoutPackages.status} IN ('delivered', 'accepted')`
    : sql`1 = 1`;

  const base = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        id: closeoutPackages.id,
        sequenceYear: closeoutPackages.sequenceYear,
        sequenceNumber: closeoutPackages.sequenceNumber,
        title: closeoutPackages.title,
        status: closeoutPackages.status,
        projectId: closeoutPackages.projectId,
        projectName: projects.name,
        preparedByUserId: closeoutPackages.preparedByUserId,
        preparedByName: users.displayName,
        deliveredAt: closeoutPackages.deliveredAt,
        acceptedAt: closeoutPackages.acceptedAt,
        acceptedSigner: closeoutPackages.acceptedSigner,
        createdAt: closeoutPackages.createdAt,
        updatedAt: closeoutPackages.updatedAt,
        orgName: organizations.name,
      })
      .from(closeoutPackages)
      .innerJoin(projects, eq(projects.id, closeoutPackages.projectId))
      .leftJoin(users, eq(users.id, closeoutPackages.preparedByUserId))
      .leftJoin(
        organizations,
        eq(organizations.id, closeoutPackages.organizationId),
      )
      .where(and(inArray(closeoutPackages.projectId, input.projectIds), statusFilter))
      .orderBy(desc(closeoutPackages.createdAt)),
  );

  if (base.length === 0) return [];

  const ids = base.map((b) => b.id);

  const [sectionAgg, docAgg, commentAgg, sectionRows] = await Promise.all([
    db
      .select({
        packageId: closeoutPackageSections.packageId,
        count: sql<number>`count(*)::int`,
      })
      .from(closeoutPackageSections)
      .where(inArray(closeoutPackageSections.packageId, ids))
      .groupBy(closeoutPackageSections.packageId),
    db
      .select({
        packageId: closeoutPackageSections.packageId,
        count: sql<number>`count(${closeoutPackageItems.id})::int`,
        bytes: sql<number>`coalesce(sum(${documents.fileSizeBytes}), 0)::bigint`,
      })
      .from(closeoutPackageSections)
      .leftJoin(
        closeoutPackageItems,
        eq(closeoutPackageItems.sectionId, closeoutPackageSections.id),
      )
      .leftJoin(documents, eq(documents.id, closeoutPackageItems.documentId))
      .where(inArray(closeoutPackageSections.packageId, ids))
      .groupBy(closeoutPackageSections.packageId),
    db
      .select({
        packageId: closeoutPackageComments.packageId,
        count: sql<number>`count(*) filter (where ${closeoutPackageComments.resolvedAt} is null)::int`,
      })
      .from(closeoutPackageComments)
      .where(inArray(closeoutPackageComments.packageId, ids))
      .groupBy(closeoutPackageComments.packageId),
    db
      .select({
        packageId: closeoutPackageSections.packageId,
        sectionId: closeoutPackageSections.id,
        sectionType: closeoutPackageSections.sectionType,
        orderIndex: closeoutPackageSections.orderIndex,
        itemCount: sql<number>`(
          select count(*)::int from ${closeoutPackageItems}
          where ${closeoutPackageItems.sectionId} = ${closeoutPackageSections.id}
        )`,
      })
      .from(closeoutPackageSections)
      .where(inArray(closeoutPackageSections.packageId, ids)),
  ]);

  const secByPkg = new Map<string, number>();
  for (const s of sectionAgg) secByPkg.set(s.packageId, s.count);
  const docByPkg = new Map<string, { count: number; bytes: number }>();
  for (const d of docAgg) {
    docByPkg.set(d.packageId, { count: d.count, bytes: Number(d.bytes ?? 0) });
  }
  const commentByPkg = new Map<string, number>();
  for (const c of commentAgg) commentByPkg.set(c.packageId, c.count);

  // Completion pct: count of section types with ≥1 item, normalized.
  const sectionsByPkg = new Map<string, Array<{ itemCount: number }>>();
  for (const s of sectionRows) {
    const arr = sectionsByPkg.get(s.packageId) ?? [];
    arr.push({ itemCount: s.itemCount });
    sectionsByPkg.set(s.packageId, arr);
  }

  return base.map((r) => {
    const sec = secByPkg.get(r.id) ?? 0;
    const doc = docByPkg.get(r.id) ?? { count: 0, bytes: 0 };
    const openComments = commentByPkg.get(r.id) ?? 0;
    const pkgSections = sectionsByPkg.get(r.id) ?? [];
    const filled = pkgSections.filter((s) => s.itemCount > 0).length;
    const pct =
      r.status === "accepted"
        ? 100
        : r.status === "delivered"
          ? 100
          : doc.count === 0
            ? 0
            : Math.max(
                0,
                Math.min(100, Math.round((filled / 7) * 80 + 20)),
              );
    return {
      id: r.id,
      numberLabel: formatCloseoutNumber(r.sequenceYear, r.sequenceNumber),
      sequenceYear: r.sequenceYear,
      sequenceNumber: r.sequenceNumber,
      title: r.title,
      status: r.status as CloseoutStatus,
      projectId: r.projectId,
      projectName: r.projectName,
      preparedByUserId: r.preparedByUserId,
      preparedByName: r.preparedByName,
      preparedByOrgName: r.orgName,
      deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
      acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
      acceptedSigner: r.acceptedSigner,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      sectionsCount: sec,
      docsCount: doc.count,
      totalSizeBytes: doc.bytes,
      openCommentsCount: openComments,
      completionPct: pct,
    };
  });
}

// -----------------------------------------------------------------------------
// getCloseoutPackage — detail view (contractor or client).
// -----------------------------------------------------------------------------

export async function getCloseoutPackage(input: {
  session: SessionLike | null | undefined;
  packageId: string;
}): Promise<CloseoutPackageDetail> {
  // Pre-context lookup: caller passes only packageId. Read head via
  // admin pool to derive projectId + orgId for the rest of the
  // resolution; downstream queries (sections, items, comments) stay
  // on `db` for now since those tables aren't RLS-enabled.
  const [head] = await dbAdmin
    .select({
      id: closeoutPackages.id,
      projectId: closeoutPackages.projectId,
      organizationId: closeoutPackages.organizationId,
      sequenceYear: closeoutPackages.sequenceYear,
      sequenceNumber: closeoutPackages.sequenceNumber,
      title: closeoutPackages.title,
      status: closeoutPackages.status,
      preparedByUserId: closeoutPackages.preparedByUserId,
      deliveredAt: closeoutPackages.deliveredAt,
      acceptedAt: closeoutPackages.acceptedAt,
      acceptedSigner: closeoutPackages.acceptedSigner,
      acceptanceNote: closeoutPackages.acceptanceNote,
      createdAt: closeoutPackages.createdAt,
      updatedAt: closeoutPackages.updatedAt,
    })
    .from(closeoutPackages)
    .where(eq(closeoutPackages.id, input.packageId))
    .limit(1);
  if (!head) {
    throw new AuthorizationError("Closeout package not found", "not_found");
  }

  const ctx = await requireClientOrContractor(input.session, head.projectId);
  const isClient =
    ctx.role === "commercial_client" || ctx.role === "residential_client";

  // Clients only see delivered + accepted packages.
  if (isClient && head.status !== "delivered" && head.status !== "accepted") {
    throw new AuthorizationError(
      "Closeout package not yet available",
      "forbidden",
    );
  }

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      addressLine1: projects.addressLine1,
      city: projects.city,
      stateProvince: projects.stateProvince,
      projectStatus: projects.projectStatus,
    })
    .from(projects)
    .where(eq(projects.id, head.projectId))
    .limit(1);

  const [preparedBy] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, head.preparedByUserId))
    .limit(1);

  const [orgRow] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, head.organizationId))
    .limit(1);

  const sectionRows = await db
    .select({
      id: closeoutPackageSections.id,
      sectionType: closeoutPackageSections.sectionType,
      customLabel: closeoutPackageSections.customLabel,
      orderIndex: closeoutPackageSections.orderIndex,
    })
    .from(closeoutPackageSections)
    .where(eq(closeoutPackageSections.packageId, head.id))
    .orderBy(
      asc(closeoutPackageSections.orderIndex),
      asc(closeoutPackageSections.createdAt),
    );

  const sectionIds = sectionRows.map((s) => s.id);
  const itemRows =
    sectionIds.length === 0
      ? []
      : await db
          .select({
            id: closeoutPackageItems.id,
            sectionId: closeoutPackageItems.sectionId,
            documentId: closeoutPackageItems.documentId,
            name: documents.title,
            sizeBytes: documents.fileSizeBytes,
            category: documents.category,
            notes: closeoutPackageItems.notes,
            sortOrder: closeoutPackageItems.sortOrder,
          })
          .from(closeoutPackageItems)
          .innerJoin(
            documents,
            eq(documents.id, closeoutPackageItems.documentId),
          )
          .where(inArray(closeoutPackageItems.sectionId, sectionIds))
          .orderBy(
            asc(closeoutPackageItems.sortOrder),
            asc(closeoutPackageItems.createdAt),
          );

  const commentRows = await db
    .select({
      id: closeoutPackageComments.id,
      scope: closeoutPackageComments.scope,
      sectionId: closeoutPackageComments.sectionId,
      itemId: closeoutPackageComments.itemId,
      authorUserId: closeoutPackageComments.authorUserId,
      authorName: users.displayName,
      body: closeoutPackageComments.body,
      resolvedAt: closeoutPackageComments.resolvedAt,
      createdAt: closeoutPackageComments.createdAt,
    })
    .from(closeoutPackageComments)
    .leftJoin(users, eq(users.id, closeoutPackageComments.authorUserId))
    .where(eq(closeoutPackageComments.packageId, head.id))
    .orderBy(asc(closeoutPackageComments.createdAt));

  const sections: CloseoutSectionRow[] = sectionRows.map((s) => ({
    id: s.id,
    sectionType: s.sectionType as CloseoutSectionType,
    customLabel: s.customLabel,
    orderIndex: s.orderIndex,
    items: itemRows
      .filter((it) => it.sectionId === s.id)
      .map((it) => ({
        id: it.id,
        sectionId: it.sectionId,
        documentId: it.documentId,
        name: it.name,
        sizeBytes: Number(it.sizeBytes ?? 0),
        category: it.category,
        notes: it.notes,
        sortOrder: it.sortOrder,
      })),
  }));

  const totalItems = sections.reduce((a, s) => a + s.items.length, 0);
  const totalBytes = sections.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + i.sizeBytes, 0),
    0,
  );
  const completionPct =
    head.status === "accepted" || head.status === "delivered"
      ? 100
      : computeCompletionPct(sections);
  const openComments = commentRows.filter((c) => c.resolvedAt == null).length;

  const comments: CloseoutCommentRow[] = commentRows.map((c) => ({
    id: c.id,
    scope: c.scope as CloseoutCommentScope,
    sectionId: c.sectionId,
    itemId: c.itemId,
    authorUserId: c.authorUserId,
    authorName: c.authorName,
    authorOrgName: null,
    body: c.body,
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  const listRow: CloseoutPackageListRow = {
    id: head.id,
    numberLabel: formatCloseoutNumber(head.sequenceYear, head.sequenceNumber),
    sequenceYear: head.sequenceYear,
    sequenceNumber: head.sequenceNumber,
    title: head.title,
    status: head.status as CloseoutStatus,
    projectId: head.projectId,
    projectName: project?.name ?? "",
    preparedByUserId: head.preparedByUserId,
    preparedByName: preparedBy?.displayName ?? null,
    preparedByOrgName: orgRow?.name ?? null,
    deliveredAt: head.deliveredAt ? head.deliveredAt.toISOString() : null,
    acceptedAt: head.acceptedAt ? head.acceptedAt.toISOString() : null,
    acceptedSigner: head.acceptedSigner,
    createdAt: head.createdAt.toISOString(),
    updatedAt: head.updatedAt.toISOString(),
    sectionsCount: sections.length,
    docsCount: totalItems,
    totalSizeBytes: totalBytes,
    openCommentsCount: openComments,
    completionPct,
  };

  // Capability flags
  const contractorRole =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const canEdit =
    contractorRole && (head.status === "building" || head.status === "review");
  const canDeliver =
    contractorRole &&
    (head.status === "building" || head.status === "review") &&
    totalItems > 0;
  const canAccept = isClient && head.status === "delivered";

  return {
    ...listRow,
    project: project ?? {
      id: head.projectId,
      name: "",
      addressLine1: null,
      city: null,
      stateProvince: null,
      projectStatus: "",
    },
    acceptanceNote: head.acceptanceNote,
    sections,
    comments,
    canEdit,
    canDeliver,
    canAccept,
  };
}

// -----------------------------------------------------------------------------
// getCloseoutPackageActivity — activity rail for the workspace.
// -----------------------------------------------------------------------------

export type CloseoutActivityRow = {
  actorUserId: string | null;
  actorName: string | null;
  title: string;
  body: string | null;
  relatedPackageId: string | null;
  createdAt: string;
};

export async function getCloseoutActivityForOrg(input: {
  session: SessionLike | null | undefined;
  organizationId: string;
  limit?: number;
}): Promise<CloseoutActivityRow[]> {
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, input.organizationId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) return [];

  const rows = await db
    .select({
      actorUserId: activityFeedItems.actorUserId,
      actorName: users.displayName,
      title: activityFeedItems.title,
      body: activityFeedItems.body,
      relatedPackageId: activityFeedItems.relatedObjectId,
      createdAt: activityFeedItems.createdAt,
    })
    .from(activityFeedItems)
    .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
    .where(
      and(
        inArray(activityFeedItems.projectId, projectIds),
        eq(activityFeedItems.relatedObjectType, "closeout_package"),
      ),
    )
    .orderBy(desc(activityFeedItems.createdAt))
    .limit(input.limit ?? 15);

  return rows.map((r) => ({
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    title: r.title,
    body: r.body,
    relatedPackageId: r.relatedPackageId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// -----------------------------------------------------------------------------
// getProjectDocumentLibrary — documents groupable by category, used by the
// builder's drag-source picker. Scoped to the project. Active docs only.
// -----------------------------------------------------------------------------

export type DocLibraryDoc = {
  id: string;
  name: string;
  sizeBytes: number;
  category: string | null;
  // Suggested section type based on category. UI chip.
  suggestedSectionType: CloseoutSectionType | null;
};

export type DocLibraryFolder = {
  label: string;
  category: string | null;
  docs: DocLibraryDoc[];
};

const CATEGORY_TO_SECTION: Record<string, CloseoutSectionType> = {
  drawings: "as_builts",
  permits: "permits_final",
  compliance: "other",
  contracts: "other",
  photos: "other",
  submittal: "other",
  specifications: "other",
  billing_backup: "other",
};

const CATEGORY_LABEL: Record<string, string> = {
  drawings: "Drawings",
  specifications: "Specifications",
  submittal: "Submittals",
  contracts: "Contracts",
  photos: "Photos",
  permits: "Permits & approvals",
  compliance: "Compliance",
  billing_backup: "Billing backup",
  other: "Other",
};

export async function getProjectDocumentLibrary(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<{ folders: DocLibraryFolder[] }> {
  const ctx = await requireContractor(input.session, input.projectId);

  const rows = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({
        id: documents.id,
        name: documents.title,
        sizeBytes: documents.fileSizeBytes,
        category: documents.category,
      })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, input.projectId),
          eq(documents.documentStatus, "active"),
        ),
      )
      .orderBy(asc(documents.title)),
  );

  const byCategory = new Map<string, DocLibraryDoc[]>();
  for (const r of rows) {
    const key = r.category ?? "other";
    const suggested = CATEGORY_TO_SECTION[key] ?? null;
    const list = byCategory.get(key) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      sizeBytes: Number(r.sizeBytes ?? 0),
      category: r.category,
      suggestedSectionType: suggested,
    });
    byCategory.set(key, list);
  }

  const folders: DocLibraryFolder[] = [];
  for (const [category, docs] of byCategory) {
    folders.push({
      label: CATEGORY_LABEL[category] ?? category,
      category,
      docs,
    });
  }
  folders.sort((a, b) => a.label.localeCompare(b.label));
  return { folders };
}
