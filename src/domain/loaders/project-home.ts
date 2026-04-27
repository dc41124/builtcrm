import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  activityFeedItems,
  approvals,
  changeOrders,
  complianceRecords,
  conversationParticipants,
  conversations,
  documentLinks,
  documents,
  drawLineItems,
  drawRequests,
  lienWaivers,
  messages,
  milestones,
  organizations,
  paymentTransactions,
  projectOrganizationMemberships,
  projectUserMemberships,
  projects,
  retainageReleases,
  rfiResponses,
  rfis,
  roleAssignments,
  scheduleOfValues,
  selectionCategories,
  selectionDecisions,
  selectionItems,
  selectionOptions,
  sovLineItems,
  uploadRequests,
  users,
} from "@/db/schema";

import { presignDownloadUrl } from "@/lib/storage";
import { getSubPendingFinancialsCents } from "./financial";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

// Fetches RFIs for a project (optionally scoped by assigned org) with their
// responses + responder display names folded in. Two queries, grouped in JS.
async function loadRfisWithResponses(
  projectId: string,
  callerOrgId: string,
  opts: { assignedToOrganizationId?: string } = {},
): Promise<RfiRow[]> {
  const whereClause = opts.assignedToOrganizationId
    ? and(
        eq(rfis.projectId, projectId),
        eq(rfis.assignedToOrganizationId, opts.assignedToOrganizationId),
      )
    : eq(rfis.projectId, projectId);

  const rfiRows = await withTenant(callerOrgId, (tx) =>
    tx
    .select({
      id: rfis.id,
      sequentialNumber: rfis.sequentialNumber,
      subject: rfis.subject,
      body: rfis.body,
      rfiStatus: rfis.rfiStatus,
      rfiType: rfis.rfiType,
      assignedToOrganizationId: rfis.assignedToOrganizationId,
      assignedToOrganizationName: organizations.name,
      assignedToUserId: rfis.assignedToUserId,
      dueAt: rfis.dueAt,
      respondedAt: rfis.respondedAt,
      closedAt: rfis.closedAt,
      drawingReference: rfis.drawingReference,
      specificationReference: rfis.specificationReference,
      locationDescription: rfis.locationDescription,
      createdAt: rfis.createdAt,
    })
    .from(rfis)
    .leftJoin(
      organizations,
      eq(organizations.id, rfis.assignedToOrganizationId),
    )
    .where(whereClause)
    .orderBy(desc(rfis.createdAt)),
  );

  if (rfiRows.length === 0) return [];

  const ids = rfiRows.map((r) => r.id);
  const responseRows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        id: rfiResponses.id,
        rfiId: rfiResponses.rfiId,
        body: rfiResponses.body,
        respondedByUserId: rfiResponses.respondedByUserId,
        respondedByName: users.displayName,
        isOfficialResponse: rfiResponses.isOfficialResponse,
        createdAt: rfiResponses.createdAt,
      })
      .from(rfiResponses)
      .leftJoin(users, eq(users.id, rfiResponses.respondedByUserId))
      .where(inArray(rfiResponses.rfiId, ids))
      .orderBy(asc(rfiResponses.createdAt)),
  );

  const grouped = new Map<string, RfiResponseRow[]>();
  for (const r of responseRows) {
    const arr = grouped.get(r.rfiId) ?? [];
    arr.push({
      id: r.id,
      body: r.body,
      respondedByUserId: r.respondedByUserId,
      respondedByName: r.respondedByName,
      isOfficialResponse: r.isOfficialResponse,
      createdAt: r.createdAt,
    });
    grouped.set(r.rfiId, arr);
  }

  // Enrichment: reference files + activity trail
  const rfiIds = rfiRows.map((r) => r.id);
  const [refFileRows, rfiActivityRows] = await Promise.all([
    withTenant(callerOrgId, (tx) =>
      tx
        .select({
          linkedObjectId: documentLinks.linkedObjectId,
          documentId: documents.id,
          title: documents.title,
          documentType: documents.documentType,
          linkRole: documentLinks.linkRole,
        })
        .from(documentLinks)
        .innerJoin(documents, eq(documents.id, documentLinks.documentId))
        .where(
          and(
            eq(documentLinks.linkedObjectType, "rfi"),
            inArray(documentLinks.linkedObjectId, rfiIds),
          ),
        ),
    ),
    db
      .select({
        id: activityFeedItems.id,
        relatedObjectId: activityFeedItems.relatedObjectId,
        title: activityFeedItems.title,
        body: activityFeedItems.body,
        activityType: activityFeedItems.activityType,
        createdAt: activityFeedItems.createdAt,
        actorName: users.displayName,
      })
      .from(activityFeedItems)
      .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
      .where(
        and(
          eq(activityFeedItems.relatedObjectType, "rfi"),
          inArray(activityFeedItems.relatedObjectId, rfiIds),
        ),
      )
      .orderBy(desc(activityFeedItems.createdAt)),
  ]);

  const refFilesById = new Map<string, RfiReferenceFile[]>();
  for (const d of refFileRows) {
    const arr = refFilesById.get(d.linkedObjectId) ?? [];
    arr.push({ id: d.documentId, title: d.title, documentType: d.documentType, linkRole: d.linkRole });
    refFilesById.set(d.linkedObjectId, arr);
  }

  const rfiActivityById = new Map<string, RfiActivityEvent[]>();
  for (const a of rfiActivityRows) {
    if (!a.relatedObjectId) continue;
    const arr = rfiActivityById.get(a.relatedObjectId) ?? [];
    arr.push({ id: a.id, title: a.title, body: a.body, activityType: a.activityType, actorName: a.actorName, createdAt: a.createdAt });
    rfiActivityById.set(a.relatedObjectId, arr);
  }

  return rfiRows.map((r) => ({
    ...r,
    responses: grouped.get(r.id) ?? [],
    referenceFiles: refFilesById.get(r.id) ?? [],
    activityTrail: rfiActivityById.get(r.id) ?? [],
  }));
}

export type RfiResponseRow = {
  id: string;
  body: string;
  respondedByUserId: string;
  respondedByName: string | null;
  isOfficialResponse: boolean;
  createdAt: Date;
};

export type RfiReferenceFile = {
  id: string;
  title: string;
  documentType: string;
  linkRole: string;
};

export type RfiActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  actorName: string | null;
  createdAt: Date;
};

export type RfiRow = {
  id: string;
  sequentialNumber: number;
  subject: string;
  body: string | null;
  rfiStatus: string;
  rfiType: "formal" | "issue";
  assignedToOrganizationId: string | null;
  assignedToOrganizationName: string | null;
  assignedToUserId: string | null;
  dueAt: Date | null;
  respondedAt: Date | null;
  closedAt: Date | null;
  drawingReference: string | null;
  specificationReference: string | null;
  locationDescription: string | null;
  createdAt: Date;
  responses: RfiResponseRow[];
  referenceFiles: RfiReferenceFile[];
  activityTrail: RfiActivityEvent[];
};

export type LienWaiverRow = {
  id: string;
  drawRequestId: string;
  organizationId: string;
  organizationName: string | null;
  lienWaiverType: "conditional_progress" | "unconditional_progress" | "conditional_final" | "unconditional_final";
  lienWaiverStatus: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  amountCents: number;
  throughDate: Date | null;
  documentId: string | null;
  requestedAt: Date | null;
  submittedAt: Date | null;
  acceptedAt: Date | null;
};

export type UploadRequestFile = {
  id: string;
  title: string;
  documentType: string;
  uploaderName: string | null;
  uploadedAt: Date;
};

export type UploadRequestActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  actorName: string | null;
  createdAt: Date;
};

export type UploadRequestRow = {
  id: string;
  title: string;
  description: string | null;
  requestStatus: string;
  requestedFromOrganizationId: string | null;
  requestedFromOrganizationName: string | null;
  expectedFileType: string | null;
  dueAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  revisionNote: string | null;
  responseNote: string | null;
  createdAt: Date;
  submittedDocumentId: string | null;
  submittedDocumentTitle: string | null;
  submittedFile: UploadRequestFile | null;
  activityTrail: UploadRequestActivityEvent[];
};

async function loadUploadRequestEnrichment(
  rawRows: Array<{
    id: string;
    submittedDocumentId: string | null;
    submittedDocumentTitle: string | null;
    submittedDocumentType: string | null;
    submittedByUserId: string | null;
    submittedAt: Date | null;
  }>,
): Promise<{
  filesById: Map<string, UploadRequestFile>;
  activityById: Map<string, UploadRequestActivityEvent[]>;
}> {
  const filesById = new Map<string, UploadRequestFile>();
  const activityById = new Map<string, UploadRequestActivityEvent[]>();
  if (rawRows.length === 0) return { filesById, activityById };

  const requestIds = rawRows.map((r) => r.id);
  const uploaderIds = Array.from(
    new Set(
      rawRows
        .map((r) => r.submittedByUserId)
        .filter((v): v is string => v != null),
    ),
  );

  const [uploaderRows, activityRows] = await Promise.all([
    uploaderIds.length > 0
      ? db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, uploaderIds))
      : Promise.resolve([] as Array<{ id: string; displayName: string | null }>),
    db
      .select({
        id: activityFeedItems.id,
        relatedObjectId: activityFeedItems.relatedObjectId,
        title: activityFeedItems.title,
        body: activityFeedItems.body,
        activityType: activityFeedItems.activityType,
        createdAt: activityFeedItems.createdAt,
        actorName: users.displayName,
      })
      .from(activityFeedItems)
      .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
      .where(
        and(
          eq(activityFeedItems.relatedObjectType, "upload_request"),
          inArray(activityFeedItems.relatedObjectId, requestIds),
        ),
      )
      .orderBy(desc(activityFeedItems.createdAt)),
  ]);

  const uploaderNameById = new Map<string, string | null>();
  for (const u of uploaderRows) uploaderNameById.set(u.id, u.displayName);

  for (const r of rawRows) {
    if (
      r.submittedDocumentId &&
      r.submittedDocumentTitle != null &&
      r.submittedDocumentType != null
    ) {
      filesById.set(r.id, {
        id: r.submittedDocumentId,
        title: r.submittedDocumentTitle,
        documentType: r.submittedDocumentType,
        uploaderName: r.submittedByUserId
          ? (uploaderNameById.get(r.submittedByUserId) ?? null)
          : null,
        uploadedAt: r.submittedAt ?? new Date(),
      });
    }
  }

  for (const a of activityRows) {
    if (!a.relatedObjectId) continue;
    const arr = activityById.get(a.relatedObjectId) ?? [];
    arr.push({
      id: a.id,
      title: a.title,
      body: a.body,
      activityType: a.activityType,
      actorName: a.actorName,
      createdAt: a.createdAt,
    });
    activityById.set(a.relatedObjectId, arr);
  }

  return { filesById, activityById };
}

export type DrawRequestSupportingFile = {
  id: string;
  title: string;
  documentType: string;
  linkRole: string;
};

export type DrawRequestActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  actorName: string | null;
  createdAt: Date;
};

async function loadDrawRequestEnrichment(
  drawIds: string[],
  callerOrgId: string,
): Promise<{
  filesById: Map<string, DrawRequestSupportingFile[]>;
  activityById: Map<string, DrawRequestActivityEvent[]>;
  receiptPaymentIdByDrawId: Map<string, string>;
}> {
  const filesById = new Map<string, DrawRequestSupportingFile[]>();
  const activityById = new Map<string, DrawRequestActivityEvent[]>();
  const receiptPaymentIdByDrawId = new Map<string, string>();
  if (drawIds.length === 0)
    return { filesById, activityById, receiptPaymentIdByDrawId };

  const [docRows, activityRows, paymentRows] = await Promise.all([
    withTenant(callerOrgId, (tx) =>
      tx
        .select({
          linkedObjectId: documentLinks.linkedObjectId,
          documentId: documents.id,
          title: documents.title,
          documentType: documents.documentType,
          linkRole: documentLinks.linkRole,
        })
        .from(documentLinks)
        .innerJoin(documents, eq(documents.id, documentLinks.documentId))
        .where(
          and(
            eq(documentLinks.linkedObjectType, "draw_request"),
            inArray(documentLinks.linkedObjectId, drawIds),
          ),
        ),
    ),
    db
      .select({
        id: activityFeedItems.id,
        relatedObjectId: activityFeedItems.relatedObjectId,
        title: activityFeedItems.title,
        body: activityFeedItems.body,
        activityType: activityFeedItems.activityType,
        createdAt: activityFeedItems.createdAt,
        actorName: users.displayName,
      })
      .from(activityFeedItems)
      .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
      .where(
        and(
          eq(activityFeedItems.relatedObjectType, "draw_request"),
          inArray(activityFeedItems.relatedObjectId, drawIds),
        ),
      )
      .orderBy(desc(activityFeedItems.createdAt)),
    // Most recent succeeded payment per draw. `asc` order means later
    // entries overwrite earlier ones in the map below, leaving the newest
    // succeeded transaction as the one surfaced to the UI.
    withTenant(callerOrgId, (tx) =>
      tx
        .select({
          id: paymentTransactions.id,
          relatedEntityId: paymentTransactions.relatedEntityId,
          succeededAt: paymentTransactions.succeededAt,
        })
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.relatedEntityType, "draw_request"),
            inArray(paymentTransactions.relatedEntityId, drawIds),
            eq(paymentTransactions.transactionStatus, "succeeded"),
          ),
        )
        .orderBy(asc(paymentTransactions.succeededAt)),
    ),
  ]);

  for (const d of docRows) {
    const arr = filesById.get(d.linkedObjectId) ?? [];
    arr.push({
      id: d.documentId,
      title: d.title,
      documentType: d.documentType,
      linkRole: d.linkRole,
    });
    filesById.set(d.linkedObjectId, arr);
  }

  for (const a of activityRows) {
    if (!a.relatedObjectId) continue;
    const arr = activityById.get(a.relatedObjectId) ?? [];
    arr.push({
      id: a.id,
      title: a.title,
      body: a.body,
      activityType: a.activityType,
      actorName: a.actorName,
      createdAt: a.createdAt,
    });
    activityById.set(a.relatedObjectId, arr);
  }

  for (const p of paymentRows) {
    receiptPaymentIdByDrawId.set(p.relatedEntityId, p.id);
  }

  return { filesById, activityById, receiptPaymentIdByDrawId };
}

export type RetainageReleaseRow = {
  id: string;
  sovLineItemId: string | null;
  releaseStatus: "held" | "release_requested" | "released" | "forfeited";
  releaseAmountCents: number;
  totalRetainageHeldCents: number;
  approvalNote: string | null;
  requestedAt: Date | null;
  approvedAt: Date | null;
  consumedByDrawRequestId: string | null;
  consumedAt: Date | null;
  createdAt: Date;
};

export type SelectionOptionRow = {
  id: string;
  selectionItemId: string;
  name: string;
  description: string | null;
  optionTier: "included" | "upgrade" | "premium_upgrade";
  priceCents: number;
  leadTimeDays: number | null;
  additionalScheduleDays: number | null;
  swatchColor: string | null;
  supplierName: string | null;
  productSku: string | null;
  isAvailable: boolean;
  unavailableReason: string | null;
  sortOrder: number;
};

export type SelectionDecisionRow = {
  id: string;
  selectionItemId: string;
  selectedOptionId: string;
  decidedByUserId: string;
  isProvisional: boolean;
  isConfirmed: boolean;
  isLocked: boolean;
  confirmedAt: Date | null;
  lockedAt: Date | null;
  revisionExpiresAt: Date | null;
  previousOptionId: string | null;
  revisionNote: string | null;
  priceDeltaCents: number;
  scheduleDeltaDays: number;
  createdAt: Date;
};

export type SelectionItemRow = {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  selectionItemStatus:
    | "not_started"
    | "exploring"
    | "provisional"
    | "confirmed"
    | "revision_open"
    | "locked";
  allowanceCents: number;
  decisionDeadline: Date | null;
  urgencyNote: string | null;
  affectsSchedule: boolean;
  scheduleImpactNote: string | null;
  recommendedOptionId: string | null;
  revisionWindowHours: number;
  isPublished: boolean;
  publishedAt: Date | null;
  sortOrder: number;
  options: SelectionOptionRow[];
  currentDecision: SelectionDecisionRow | null;
};

export type SelectionCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: SelectionItemRow[];
};

export async function loadSelectionsForProject(
  projectId: string,
  opts: { publishedOnly?: boolean; callerOrgId?: string } = {},
): Promise<SelectionCategoryRow[]> {
  // Selections tables are RLS-enabled. Run reads either inside withTenant
  // when a caller orgId is available, or via dbAdmin (pre-tenant fall-back
  // for callers that haven't been threaded yet).
  const result = opts.callerOrgId
    ? await withTenant(opts.callerOrgId, async (tx) =>
        loadSelectionsImpl(
          tx as unknown as typeof dbAdmin,
          projectId,
          opts.publishedOnly,
        ),
      )
    : await loadSelectionsImpl(dbAdmin, projectId, opts.publishedOnly);
  return result;
}

async function loadSelectionsImpl(
  tx: typeof dbAdmin,
  projectId: string,
  publishedOnly: boolean | undefined,
): Promise<SelectionCategoryRow[]> {
  const categoryRows = await tx
    .select({
      id: selectionCategories.id,
      name: selectionCategories.name,
      description: selectionCategories.description,
      sortOrder: selectionCategories.sortOrder,
      isActive: selectionCategories.isActive,
    })
    .from(selectionCategories)
    .where(eq(selectionCategories.projectId, projectId))
    .orderBy(asc(selectionCategories.sortOrder), asc(selectionCategories.name));

  const activeCategories = categoryRows.filter((c) => c.isActive);
  if (activeCategories.length === 0) return [];

  const itemWhere = publishedOnly
    ? and(
        eq(selectionItems.projectId, projectId),
        eq(selectionItems.isPublished, true),
      )
    : eq(selectionItems.projectId, projectId);

  const itemRows = await tx
    .select()
    .from(selectionItems)
    .where(itemWhere)
    .orderBy(asc(selectionItems.sortOrder), asc(selectionItems.createdAt));

  if (itemRows.length === 0) {
    return activeCategories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      items: [],
    }));
  }

  const itemIds = itemRows.map((i) => i.id);
  const [optionRows, decisionRows] = await Promise.all([
    tx
      .select()
      .from(selectionOptions)
      .where(inArray(selectionOptions.selectionItemId, itemIds))
      .orderBy(asc(selectionOptions.sortOrder), asc(selectionOptions.createdAt)),
    tx
      .select()
      .from(selectionDecisions)
      .where(inArray(selectionDecisions.selectionItemId, itemIds))
      .orderBy(desc(selectionDecisions.createdAt)),
  ]);

  const optionsByItem = new Map<string, SelectionOptionRow[]>();
  for (const o of optionRows) {
    const row: SelectionOptionRow = {
      id: o.id,
      selectionItemId: o.selectionItemId,
      name: o.name,
      description: o.description,
      optionTier: o.optionTier,
      priceCents: o.priceCents,
      leadTimeDays: o.leadTimeDays,
      additionalScheduleDays: o.additionalScheduleDays,
      swatchColor: o.swatchColor,
      supplierName: o.supplierName,
      productSku: o.productSku,
      isAvailable: o.isAvailable,
      unavailableReason: o.unavailableReason,
      sortOrder: o.sortOrder,
    };
    const arr = optionsByItem.get(o.selectionItemId) ?? [];
    arr.push(row);
    optionsByItem.set(o.selectionItemId, arr);
  }

  const currentDecisionByItem = new Map<string, SelectionDecisionRow>();
  for (const d of decisionRows) {
    if (currentDecisionByItem.has(d.selectionItemId)) continue;
    currentDecisionByItem.set(d.selectionItemId, {
      id: d.id,
      selectionItemId: d.selectionItemId,
      selectedOptionId: d.selectedOptionId,
      decidedByUserId: d.decidedByUserId,
      isProvisional: d.isProvisional,
      isConfirmed: d.isConfirmed,
      isLocked: d.isLocked,
      confirmedAt: d.confirmedAt,
      lockedAt: d.lockedAt,
      revisionExpiresAt: d.revisionExpiresAt,
      previousOptionId: d.previousOptionId,
      revisionNote: d.revisionNote,
      priceDeltaCents: d.priceDeltaCents,
      scheduleDeltaDays: d.scheduleDeltaDays,
      createdAt: d.createdAt,
    });
  }

  const itemsByCategory = new Map<string, SelectionItemRow[]>();
  for (const i of itemRows) {
    const row: SelectionItemRow = {
      id: i.id,
      categoryId: i.categoryId,
      title: i.title,
      description: i.description,
      selectionItemStatus: i.selectionItemStatus,
      allowanceCents: i.allowanceCents,
      decisionDeadline: i.decisionDeadline,
      urgencyNote: i.urgencyNote,
      affectsSchedule: i.affectsSchedule,
      scheduleImpactNote: i.scheduleImpactNote,
      recommendedOptionId: i.recommendedOptionId,
      revisionWindowHours: i.revisionWindowHours,
      isPublished: i.isPublished,
      publishedAt: i.publishedAt,
      sortOrder: i.sortOrder,
      options: optionsByItem.get(i.id) ?? [],
      currentDecision: currentDecisionByItem.get(i.id) ?? null,
    };
    const arr = itemsByCategory.get(i.categoryId) ?? [];
    arr.push(row);
    itemsByCategory.set(i.categoryId, arr);
  }

  return activeCategories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    sortOrder: c.sortOrder,
    items: itemsByCategory.get(c.id) ?? [],
  }));
}

export type MessageRow = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string | null;
  body: string;
  attachedDocumentId: string | null;
  attachedDocumentTitle: string | null;
  attachedDocumentUrl: string | null;
  isSystemMessage: boolean;
  createdAt: Date;
};

export type ConversationParticipantRow = {
  userId: string;
  displayName: string | null;
  lastReadAt: Date | null;
};

export type ConversationRow = {
  id: string;
  title: string | null;
  conversationType:
    | "project_general"
    | "rfi_thread"
    | "change_order_thread"
    | "approval_thread"
    | "direct";
  linkedObjectType: string | null;
  linkedObjectId: string | null;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  messageCount: number;
  createdAt: Date;
  unreadCount: number;
  participants: ConversationParticipantRow[];
  messages: MessageRow[];
};

// Loads every conversation the user participates in for this project,
// along with recent messages and participant display names. Unread count
// is derived from the user's own last_read_at marker.
// `callerOrgId` is required because the messages query JOINs the
// RLS-enabled `documents` table to attach attachment metadata. The JOIN
// reads documents rows, so the documents policy fires; without
// withTenant, the GUC is unset and `''::uuid` throws. Conversations and
// messages themselves are not RLS'd (deferred — see
// docs/specs/security_posture.md §6).
export async function loadConversationsForUser(
  projectId: string,
  userId: string,
  callerOrgId: string,
): Promise<ConversationRow[]> {
  const myParticipantRows = await db
    .select({
      conversationId: conversationParticipants.conversationId,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationParticipants.conversationId),
    )
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        eq(conversations.projectId, projectId),
      ),
    );

  if (myParticipantRows.length === 0) return [];

  const conversationIds = myParticipantRows.map((r) => r.conversationId);
  const lastReadByConversation = new Map<string, Date | null>();
  for (const r of myParticipantRows) {
    lastReadByConversation.set(r.conversationId, r.lastReadAt);
  }

  const [conversationRows, participantRows, messageRows] = await Promise.all([
    db
      .select({
        id: conversations.id,
        title: conversations.title,
        conversationType: conversations.conversationType,
        linkedObjectType: conversations.linkedObjectType,
        linkedObjectId: conversations.linkedObjectId,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        messageCount: conversations.messageCount,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(inArray(conversations.id, conversationIds))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt)),
    db
      .select({
        conversationId: conversationParticipants.conversationId,
        userId: conversationParticipants.userId,
        displayName: users.displayName,
        lastReadAt: conversationParticipants.lastReadAt,
      })
      .from(conversationParticipants)
      .leftJoin(users, eq(users.id, conversationParticipants.userId))
      .where(inArray(conversationParticipants.conversationId, conversationIds)),
    withTenant(callerOrgId, (tx) =>
      tx
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderUserId: messages.senderUserId,
          senderName: users.displayName,
          body: messages.body,
          attachedDocumentId: messages.attachedDocumentId,
          attachedDocumentTitle: documents.title,
          attachedDocumentStorageKey: documents.storageKey,
          isSystemMessage: messages.isSystemMessage,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderUserId))
        .leftJoin(documents, eq(documents.id, messages.attachedDocumentId))
        .where(inArray(messages.conversationId, conversationIds))
        .orderBy(asc(messages.createdAt)),
    ),
  ]);

  const participantsByConversation = new Map<string, ConversationParticipantRow[]>();
  for (const p of participantRows) {
    const arr = participantsByConversation.get(p.conversationId) ?? [];
    arr.push({
      userId: p.userId,
      displayName: p.displayName,
      lastReadAt: p.lastReadAt,
    });
    participantsByConversation.set(p.conversationId, arr);
  }

  // Presign download URLs for messages with attachments
  const attachmentKeys = messageRows
    .filter((m) => m.attachedDocumentStorageKey)
    .map((m) => ({ id: m.id, key: m.attachedDocumentStorageKey! }));
  const presignedUrlMap = new Map<string, string>();
  if (attachmentKeys.length > 0) {
    const urls = await Promise.all(
      attachmentKeys.map(async (a) => ({
        id: a.id,
        url: await presignDownloadUrl({ key: a.key, expiresInSeconds: 600 }),
      })),
    );
    for (const u of urls) presignedUrlMap.set(u.id, u.url);
  }

  const messagesByConversation = new Map<string, MessageRow[]>();
  for (const m of messageRows) {
    const arr = messagesByConversation.get(m.conversationId) ?? [];
    arr.push({
      id: m.id,
      conversationId: m.conversationId,
      senderUserId: m.senderUserId,
      senderName: m.senderName,
      body: m.body,
      attachedDocumentId: m.attachedDocumentId,
      attachedDocumentTitle: m.attachedDocumentTitle,
      attachedDocumentUrl: presignedUrlMap.get(m.id) ?? null,
      isSystemMessage: m.isSystemMessage,
      createdAt: m.createdAt,
    });
    messagesByConversation.set(m.conversationId, arr);
  }

  return conversationRows.map((c) => {
    const msgs = messagesByConversation.get(c.id) ?? [];
    const lastRead = lastReadByConversation.get(c.id) ?? null;
    const unreadCount = lastRead
      ? msgs.filter((m) => m.createdAt > lastRead && m.senderUserId !== userId)
          .length
      : msgs.filter((m) => m.senderUserId !== userId).length;
    return {
      id: c.id,
      title: c.title,
      conversationType: c.conversationType,
      linkedObjectType: c.linkedObjectType,
      linkedObjectId: c.linkedObjectId,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      messageCount: c.messageCount,
      createdAt: c.createdAt,
      unreadCount,
      participants: participantsByConversation.get(c.id) ?? [],
      messages: msgs,
    };
  });
}

export type DocumentLinkRow = {
  linkedObjectType: string;
  linkedObjectId: string;
  linkRole: string;
};

export type DocumentCategory =
  | "drawings"
  | "specifications"
  | "submittal"
  | "contracts"
  | "photos"
  | "permits"
  | "compliance"
  | "billing_backup"
  | "other";

export type DocumentRow = {
  id: string;
  projectId: string;
  documentType: string;
  category: DocumentCategory;
  title: string;
  storageKey: string;
  uploadedByUserId: string;
  uploadedByName: string | null;
  visibilityScope: string;
  audienceScope: string;
  documentStatus: "active" | "pending_review" | "superseded" | "archived";
  isSuperseded: boolean;
  supersedesDocumentId: string | null;
  supersededByDocumentId: string | null;
  fileSizeBytes: number | null;
  links: DocumentLinkRow[];
  createdAt: Date;
  updatedAt: Date;
};

export type DocumentAudience = "contractor" | "subcontractor" | "client";

// Role-scoped read of every document on a project. Contractor sees all
// non-archived rows; subs are blocked from client-only / internal-only
// content; clients get only project-wide or explicitly client-visible
// material. Supersession lives on the `supersedes_document_id` column
// (Step 22) — the legacy link_role='supersedes' pivot was backfilled
// and dropped by 0016_document_versioning.sql.
export async function loadDocumentsForProject(
  projectId: string,
  audience: DocumentAudience,
  callerOrgId: string,
): Promise<DocumentRow[]> {
  const rows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        id: documents.id,
        projectId: documents.projectId,
        documentType: documents.documentType,
        category: documents.category,
        title: documents.title,
        storageKey: documents.storageKey,
        uploadedByUserId: documents.uploadedByUserId,
        uploadedByName: users.displayName,
        visibilityScope: documents.visibilityScope,
        audienceScope: documents.audienceScope,
        documentStatus: documents.documentStatus,
        isSuperseded: documents.isSuperseded,
        supersedesDocumentId: documents.supersedesDocumentId,
        fileSizeBytes: documents.fileSizeBytes,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.uploadedByUserId))
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.createdAt)),
  );

  // Audience filter applied in JS so the loader stays readable. This list
  // is short per project and drizzle's enum-on-array predicates are noisier
  // than the explicit conditional below.
  const filtered = rows.filter((r) => {
    if (r.documentStatus === "archived") return false;
    if (audience === "contractor") return true;
    if (audience === "subcontractor") {
      if (r.visibilityScope === "internal_only") return false;
      if (
        r.audienceScope === "client" ||
        r.audienceScope === "commercial_client" ||
        r.audienceScope === "residential_client" ||
        r.audienceScope === "internal"
      ) {
        return false;
      }
      return true;
    }
    // client audience
    if (
      r.visibilityScope !== "project_wide" &&
      r.visibilityScope !== "client_visible"
    ) {
      return false;
    }
    if (
      r.audienceScope !== "client" &&
      r.audienceScope !== "commercial_client" &&
      r.audienceScope !== "residential_client" &&
      r.audienceScope !== "mixed"
    ) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) return [];

  const ids = filtered.map((r) => r.id);
  const linkRows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        documentId: documentLinks.documentId,
        linkedObjectType: documentLinks.linkedObjectType,
        linkedObjectId: documentLinks.linkedObjectId,
        linkRole: documentLinks.linkRole,
      })
      .from(documentLinks)
      .where(inArray(documentLinks.documentId, ids)),
  );

  const linksByDoc = new Map<string, DocumentLinkRow[]>();
  for (const l of linkRows) {
    const arr = linksByDoc.get(l.documentId) ?? [];
    arr.push({
      linkedObjectType: l.linkedObjectType,
      linkedObjectId: l.linkedObjectId,
      linkRole: l.linkRole,
    });
    linksByDoc.set(l.documentId, arr);
  }

  // Superseded-by lookup: reverse-index the supersedes_document_id
  // column. For any doc in `ids` that has a successor (another doc
  // whose supersedes_document_id points at it), record that successor
  // id. Used by the UI to render "v3 (current)" pills on old rows.
  const successorRows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        id: documents.id,
        predecessorId: documents.supersedesDocumentId,
      })
      .from(documents)
      .where(inArray(documents.supersedesDocumentId, ids)),
  );
  const supersededByMap = new Map<string, string>();
  for (const s of successorRows) {
    if (s.predecessorId) {
      supersededByMap.set(s.predecessorId, s.id);
    }
  }

  return filtered.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    documentType: r.documentType,
    category: r.category as DocumentCategory,
    title: r.title,
    storageKey: r.storageKey,
    uploadedByUserId: r.uploadedByUserId,
    uploadedByName: r.uploadedByName,
    visibilityScope: r.visibilityScope,
    audienceScope: r.audienceScope,
    documentStatus: r.documentStatus,
    isSuperseded: r.isSuperseded,
    supersedesDocumentId: r.supersedesDocumentId,
    supersededByDocumentId: supersededByMap.get(r.id) ?? null,
    fileSizeBytes: r.fileSizeBytes,
    links: linksByDoc.get(r.id) ?? [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export type ContractorProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  teamCount: number;
  milestones: Array<{
    id: string;
    title: string;
    milestoneStatus: string;
    scheduledDate: Date;
  }>;
  rfis: RfiRow[];
  changeOrders: Array<{ id: string; title: string; changeOrderStatus: string }>;
  drawRequests: Array<{
    id: string;
    sovId: string;
    drawNumber: number;
    drawRequestStatus: string;
    periodFrom: Date;
    periodTo: Date;
    originalContractSumCents: number;
    netChangeOrdersCents: number;
    contractSumToDateCents: number;
    totalCompletedToDateCents: number;
    totalRetainageCents: number;
    totalEarnedLessRetainageCents: number;
    previousCertificatesCents: number;
    currentPaymentDueCents: number;
    balanceToFinishCents: number;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    returnedAt: Date | null;
    returnReason: string | null;
    paidAt: Date | null;
    paymentReferenceName: string | null;
    receiptPaymentTransactionId: string | null;
    retainageReleasedCents: number;
    lineItems: Array<{
      id: string;
      sovLineItemId: string;
      itemNumber: string;
      description: string;
      scheduledValueCents: number;
      workCompletedPreviousCents: number;
      workCompletedThisPeriodCents: number;
      materialsPresentlyStoredCents: number;
      totalCompletedStoredToDateCents: number;
      percentCompleteBasisPoints: number;
      balanceToFinishCents: number;
      retainageCents: number;
      retainagePercentApplied: number;
    }>;
    lienWaivers: LienWaiverRow[];
    supportingFiles: DrawRequestSupportingFile[];
    activityTrail: DrawRequestActivityEvent[];
  }>;
  retainageReleases: RetainageReleaseRow[];
  uploadRequests: UploadRequestRow[];
  approvals: Array<{
    id: string;
    approvalNumber: number;
    title: string;
    category: string;
    approvalStatus: string;
    impactCostCents: number;
    impactScheduleDays: number;
    decisionNote: string | null;
  }>;
  complianceRecords: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    complianceType: string;
    complianceStatus: string;
    expiresAt: Date | null;
    documentId: string | null;
    documentTitle: string | null;
    documentType: string | null;
    activityTrail: Array<{
      id: string;
      title: string;
      body: string | null;
      activityType: string;
      actorName: string | null;
      createdAt: Date;
    }>;
  }>;
  scheduleOfValues: {
    id: string;
    version: number;
    sovStatus: string;
    totalScheduledValueCents: number;
    totalOriginalContractCents: number;
    totalChangeOrdersCents: number;
    defaultRetainagePercent: number;
    lineItems: Array<{
      id: string;
      itemNumber: string;
      costCode: string | null;
      description: string;
      lineItemType: string;
      scheduledValueCents: number;
      retainagePercentOverride: number | null;
      sortOrder: number;
      isActive: boolean;
    }>;
  } | null;
  selections: SelectionCategoryRow[];
  conversations: ConversationRow[];
  documents: DocumentRow[];
  details: {
    projectType: string | null;
    currentPhase: string;
    projectStatus: string;
    startDate: Date | null;
    targetCompletionDate: Date | null;
    addressLine1: string | null;
    city: string | null;
    stateProvince: string | null;
    contractValueCents: number | null;
    clientOrganizationId: string | null;
    clientOrganizationName: string | null;
  };
  teamMembers: Array<{
    id: string;
    userId: string;
    displayName: string | null;
    email: string;
    roleKey: string;
    portalType: string;
    organizationId: string;
    organizationName: string | null;
    organizationType: string;
  }>;
  activity: Array<{
    id: string;
    title: string;
    body: string | null;
    activityType: string;
    actorName: string | null;
    createdAt: Date;
  }>;
  unreadConversationCount: number;
};

export async function getContractorProjectView(
  input: LoaderInput,
): Promise<ContractorProjectView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "contractor_admin" &&
    context.role !== "contractor_pm"
  ) {
    throw new AuthorizationError(
      "Contractor project view requires a contractor role",
      "forbidden",
    );
  }
  const projectId = context.project.id;

  const [
    milestoneRows,
    rfiRows,
    coRows,
    drawRows,
    teamRows,
    uploadRequestRows,
    approvalRows,
    complianceRows,
    sovRows,
  ] = await Promise.all([
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: milestones.id,
          title: milestones.title,
          milestoneStatus: milestones.milestoneStatus,
          scheduledDate: milestones.scheduledDate,
        })
        .from(milestones)
        .where(eq(milestones.projectId, projectId))
        .orderBy(milestones.scheduledDate),
    ),
    loadRfisWithResponses(projectId, context.organization.id),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: changeOrders.id,
          title: changeOrders.title,
          changeOrderStatus: changeOrders.changeOrderStatus,
        })
        .from(changeOrders)
        .where(eq(changeOrders.projectId, projectId))
        .orderBy(desc(changeOrders.createdAt)),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select()
        .from(drawRequests)
        .where(eq(drawRequests.projectId, projectId))
        .orderBy(desc(drawRequests.drawNumber)),
    ),
    // Contractor view: caller's org is the project's contractor org.
    // Multi-org PUM policy clause B (project ownership) lets them see
    // every member's PUM regardless of which org owns the row.
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: projectUserMemberships.id,
          userId: users.id,
          displayName: users.displayName,
          email: users.email,
          roleKey: roleAssignments.roleKey,
          portalType: roleAssignments.portalType,
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationType: organizations.organizationType,
        })
        .from(projectUserMemberships)
        .innerJoin(users, eq(users.id, projectUserMemberships.userId))
        .innerJoin(
          roleAssignments,
          eq(roleAssignments.id, projectUserMemberships.roleAssignmentId),
        )
        .innerJoin(
          organizations,
          eq(organizations.id, projectUserMemberships.organizationId),
        )
        .where(
          and(
            eq(projectUserMemberships.projectId, projectId),
            eq(projectUserMemberships.membershipStatus, "active"),
          ),
        ),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: uploadRequests.id,
          title: uploadRequests.title,
          description: uploadRequests.description,
          requestStatus: uploadRequests.requestStatus,
          requestedFromOrganizationId: uploadRequests.requestedFromOrganizationId,
          requestedFromOrganizationName: organizations.name,
          expectedFileType: uploadRequests.expectedFileType,
          dueAt: uploadRequests.dueAt,
          submittedAt: uploadRequests.submittedAt,
          submittedByUserId: uploadRequests.submittedByUserId,
          completedAt: uploadRequests.completedAt,
          revisionNote: uploadRequests.revisionNote,
          responseNote: uploadRequests.responseNote,
          createdAt: uploadRequests.createdAt,
          submittedDocumentId: uploadRequests.submittedDocumentId,
          submittedDocumentTitle: documents.title,
          submittedDocumentType: documents.documentType,
        })
        .from(uploadRequests)
        .leftJoin(
          organizations,
          eq(organizations.id, uploadRequests.requestedFromOrganizationId),
        )
        .leftJoin(documents, eq(documents.id, uploadRequests.submittedDocumentId))
        .where(eq(uploadRequests.projectId, projectId))
        .orderBy(desc(uploadRequests.createdAt)),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: approvals.id,
          approvalNumber: approvals.approvalNumber,
          title: approvals.title,
          category: approvals.category,
          approvalStatus: approvals.approvalStatus,
          impactCostCents: approvals.impactCostCents,
          impactScheduleDays: approvals.impactScheduleDays,
          decisionNote: approvals.decisionNote,
        })
        .from(approvals)
        .where(eq(approvals.projectId, projectId))
        .orderBy(desc(approvals.createdAt)),
    ),
    // Contractor reading their project's compliance — multi-org policy
    // clause B (project ownership) returns sub records too.
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: complianceRecords.id,
          organizationId: complianceRecords.organizationId,
          organizationName: organizations.name,
          complianceType: complianceRecords.complianceType,
          complianceStatus: complianceRecords.complianceStatus,
          expiresAt: complianceRecords.expiresAt,
          documentId: complianceRecords.documentId,
          documentTitle: documents.title,
          documentType: documents.documentType,
        })
        .from(complianceRecords)
        .leftJoin(organizations, eq(organizations.id, complianceRecords.organizationId))
        .leftJoin(documents, eq(documents.id, complianceRecords.documentId))
        .where(eq(complianceRecords.projectId, projectId))
        .orderBy(desc(complianceRecords.createdAt)),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: scheduleOfValues.id,
          version: scheduleOfValues.version,
          sovStatus: scheduleOfValues.sovStatus,
          totalScheduledValueCents: scheduleOfValues.totalScheduledValueCents,
          totalOriginalContractCents: scheduleOfValues.totalOriginalContractCents,
          totalChangeOrdersCents: scheduleOfValues.totalChangeOrdersCents,
          defaultRetainagePercent: scheduleOfValues.defaultRetainagePercent,
          createdAt: scheduleOfValues.createdAt,
        })
        .from(scheduleOfValues)
        .where(
          and(
            eq(scheduleOfValues.projectId, projectId),
            inArray(scheduleOfValues.sovStatus, ["draft", "active", "locked"]),
          ),
        )
        .orderBy(desc(scheduleOfValues.createdAt))
        .limit(1),
    ),
  ]);

  const drawIds = drawRows.map((d) => d.id);
  const [drawLineItemRows, waiverRows, releaseRows] = await Promise.all([
    drawIds.length
      ? withTenant(context.organization.id, (tx) =>
          tx
            .select({
              id: drawLineItems.id,
              drawRequestId: drawLineItems.drawRequestId,
              sovLineItemId: drawLineItems.sovLineItemId,
              itemNumber: sovLineItems.itemNumber,
              description: sovLineItems.description,
              scheduledValueCents: sovLineItems.scheduledValueCents,
              workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
              workCompletedThisPeriodCents: drawLineItems.workCompletedThisPeriodCents,
              materialsPresentlyStoredCents:
                drawLineItems.materialsPresentlyStoredCents,
              totalCompletedStoredToDateCents:
                drawLineItems.totalCompletedStoredToDateCents,
              percentCompleteBasisPoints: drawLineItems.percentCompleteBasisPoints,
              balanceToFinishCents: drawLineItems.balanceToFinishCents,
              retainageCents: drawLineItems.retainageCents,
              retainagePercentApplied: drawLineItems.retainagePercentApplied,
              sortOrder: sovLineItems.sortOrder,
            })
            .from(drawLineItems)
            .innerJoin(sovLineItems, eq(sovLineItems.id, drawLineItems.sovLineItemId))
            .where(inArray(drawLineItems.drawRequestId, drawIds))
            .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber)),
        )
      : Promise.resolve([] as never[]),
    drawIds.length
      ? // Contractor view — multi-org policy clause B (project ownership)
        // returns all sub waivers on this contractor's project.
        withTenant(context.organization.id, (tx) =>
          tx
            .select({
              id: lienWaivers.id,
              drawRequestId: lienWaivers.drawRequestId,
              organizationId: lienWaivers.organizationId,
              organizationName: organizations.name,
              lienWaiverType: lienWaivers.lienWaiverType,
              lienWaiverStatus: lienWaivers.lienWaiverStatus,
              amountCents: lienWaivers.amountCents,
              throughDate: lienWaivers.throughDate,
              documentId: lienWaivers.documentId,
              requestedAt: lienWaivers.requestedAt,
              submittedAt: lienWaivers.submittedAt,
              acceptedAt: lienWaivers.acceptedAt,
              createdAt: lienWaivers.createdAt,
            })
            .from(lienWaivers)
            .leftJoin(organizations, eq(organizations.id, lienWaivers.organizationId))
            .where(inArray(lienWaivers.drawRequestId, drawIds))
            .orderBy(asc(lienWaivers.lienWaiverType), desc(lienWaivers.createdAt)),
        )
      : Promise.resolve([] as never[]),
    withTenant(context.organization.id, (tx) =>
      tx
        .select()
        .from(retainageReleases)
        .where(eq(retainageReleases.projectId, projectId))
        .orderBy(desc(retainageReleases.createdAt)),
    ),
  ]);

  const drawLinesByDraw = new Map<string, typeof drawLineItemRows>();
  for (const l of drawLineItemRows) {
    const arr = drawLinesByDraw.get(l.drawRequestId) ?? [];
    arr.push(l);
    drawLinesByDraw.set(l.drawRequestId, arr);
  }

  const waiversByDraw = new Map<string, LienWaiverRow[]>();
  for (const w of waiverRows) {
    const row: LienWaiverRow = {
      id: w.id,
      drawRequestId: w.drawRequestId,
      organizationId: w.organizationId,
      organizationName: w.organizationName,
      lienWaiverType: w.lienWaiverType,
      lienWaiverStatus: w.lienWaiverStatus,
      amountCents: w.amountCents,
      throughDate: w.throughDate,
      documentId: w.documentId,
      requestedAt: w.requestedAt,
      submittedAt: w.submittedAt,
      acceptedAt: w.acceptedAt,
    };
    const arr = waiversByDraw.get(w.drawRequestId) ?? [];
    arr.push(row);
    waiversByDraw.set(w.drawRequestId, arr);
  }

  const retainageReleasesView: RetainageReleaseRow[] = releaseRows.map((r) => ({
    id: r.id,
    sovLineItemId: r.sovLineItemId,
    releaseStatus: r.releaseStatus,
    releaseAmountCents: r.releaseAmountCents,
    totalRetainageHeldCents: r.totalRetainageHeldCents,
    approvalNote: r.approvalNote,
    requestedAt: r.requestedAt,
    approvedAt: r.approvedAt,
    consumedByDrawRequestId: r.consumedByDrawRequestId,
    consumedAt: r.consumedAt,
    createdAt: r.createdAt,
  }));

  const drawEnrichment = await loadDrawRequestEnrichment(
    drawIds,
    context.organization.id,
  );

  const drawRequestsView = drawRows.map((d) => ({
    id: d.id,
    sovId: d.sovId,
    drawNumber: d.drawNumber,
    drawRequestStatus: d.drawRequestStatus,
    periodFrom: d.periodFrom,
    periodTo: d.periodTo,
    originalContractSumCents: d.originalContractSumCents,
    netChangeOrdersCents: d.netChangeOrdersCents,
    contractSumToDateCents: d.contractSumToDateCents,
    totalCompletedToDateCents: d.totalCompletedToDateCents,
    totalRetainageCents: d.totalRetainageCents,
    totalEarnedLessRetainageCents: d.totalEarnedLessRetainageCents,
    previousCertificatesCents: d.previousCertificatesCents,
    currentPaymentDueCents: d.currentPaymentDueCents,
    balanceToFinishCents: d.balanceToFinishCents,
    submittedAt: d.submittedAt,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote,
    returnedAt: d.returnedAt,
    returnReason: d.returnReason,
    paidAt: d.paidAt,
    paymentReferenceName: d.paymentReferenceName,
    receiptPaymentTransactionId:
      drawEnrichment.receiptPaymentIdByDrawId.get(d.id) ?? null,
    retainageReleasedCents: d.retainageReleasedCents,
    lineItems: (drawLinesByDraw.get(d.id) ?? []).map((l) => ({
      id: l.id,
      sovLineItemId: l.sovLineItemId,
      itemNumber: l.itemNumber,
      description: l.description,
      scheduledValueCents: l.scheduledValueCents,
      workCompletedPreviousCents: l.workCompletedPreviousCents,
      workCompletedThisPeriodCents: l.workCompletedThisPeriodCents,
      materialsPresentlyStoredCents: l.materialsPresentlyStoredCents,
      totalCompletedStoredToDateCents: l.totalCompletedStoredToDateCents,
      percentCompleteBasisPoints: l.percentCompleteBasisPoints,
      balanceToFinishCents: l.balanceToFinishCents,
      retainageCents: l.retainageCents,
      retainagePercentApplied: l.retainagePercentApplied,
    })),
    lienWaivers: waiversByDraw.get(d.id) ?? [],
    supportingFiles: drawEnrichment.filesById.get(d.id) ?? [],
    activityTrail: drawEnrichment.activityById.get(d.id) ?? [],
  }));

  const selections = await loadSelectionsForProject(projectId, {
    callerOrgId: context.organization.id,
  });
  const conversationList = await loadConversationsForUser(
    projectId,
    context.user.id,
    context.organization.id,
  );
  const documentList = await loadDocumentsForProject(
    projectId,
    "contractor",
    context.organization.id,
  );

  // Recent project movement — activity feed for this project
  const activityRows = await db
    .select({
      id: activityFeedItems.id,
      title: activityFeedItems.title,
      body: activityFeedItems.body,
      activityType: activityFeedItems.activityType,
      createdAt: activityFeedItems.createdAt,
      actorName: users.displayName,
    })
    .from(activityFeedItems)
    .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
    .where(eq(activityFeedItems.projectId, projectId))
    .orderBy(desc(activityFeedItems.createdAt))
    .limit(6);

  // Unread conversations: threads where lastMessageAt > this user's lastReadAt
  // (or user has never read). Counted, not returned — Hero snapshot only needs the number.
  const unreadRows = await db
    .select({
      conversationId: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      lastReadAt: conversationParticipants.lastReadAt,
    })
    .from(conversations)
    .leftJoin(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, conversations.id),
        eq(conversationParticipants.userId, context.user.id),
      ),
    )
    .where(eq(conversations.projectId, projectId));
  const unreadConversationCount = unreadRows.filter(
    (r) =>
      r.lastMessageAt &&
      (!r.lastReadAt || r.lastReadAt.getTime() < r.lastMessageAt.getTime()),
  ).length;

  const [projectRow] = await db
    .select({
      projectType: projects.projectType,
      currentPhase: projects.currentPhase,
      projectStatus: projects.projectStatus,
      startDate: projects.startDate,
      targetCompletionDate: projects.targetCompletionDate,
      addressLine1: projects.addressLine1,
      city: projects.city,
      stateProvince: projects.stateProvince,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const [clientOrgRow] = await withTenant(context.organization.id, (tx) =>
    tx
      .select({
        organizationId: organizations.id,
        organizationName: organizations.name,
      })
      .from(projectOrganizationMemberships)
      .innerJoin(
        organizations,
        eq(organizations.id, projectOrganizationMemberships.organizationId),
      )
      .where(
        and(
          eq(projectOrganizationMemberships.projectId, projectId),
          eq(projectOrganizationMemberships.membershipType, "client"),
        ),
      )
      .limit(1),
  );

  const sovRow = sovRows[0] ?? null;
  const sovLineItemRows = sovRow
    ? await withTenant(context.organization.id, (tx) =>
        tx
          .select({
            id: sovLineItems.id,
            itemNumber: sovLineItems.itemNumber,
            costCode: sovLineItems.costCode,
            description: sovLineItems.description,
            lineItemType: sovLineItems.lineItemType,
            scheduledValueCents: sovLineItems.scheduledValueCents,
            retainagePercentOverride: sovLineItems.retainagePercentOverride,
            sortOrder: sovLineItems.sortOrder,
            isActive: sovLineItems.isActive,
          })
          .from(sovLineItems)
          .where(eq(sovLineItems.sovId, sovRow.id))
          .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber)),
      )
    : [];

  const contractorUrEnrich = await loadUploadRequestEnrichment(uploadRequestRows);
  const contractorUploadRequestRows: UploadRequestRow[] = uploadRequestRows.map(
    (r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      requestStatus: r.requestStatus,
      requestedFromOrganizationId: r.requestedFromOrganizationId,
      requestedFromOrganizationName: r.requestedFromOrganizationName,
      expectedFileType: r.expectedFileType,
      dueAt: r.dueAt,
      submittedAt: r.submittedAt,
      completedAt: r.completedAt,
      revisionNote: r.revisionNote,
      responseNote: r.responseNote,
      createdAt: r.createdAt,
      submittedDocumentId: r.submittedDocumentId,
      submittedDocumentTitle: r.submittedDocumentTitle,
      submittedFile: contractorUrEnrich.filesById.get(r.id) ?? null,
      activityTrail: contractorUrEnrich.activityById.get(r.id) ?? [],
    }),
  );

  // Compliance activity trail enrichment
  const complianceIds = complianceRows.map((r) => r.id);
  const complianceActivityRows = complianceIds.length > 0
    ? await db
        .select({
          id: activityFeedItems.id,
          relatedObjectId: activityFeedItems.relatedObjectId,
          title: activityFeedItems.title,
          body: activityFeedItems.body,
          activityType: activityFeedItems.activityType,
          createdAt: activityFeedItems.createdAt,
          actorName: users.displayName,
        })
        .from(activityFeedItems)
        .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
        .where(
          and(
            eq(activityFeedItems.relatedObjectType, "compliance_record"),
            inArray(activityFeedItems.relatedObjectId, complianceIds),
          ),
        )
        .orderBy(desc(activityFeedItems.createdAt))
    : [];
  const complianceActivityById = new Map<string, Array<{ id: string; title: string; body: string | null; activityType: string; actorName: string | null; createdAt: Date }>>();
  for (const a of complianceActivityRows) {
    if (!a.relatedObjectId) continue;
    const arr = complianceActivityById.get(a.relatedObjectId) ?? [];
    arr.push({ id: a.id, title: a.title, body: a.body, activityType: a.activityType, actorName: a.actorName, createdAt: a.createdAt });
    complianceActivityById.set(a.relatedObjectId, arr);
  }
  const enrichedComplianceRows = complianceRows.map((r) => ({
    ...r,
    activityTrail: complianceActivityById.get(r.id) ?? [],
  }));

  return {
    context,
    project: context.project,
    teamCount: teamRows.length,
    milestones: milestoneRows,
    rfis: rfiRows,
    changeOrders: coRows,
    drawRequests: drawRequestsView,
    retainageReleases: retainageReleasesView,
    uploadRequests: contractorUploadRequestRows,
    approvals: approvalRows,
    complianceRecords: enrichedComplianceRows,
    scheduleOfValues: sovRow
      ? {
          id: sovRow.id,
          version: sovRow.version,
          sovStatus: sovRow.sovStatus,
          totalScheduledValueCents: sovRow.totalScheduledValueCents,
          totalOriginalContractCents: sovRow.totalOriginalContractCents,
          totalChangeOrdersCents: sovRow.totalChangeOrdersCents,
          defaultRetainagePercent: sovRow.defaultRetainagePercent,
          lineItems: sovLineItemRows,
        }
      : null,
    selections,
    conversations: conversationList,
    documents: documentList,
    details: {
      projectType: projectRow?.projectType ?? null,
      currentPhase: projectRow?.currentPhase ?? "preconstruction",
      projectStatus: projectRow?.projectStatus ?? "draft",
      startDate: projectRow?.startDate ?? null,
      targetCompletionDate: projectRow?.targetCompletionDate ?? null,
      addressLine1: projectRow?.addressLine1 ?? null,
      city: projectRow?.city ?? null,
      stateProvince: projectRow?.stateProvince ?? null,
      contractValueCents: projectRow?.contractValueCents ?? null,
      clientOrganizationId: clientOrgRow?.organizationId ?? null,
      clientOrganizationName: clientOrgRow?.organizationName ?? null,
    },
    teamMembers: teamRows.map((t) => ({
      id: t.id,
      userId: t.userId,
      displayName: t.displayName,
      email: t.email,
      roleKey: t.roleKey,
      portalType: t.portalType,
      organizationId: t.organizationId,
      organizationName: t.organizationName,
      organizationType: t.organizationType,
    })),
    activity: activityRows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      activityType: a.activityType,
      actorName: a.actorName,
      createdAt: a.createdAt,
    })),
    unreadConversationCount,
  };
}

export type SubcontractorProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  scope: { workScope: string | null; phaseScope: string | null };
  assignedRfis: RfiRow[];
  assignedChangeOrders: Array<{
    id: string;
    title: string;
    changeOrderStatus: string;
  }>;
  myMilestones: Array<{
    id: string;
    title: string;
    milestoneStatus: string;
    scheduledDate: Date;
  }>;
  pendingUploadRequests: Array<{
    id: string;
    title: string;
    description: string | null;
    requestStatus: string;
    expectedFileType: string | null;
    dueAt: Date | null;
    revisionNote: string | null;
  }>;
  allUploadRequests: UploadRequestRow[];
  complianceRecords: Array<{
    id: string;
    complianceType: string;
    complianceStatus: string;
    expiresAt: Date | null;
    documentId: string | null;
    documentTitle: string | null;
    documentType: string | null;
  }>;
  conversations: ConversationRow[];
  documents: DocumentRow[];
  activityTrail: SubProjectActivityEvent[];
  gcContacts: SubProjectGcContact[];
  quickAccessCounts: SubProjectQuickAccessCounts;
};

export type SubProjectActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  relatedObjectType: string | null;
  actorName: string | null;
  createdAt: Date;
};

export type SubProjectGcContact = {
  id: string;
  name: string;
  roleLabel: string;
  initials: string;
};

export type SubProjectQuickAccessCounts = {
  unreadMessages: number;
  documentCount: number;
  pendingFinancialsCents: number;
};

export async function getSubcontractorProjectView(
  input: LoaderInput,
): Promise<SubcontractorProjectView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (context.role !== "subcontractor_user") {
    throw new AuthorizationError(
      "Subcontractor project view requires a subcontractor role",
      "forbidden",
    );
  }
  const projectId = context.project.id;
  const subOrgId = context.organization.id;

  const [
    rfiRows,
    coRows,
    milestoneRows,
    pendingRows,
    allUploadRows,
    complianceRows,
  ] = await Promise.all([
    loadRfisWithResponses(projectId, subOrgId, {
      assignedToOrganizationId: subOrgId,
    }),
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: changeOrders.id,
          title: changeOrders.title,
          changeOrderStatus: changeOrders.changeOrderStatus,
        })
        .from(changeOrders)
        .where(eq(changeOrders.projectId, projectId))
        .orderBy(desc(changeOrders.createdAt)),
    ),
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: milestones.id,
          title: milestones.title,
          milestoneStatus: milestones.milestoneStatus,
          scheduledDate: milestones.scheduledDate,
        })
        .from(milestones)
        .where(
          and(
            eq(milestones.projectId, projectId),
            eq(milestones.assignedToOrganizationId, subOrgId),
          ),
        )
        .orderBy(milestones.scheduledDate),
    ),
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: uploadRequests.id,
          title: uploadRequests.title,
          description: uploadRequests.description,
          requestStatus: uploadRequests.requestStatus,
          expectedFileType: uploadRequests.expectedFileType,
          dueAt: uploadRequests.dueAt,
          revisionNote: uploadRequests.revisionNote,
        })
        .from(uploadRequests)
        .where(
          and(
            eq(uploadRequests.projectId, projectId),
            eq(uploadRequests.requestedFromOrganizationId, subOrgId),
            inArray(uploadRequests.requestStatus, ["open", "revision_requested"]),
          ),
        )
        .orderBy(desc(uploadRequests.createdAt)),
    ),
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: uploadRequests.id,
          title: uploadRequests.title,
          description: uploadRequests.description,
          requestStatus: uploadRequests.requestStatus,
          requestedFromOrganizationId: uploadRequests.requestedFromOrganizationId,
          expectedFileType: uploadRequests.expectedFileType,
          dueAt: uploadRequests.dueAt,
          submittedAt: uploadRequests.submittedAt,
          submittedByUserId: uploadRequests.submittedByUserId,
          completedAt: uploadRequests.completedAt,
          revisionNote: uploadRequests.revisionNote,
          responseNote: uploadRequests.responseNote,
          createdAt: uploadRequests.createdAt,
          submittedDocumentId: uploadRequests.submittedDocumentId,
          submittedDocumentTitle: documents.title,
          submittedDocumentType: documents.documentType,
        })
        .from(uploadRequests)
        .leftJoin(documents, eq(documents.id, uploadRequests.submittedDocumentId))
        .where(
          and(
            eq(uploadRequests.projectId, projectId),
            eq(uploadRequests.requestedFromOrganizationId, subOrgId),
          ),
        )
        .orderBy(desc(uploadRequests.createdAt)),
    ),
    // Sub viewing own project compliance — multi-org policy clause A
    // (organization_id = GUC) satisfies.
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: complianceRecords.id,
          complianceType: complianceRecords.complianceType,
          complianceStatus: complianceRecords.complianceStatus,
          expiresAt: complianceRecords.expiresAt,
          documentId: complianceRecords.documentId,
          documentTitle: documents.title,
          documentType: documents.documentType,
        })
        .from(complianceRecords)
        .leftJoin(documents, eq(documents.id, complianceRecords.documentId))
        .where(
          and(
            eq(complianceRecords.projectId, projectId),
            eq(complianceRecords.organizationId, subOrgId),
          ),
        )
        .orderBy(desc(complianceRecords.createdAt)),
    ),
  ]);

  const subUrEnrich = await loadUploadRequestEnrichment(allUploadRows);
  const allUploadRequestsView: UploadRequestRow[] = allUploadRows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    requestStatus: r.requestStatus,
    requestedFromOrganizationId: r.requestedFromOrganizationId,
    requestedFromOrganizationName: null,
    expectedFileType: r.expectedFileType,
    dueAt: r.dueAt,
    submittedAt: r.submittedAt,
    completedAt: r.completedAt,
    revisionNote: r.revisionNote,
    responseNote: r.responseNote,
    createdAt: r.createdAt,
    submittedDocumentId: r.submittedDocumentId,
    submittedDocumentTitle: r.submittedDocumentTitle,
    submittedFile: subUrEnrich.filesById.get(r.id) ?? null,
    activityTrail: subUrEnrich.activityById.get(r.id) ?? [],
  }));

  const subProjectConversations = await loadConversationsForUser(
    projectId,
    context.user.id,
    context.organization.id,
  );
  const subProjectDocuments = await loadDocumentsForProject(
    projectId,
    "subcontractor",
    context.organization.id,
  );

  const [activityRows, gcContactRows] = await Promise.all([
    db
      .select({
        id: activityFeedItems.id,
        title: activityFeedItems.title,
        body: activityFeedItems.body,
        activityType: activityFeedItems.activityType,
        relatedObjectType: activityFeedItems.relatedObjectType,
        createdAt: activityFeedItems.createdAt,
        actorName: users.displayName,
      })
      .from(activityFeedItems)
      .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
      .where(eq(activityFeedItems.projectId, projectId))
      .orderBy(desc(activityFeedItems.createdAt))
      .limit(12),
    context.project.contractorOrganizationId
      ? withTenant(context.organization.id, (tx) =>
          tx
            .select({
              id: users.id,
              displayName: users.displayName,
              roleKey: roleAssignments.roleKey,
            })
            .from(projectUserMemberships)
            .innerJoin(users, eq(users.id, projectUserMemberships.userId))
            .innerJoin(
              roleAssignments,
              and(
                eq(roleAssignments.userId, projectUserMemberships.userId),
                eq(
                  roleAssignments.organizationId,
                  projectUserMemberships.organizationId,
                ),
              ),
            )
            .where(
              and(
                eq(projectUserMemberships.projectId, projectId),
                eq(
                  projectUserMemberships.organizationId,
                  context.project.contractorOrganizationId,
                ),
                eq(projectUserMemberships.membershipStatus, "active"),
              ),
            ),
        )
      : Promise.resolve(
          [] as Array<{
            id: string;
            displayName: string | null;
            roleKey: string;
          }>,
        ),
  ]);

  const activityTrail: SubProjectActivityEvent[] = activityRows.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    activityType: a.activityType,
    relatedObjectType: a.relatedObjectType,
    actorName: a.actorName,
    createdAt: a.createdAt,
  }));

  const roleLabelMap: Record<string, string> = {
    project_manager: "Project Manager",
    superintendent: "Superintendent",
    owner: "Owner",
    admin: "Admin",
    estimator: "Estimator",
    foreman: "Foreman",
  };
  const gcSeen = new Set<string>();
  const gcContacts: SubProjectGcContact[] = [];
  for (const g of gcContactRows) {
    if (gcSeen.has(g.id)) continue;
    gcSeen.add(g.id);
    const name = g.displayName ?? "Team member";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "GC";
    gcContacts.push({
      id: g.id,
      name,
      roleLabel:
        roleLabelMap[g.roleKey] ??
        g.roleKey
          .split("_")
          .map((w) => w[0]?.toUpperCase() + w.slice(1))
          .join(" "),
      initials,
    });
    if (gcContacts.length >= 4) break;
  }

  const unreadMessages = subProjectConversations.reduce(
    (sum, c) => sum + (c.unreadCount ?? 0),
    0,
  );
  // Project-scoped: sum this sub's pending lien-waiver amounts against
  // draws in submitted/under_review on THIS project only. (Cross-project
  // sum lives on the Today Board.)
  const pendingFinancialsCents = await getSubPendingFinancialsCents({
    subOrgId,
    projectId,
  });
  const quickAccessCounts: SubProjectQuickAccessCounts = {
    unreadMessages,
    documentCount: subProjectDocuments.length,
    pendingFinancialsCents,
  };

  return {
    context,
    project: context.project,
    scope: {
      workScope: context.membership.workScope,
      phaseScope: context.membership.phaseScope,
    },
    assignedRfis: rfiRows,
    assignedChangeOrders: coRows,
    myMilestones: milestoneRows,
    pendingUploadRequests: pendingRows,
    allUploadRequests: allUploadRequestsView,
    complianceRecords: complianceRows,
    conversations: subProjectConversations,
    documents: subProjectDocuments,
    activityTrail,
    gcContacts,
    quickAccessCounts,
  };
}

export type ClientProjectView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  isResidential: boolean;
  milestones: Array<{
    id: string;
    title: string;
    milestoneStatus: string;
    scheduledDate: Date;
  }>;
  decisions: Array<{ id: string; title: string; changeOrderStatus: string }>;
  openRequests: Array<{ id: string; subject: string; rfiStatus: string }>;
  approvals: Array<{
    id: string;
    approvalNumber: number;
    title: string;
    category: string;
    approvalStatus: string;
    impactCostCents: number;
    impactScheduleDays: number;
    description: string | null;
    decisionNote: string | null;
    submittedAt: Date | null;
    decidedAt: Date | null;
  }>;
  drawRequests: Array<{
    id: string;
    drawNumber: number;
    drawRequestStatus: string;
    periodFrom: Date;
    periodTo: Date;
    originalContractSumCents: number;
    netChangeOrdersCents: number;
    contractSumToDateCents: number;
    totalCompletedToDateCents: number;
    totalRetainageCents: number;
    totalEarnedLessRetainageCents: number;
    previousCertificatesCents: number;
    currentPaymentDueCents: number;
    balanceToFinishCents: number;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    returnedAt: Date | null;
    returnReason: string | null;
    paidAt: Date | null;
    paymentReferenceName: string | null;
    receiptPaymentTransactionId: string | null;
    retainageReleasedCents: number;
    lienWaivers: LienWaiverRow[];
    lineItems: Array<{
      id: string;
      itemNumber: string;
      description: string;
      scheduledValueCents: number;
      workCompletedPreviousCents: number;
      workCompletedThisPeriodCents: number;
      materialsPresentlyStoredCents: number;
      totalCompletedStoredToDateCents: number;
      percentCompleteBasisPoints: number;
      balanceToFinishCents: number;
      retainageCents: number;
      retainagePercentApplied: number;
    }>;
    supportingFiles: DrawRequestSupportingFile[];
    activityTrail: DrawRequestActivityEvent[];
  }>;
  retainageReleases: RetainageReleaseRow[];
  selections: SelectionCategoryRow[];
  conversations: ConversationRow[];
  documents: DocumentRow[];
  activityTrail: ClientActivityEvent[];
  progressMetrics: ClientProgressMetrics;
  phasePercentByPhase: Record<string, number>;
  currentPhase: string;
  contractorOrganizationName: string | null;
  gcContacts: SubProjectGcContact[];
};

export type ClientActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  activityType: string;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
  actorName: string | null;
  createdAt: Date;
  photoAttachments: ClientActivityPhoto[];
};

export type ClientActivityPhoto = {
  id: string;
  title: string;
  documentType: string;
  createdAt: Date;
  url: string | null;
};

export type ClientProgressMetrics = {
  milestonesCompletedLast7d: number;
  photosAddedLast7d: number;
  scheduleStatus: "on_track" | "at_risk";
};

export async function getClientProjectView(
  input: LoaderInput,
): Promise<ClientProjectView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "commercial_client" &&
    context.role !== "residential_client"
  ) {
    throw new AuthorizationError(
      "Client project view requires a client role",
      "forbidden",
    );
  }
  const projectId = context.project.id;

  const [milestoneRows, coRows, rfiRows, approvalRows, drawRows] = await Promise.all([
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: milestones.id,
          title: milestones.title,
          milestoneStatus: milestones.milestoneStatus,
          scheduledDate: milestones.scheduledDate,
          phase: milestones.phase,
          visibilityScope: milestones.visibilityScope,
        })
        .from(milestones)
        .where(
          and(
            eq(milestones.projectId, projectId),
            inArray(milestones.visibilityScope, ["project_wide", "client_visible"]),
          ),
        )
        .orderBy(milestones.scheduledDate),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: changeOrders.id,
          title: changeOrders.title,
          changeOrderStatus: changeOrders.changeOrderStatus,
        })
        .from(changeOrders)
        .where(
          and(
            eq(changeOrders.projectId, projectId),
            inArray(changeOrders.changeOrderStatus, [
              "pending_client_approval",
              "approved",
              "rejected",
            ]),
          ),
        )
        .orderBy(desc(changeOrders.createdAt)),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: rfis.id,
          subject: rfis.subject,
          rfiStatus: rfis.rfiStatus,
        })
        .from(rfis)
        .where(
          and(
            eq(rfis.projectId, projectId),
            inArray(rfis.rfiStatus, ["open", "answered"]),
          ),
        )
        .orderBy(desc(rfis.createdAt)),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: approvals.id,
          approvalNumber: approvals.approvalNumber,
          title: approvals.title,
          category: approvals.category,
          approvalStatus: approvals.approvalStatus,
          impactCostCents: approvals.impactCostCents,
          impactScheduleDays: approvals.impactScheduleDays,
          description: approvals.description,
          decisionNote: approvals.decisionNote,
          submittedAt: approvals.submittedAt,
          decidedAt: approvals.decidedAt,
        })
        .from(approvals)
        .where(
          and(
            eq(approvals.projectId, projectId),
            inArray(approvals.approvalStatus, [
              "pending_review",
              "approved",
              "rejected",
              "needs_revision",
            ]),
          ),
        )
        .orderBy(desc(approvals.createdAt)),
    ),
    withTenant(context.organization.id, (tx) =>
      tx
        .select()
        .from(drawRequests)
        .where(
          and(
            eq(drawRequests.projectId, projectId),
            inArray(drawRequests.drawRequestStatus, [
              "submitted",
              "under_review",
              "approved",
              "approved_with_note",
              "returned",
              "revised",
              "paid",
            ]),
          ),
        )
        .orderBy(desc(drawRequests.drawNumber)),
    ),
  ]);

  const clientDrawIds = drawRows.map((d) => d.id);
  const [clientDrawLineRows, clientWaiverRows, clientReleaseRows] =
    await Promise.all([
      clientDrawIds.length
        ? withTenant(context.organization.id, (tx) =>
            tx
              .select({
                id: drawLineItems.id,
                drawRequestId: drawLineItems.drawRequestId,
                itemNumber: sovLineItems.itemNumber,
                description: sovLineItems.description,
                scheduledValueCents: sovLineItems.scheduledValueCents,
                workCompletedPreviousCents: drawLineItems.workCompletedPreviousCents,
                workCompletedThisPeriodCents:
                  drawLineItems.workCompletedThisPeriodCents,
                materialsPresentlyStoredCents:
                  drawLineItems.materialsPresentlyStoredCents,
                totalCompletedStoredToDateCents:
                  drawLineItems.totalCompletedStoredToDateCents,
                percentCompleteBasisPoints: drawLineItems.percentCompleteBasisPoints,
                balanceToFinishCents: drawLineItems.balanceToFinishCents,
                retainageCents: drawLineItems.retainageCents,
                retainagePercentApplied: drawLineItems.retainagePercentApplied,
                sortOrder: sovLineItems.sortOrder,
              })
              .from(drawLineItems)
              .innerJoin(
                sovLineItems,
                eq(sovLineItems.id, drawLineItems.sovLineItemId),
              )
              .where(inArray(drawLineItems.drawRequestId, clientDrawIds))
              .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber)),
          )
        : Promise.resolve([] as never[]),
      clientDrawIds.length
        ? // Client view — multi-org policy clause C (project membership)
          // returns waivers on this project including those from sub orgs.
          withTenant(context.organization.id, (tx) =>
            tx
              .select({
                id: lienWaivers.id,
                drawRequestId: lienWaivers.drawRequestId,
                organizationId: lienWaivers.organizationId,
                organizationName: organizations.name,
                lienWaiverType: lienWaivers.lienWaiverType,
                lienWaiverStatus: lienWaivers.lienWaiverStatus,
                amountCents: lienWaivers.amountCents,
                throughDate: lienWaivers.throughDate,
                documentId: lienWaivers.documentId,
                requestedAt: lienWaivers.requestedAt,
                submittedAt: lienWaivers.submittedAt,
                acceptedAt: lienWaivers.acceptedAt,
                createdAt: lienWaivers.createdAt,
              })
              .from(lienWaivers)
              .leftJoin(
                organizations,
                eq(organizations.id, lienWaivers.organizationId),
              )
              .where(inArray(lienWaivers.drawRequestId, clientDrawIds))
              .orderBy(
                asc(lienWaivers.lienWaiverType),
                desc(lienWaivers.createdAt),
              ),
          )
        : Promise.resolve([] as never[]),
      withTenant(context.organization.id, (tx) =>
        tx
          .select()
          .from(retainageReleases)
          .where(eq(retainageReleases.projectId, projectId))
          .orderBy(desc(retainageReleases.createdAt)),
      ),
    ]);

  const clientDrawLinesByDraw = new Map<string, typeof clientDrawLineRows>();
  for (const l of clientDrawLineRows) {
    const arr = clientDrawLinesByDraw.get(l.drawRequestId) ?? [];
    arr.push(l);
    clientDrawLinesByDraw.set(l.drawRequestId, arr);
  }

  const clientWaiversByDraw = new Map<string, LienWaiverRow[]>();
  for (const w of clientWaiverRows) {
    const row: LienWaiverRow = {
      id: w.id,
      drawRequestId: w.drawRequestId,
      organizationId: w.organizationId,
      organizationName: w.organizationName,
      lienWaiverType: w.lienWaiverType,
      lienWaiverStatus: w.lienWaiverStatus,
      amountCents: w.amountCents,
      throughDate: w.throughDate,
      documentId: w.documentId,
      requestedAt: w.requestedAt,
      submittedAt: w.submittedAt,
      acceptedAt: w.acceptedAt,
    };
    const arr = clientWaiversByDraw.get(w.drawRequestId) ?? [];
    arr.push(row);
    clientWaiversByDraw.set(w.drawRequestId, arr);
  }

  const clientDrawEnrichment = await loadDrawRequestEnrichment(
    clientDrawIds,
    context.organization.id,
  );

  const clientRetainageReleasesView: RetainageReleaseRow[] = clientReleaseRows.map(
    (r) => ({
      id: r.id,
      sovLineItemId: r.sovLineItemId,
      releaseStatus: r.releaseStatus,
      releaseAmountCents: r.releaseAmountCents,
      totalRetainageHeldCents: r.totalRetainageHeldCents,
      approvalNote: r.approvalNote,
      requestedAt: r.requestedAt,
      approvedAt: r.approvedAt,
      consumedByDrawRequestId: r.consumedByDrawRequestId,
      consumedAt: r.consumedAt,
      createdAt: r.createdAt,
    }),
  );

  const selections =
    context.role === "residential_client"
      ? await loadSelectionsForProject(projectId, {
          publishedOnly: true,
          callerOrgId: context.organization.id,
        })
      : [];
  const clientConversations = await loadConversationsForUser(
    projectId,
    context.user.id,
    context.organization.id,
  );
  const clientDocuments = await loadDocumentsForProject(
    projectId,
    "client",
    context.organization.id,
  );

  const PHOTO_DOC_TYPES = ["photo", "photo_log", "progress_photo"];
  const [activityRows, projectMetaRow, projectPhotos, messageRows] = await Promise.all([
    db
      .select({
        id: activityFeedItems.id,
        title: activityFeedItems.title,
        body: activityFeedItems.body,
        activityType: activityFeedItems.activityType,
        relatedObjectType: activityFeedItems.relatedObjectType,
        relatedObjectId: activityFeedItems.relatedObjectId,
        createdAt: activityFeedItems.createdAt,
        actorName: users.displayName,
      })
      .from(activityFeedItems)
      .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
      .where(eq(activityFeedItems.projectId, projectId))
      .orderBy(desc(activityFeedItems.createdAt))
      .limit(24),
    db
      .select({
        currentPhase: projects.currentPhase,
        contractorOrganizationId: projects.contractorOrganizationId,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
    withTenant(context.organization.id, (tx) =>
      tx
        .select({
          id: documents.id,
          title: documents.title,
          documentType: documents.documentType,
          storageKey: documents.storageKey,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(
          and(
            eq(documents.projectId, projectId),
            inArray(documents.documentType, PHOTO_DOC_TYPES),
            eq(documents.documentStatus, "active"),
          ),
        )
        .orderBy(desc(documents.createdAt))
        .limit(100),
    ),
    // Recent project messages to merge into the progress feed
    db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
        conversationId: conversations.id,
        conversationTitle: conversations.title,
        conversationType: conversations.conversationType,
        senderName: users.displayName,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .leftJoin(users, eq(users.id, messages.senderUserId))
      .where(eq(conversations.projectId, projectId))
      .orderBy(desc(messages.createdAt))
      .limit(24),
  ]);

  // Correlate photos to activity rows via document_links (primary match)
  const activityTargets = activityRows
    .filter(
      (a): a is typeof a & { relatedObjectId: string; relatedObjectType: string } =>
        a.relatedObjectId != null && a.relatedObjectType != null,
    )
    .map((a) => ({ id: a.relatedObjectId, type: a.relatedObjectType }));
  const photoIdSet = new Set(projectPhotos.map((p) => p.id));
  const docLinkRows =
    activityTargets.length > 0 && photoIdSet.size > 0
      ? await withTenant(context.organization.id, (tx) =>
          tx
            .select({
              documentId: documentLinks.documentId,
              linkedObjectId: documentLinks.linkedObjectId,
              linkedObjectType: documentLinks.linkedObjectType,
            })
            .from(documentLinks)
            .where(
              and(
                inArray(
                  documentLinks.documentId,
                  Array.from(photoIdSet),
                ),
                inArray(
                  documentLinks.linkedObjectId,
                  activityTargets.map((t) => t.id),
                ),
              ),
            ),
        )
      : ([] as Array<{
          documentId: string;
          linkedObjectId: string;
          linkedObjectType: string;
        }>);

  // Presign every photo in parallel so lightbox + thumbnails can show real
  // images. If presign fails for any row, the view falls back to the
  // gradient placeholder.
  const photoUrlById = new Map<string, string>();
  await Promise.all(
    projectPhotos.map(async (p) => {
      try {
        const url = await presignDownloadUrl({
          key: p.storageKey,
          expiresInSeconds: 60 * 10,
        });
        photoUrlById.set(p.id, url);
      } catch {
        // ignore — leave url null
      }
    }),
  );

  const photoById = new Map(projectPhotos.map((p) => [p.id, p]));
  const linkedPhotosByObject = new Map<string, string[]>();
  for (const link of docLinkRows) {
    const key = `${link.linkedObjectType}:${link.linkedObjectId}`;
    const arr = linkedPhotosByObject.get(key) ?? [];
    arr.push(link.documentId);
    linkedPhotosByObject.set(key, arr);
  }

  const currentPhase = projectMetaRow[0]?.currentPhase ?? "preconstruction";
  const contractorOrgId = projectMetaRow[0]?.contractorOrganizationId ?? null;
  const [contractorOrgRow] = contractorOrgId
    ? await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, contractorOrgId))
        .limit(1)
    : [];
  const contractorOrganizationName = contractorOrgRow?.name ?? null;

  // Build team contacts — includes contractor, subs, AND client members.
  // Client caller; multi-org PUM policy clause C (the caller's org has
  // an active POM on the project) lets them see every PUM on the
  // project alongside their own.
  const clientGcContactRows = await withTenant(context.organization.id, (tx) =>
    tx
      .select({
        id: users.id,
        displayName: users.displayName,
        roleKey: roleAssignments.roleKey,
      })
      .from(projectUserMemberships)
      .innerJoin(users, eq(users.id, projectUserMemberships.userId))
      .innerJoin(
        roleAssignments,
        and(
          eq(roleAssignments.userId, projectUserMemberships.userId),
          eq(roleAssignments.organizationId, projectUserMemberships.organizationId),
        ),
      )
      .where(
        and(
          eq(projectUserMemberships.projectId, projectId),
          eq(projectUserMemberships.membershipStatus, "active"),
        ),
      ),
  );

  const roleLabelMap: Record<string, string> = {
    project_manager: "Project Manager",
    superintendent: "Superintendent",
    owner: "Owner",
    admin: "Admin",
    estimator: "Estimator",
    foreman: "Foreman",
  };
  const clientGcSeen = new Set<string>();
  const clientGcContacts: SubProjectGcContact[] = [];
  for (const g of clientGcContactRows) {
    if (clientGcSeen.has(g.id)) continue;
    clientGcSeen.add(g.id);
    const name = g.displayName ?? "Team member";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "GC";
    clientGcContacts.push({
      id: g.id,
      name,
      roleLabel: roleLabelMap[g.roleKey] ?? g.roleKey.split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" "),
      initials,
    });
    if (clientGcContacts.length >= 6) break;
  }

  const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;
  const MAX_PHOTOS_PER_UPDATE = 8;

  const activityEventsFromFeed: ClientActivityEvent[] = activityRows.map((a) => {
    const linkKey =
      a.relatedObjectType && a.relatedObjectId
        ? `${a.relatedObjectType}:${a.relatedObjectId}`
        : null;
    const primaryIds = linkKey ? (linkedPhotosByObject.get(linkKey) ?? []) : [];
    const primary = primaryIds
      .map((id) => photoById.get(id))
      .filter((p): p is (typeof projectPhotos)[number] => p != null);

    let fallback: typeof primary = [];
    if (primary.length === 0) {
      const activityTime = a.createdAt.getTime();
      fallback = projectPhotos.filter((p) => {
        const diff = Math.abs(p.createdAt.getTime() - activityTime);
        return diff <= FALLBACK_WINDOW_MS;
      });
    }
    const merged = (primary.length > 0 ? primary : fallback).slice(
      0,
      MAX_PHOTOS_PER_UPDATE,
    );

    return {
      id: a.id,
      title: a.title,
      body: a.body,
      activityType: a.activityType,
      relatedObjectType: a.relatedObjectType,
      relatedObjectId: a.relatedObjectId,
      actorName: a.actorName,
      createdAt: a.createdAt,
      photoAttachments: merged.map((p) => ({
        id: p.id,
        title: p.title,
        documentType: p.documentType,
        createdAt: p.createdAt,
        url: photoUrlById.get(p.id) ?? null,
      })),
    };
  });

  // Map recent project messages into the same ClientActivityEvent shape so
  // the progress feed surfaces direct conversations alongside feed items.
  const activityEventsFromMessages: ClientActivityEvent[] = messageRows.map(
    (m) => {
      const convoLabel =
        m.conversationTitle ??
        (m.conversationType === "project_general"
          ? "project thread"
          : m.conversationType.replace(/_/g, " "));
      const bodyPreview =
        m.body.length > 240 ? `${m.body.slice(0, 237)}…` : m.body;
      return {
        id: `msg-${m.id}`,
        title: `New message in ${convoLabel}`,
        body: bodyPreview,
        activityType: "message_posted",
        relatedObjectType: "conversation",
        relatedObjectId: m.conversationId,
        actorName: m.senderName,
        createdAt: m.createdAt,
        photoAttachments: [],
      };
    },
  );

  const activityTrail: ClientActivityEvent[] = [
    ...activityEventsFromFeed,
    ...activityEventsFromMessages,
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 24);

  // Rolling 7-day metrics for the "top card" on the progress page
  const nowMs = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const windowStart = nowMs - SEVEN_DAYS_MS;
  const milestonesCompletedLast7d = milestoneRows.filter(
    (m) =>
      m.milestoneStatus === "completed" &&
      new Date(m.scheduledDate).getTime() >= windowStart,
  ).length;
  const photosAddedLast7d = projectPhotos.filter(
    (p) => p.createdAt.getTime() >= windowStart,
  ).length;
  const anyAtRisk = milestoneRows.some(
    (m) =>
      (m.milestoneStatus === "missed" || m.milestoneStatus === "scheduled") &&
      new Date(m.scheduledDate).getTime() < nowMs,
  );
  const progressMetrics: ClientProgressMetrics = {
    milestonesCompletedLast7d,
    photosAddedLast7d,
    scheduleStatus: anyAtRisk ? "at_risk" : "on_track",
  };

  const phasePercentByPhase: Record<string, number> = {};
  const phaseGroups = new Map<string, { total: number; completed: number }>();
  for (const m of milestoneRows) {
    const phaseKey = m.phase ?? "unspecified";
    const g = phaseGroups.get(phaseKey) ?? { total: 0, completed: 0 };
    g.total += 1;
    if (m.milestoneStatus === "completed") g.completed += 1;
    phaseGroups.set(phaseKey, g);
  }
  for (const [phaseKey, g] of phaseGroups.entries()) {
    phasePercentByPhase[phaseKey] =
      g.total === 0 ? 0 : Math.round((g.completed / g.total) * 100);
  }

  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    selections,
    conversations: clientConversations,
    documents: clientDocuments,
    milestones: milestoneRows.map(
      ({ visibilityScope: _v, phase: _p, ...rest }) => rest,
    ),
    activityTrail,
    progressMetrics,
    phasePercentByPhase,
    currentPhase,
    contractorOrganizationName,
    gcContacts: clientGcContacts,
    decisions: coRows,
    openRequests: rfiRows,
    approvals: approvalRows,
    retainageReleases: clientRetainageReleasesView,
    drawRequests: drawRows.map((d) => ({
      id: d.id,
      drawNumber: d.drawNumber,
      drawRequestStatus: d.drawRequestStatus,
      periodFrom: d.periodFrom,
      periodTo: d.periodTo,
      originalContractSumCents: d.originalContractSumCents,
      netChangeOrdersCents: d.netChangeOrdersCents,
      contractSumToDateCents: d.contractSumToDateCents,
      totalCompletedToDateCents: d.totalCompletedToDateCents,
      totalRetainageCents: d.totalRetainageCents,
      totalEarnedLessRetainageCents: d.totalEarnedLessRetainageCents,
      previousCertificatesCents: d.previousCertificatesCents,
      currentPaymentDueCents: d.currentPaymentDueCents,
      balanceToFinishCents: d.balanceToFinishCents,
      submittedAt: d.submittedAt,
      reviewedAt: d.reviewedAt,
      reviewNote: d.reviewNote,
      returnedAt: d.returnedAt,
      returnReason: d.returnReason,
      paidAt: d.paidAt,
      paymentReferenceName: d.paymentReferenceName,
      receiptPaymentTransactionId:
        clientDrawEnrichment.receiptPaymentIdByDrawId.get(d.id) ?? null,
      retainageReleasedCents: d.retainageReleasedCents,
      lienWaivers: clientWaiversByDraw.get(d.id) ?? [],
      lineItems: (clientDrawLinesByDraw.get(d.id) ?? []).map((l) => ({
        id: l.id,
        itemNumber: l.itemNumber,
        description: l.description,
        scheduledValueCents: l.scheduledValueCents,
        workCompletedPreviousCents: l.workCompletedPreviousCents,
        workCompletedThisPeriodCents: l.workCompletedThisPeriodCents,
        materialsPresentlyStoredCents: l.materialsPresentlyStoredCents,
        totalCompletedStoredToDateCents: l.totalCompletedStoredToDateCents,
        percentCompleteBasisPoints: l.percentCompleteBasisPoints,
        balanceToFinishCents: l.balanceToFinishCents,
        retainageCents: l.retainageCents,
        retainagePercentApplied: l.retainagePercentApplied,
      })),
      supportingFiles: clientDrawEnrichment.filesById.get(d.id) ?? [],
      activityTrail: clientDrawEnrichment.activityById.get(d.id) ?? [],
    })),
  };
}
