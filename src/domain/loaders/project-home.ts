import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
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
  opts: { assignedToOrganizationId?: string } = {},
): Promise<RfiRow[]> {
  const whereClause = opts.assignedToOrganizationId
    ? and(
        eq(rfis.projectId, projectId),
        eq(rfis.assignedToOrganizationId, opts.assignedToOrganizationId),
      )
    : eq(rfis.projectId, projectId);

  const rfiRows = await db
    .select({
      id: rfis.id,
      sequentialNumber: rfis.sequentialNumber,
      subject: rfis.subject,
      body: rfis.body,
      rfiStatus: rfis.rfiStatus,
      assignedToOrganizationId: rfis.assignedToOrganizationId,
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
    .where(whereClause)
    .orderBy(desc(rfis.createdAt));

  if (rfiRows.length === 0) return [];

  const ids = rfiRows.map((r) => r.id);
  const responseRows = await db
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
    .orderBy(asc(rfiResponses.createdAt));

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

  return rfiRows.map((r) => ({ ...r, responses: grouped.get(r.id) ?? [] }));
}

export type RfiResponseRow = {
  id: string;
  body: string;
  respondedByUserId: string;
  respondedByName: string | null;
  isOfficialResponse: boolean;
  createdAt: Date;
};

export type RfiRow = {
  id: string;
  sequentialNumber: number;
  subject: string;
  body: string | null;
  rfiStatus: string;
  assignedToOrganizationId: string | null;
  assignedToUserId: string | null;
  dueAt: Date | null;
  respondedAt: Date | null;
  closedAt: Date | null;
  drawingReference: string | null;
  specificationReference: string | null;
  locationDescription: string | null;
  createdAt: Date;
  responses: RfiResponseRow[];
};

export type LienWaiverRow = {
  id: string;
  drawRequestId: string;
  organizationId: string;
  lienWaiverType: "conditional_progress" | "unconditional_progress" | "conditional_final" | "unconditional_final";
  lienWaiverStatus: "requested" | "submitted" | "accepted" | "rejected" | "waived";
  amountCents: number;
  throughDate: Date | null;
  documentId: string | null;
  requestedAt: Date | null;
  submittedAt: Date | null;
  acceptedAt: Date | null;
};

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

async function loadSelectionsForProject(
  projectId: string,
  opts: { publishedOnly?: boolean } = {},
): Promise<SelectionCategoryRow[]> {
  const categoryRows = await db
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

  const itemWhere = opts.publishedOnly
    ? and(
        eq(selectionItems.projectId, projectId),
        eq(selectionItems.isPublished, true),
      )
    : eq(selectionItems.projectId, projectId);

  const itemRows = await db
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
    db
      .select()
      .from(selectionOptions)
      .where(inArray(selectionOptions.selectionItemId, itemIds))
      .orderBy(asc(selectionOptions.sortOrder), asc(selectionOptions.createdAt)),
    db
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
async function loadConversationsForUser(
  projectId: string,
  userId: string,
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
    db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderUserId: messages.senderUserId,
        senderName: users.displayName,
        body: messages.body,
        attachedDocumentId: messages.attachedDocumentId,
        isSystemMessage: messages.isSystemMessage,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderUserId))
      .where(inArray(messages.conversationId, conversationIds))
      .orderBy(asc(messages.createdAt)),
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

export type DocumentRow = {
  id: string;
  projectId: string;
  documentType: string;
  title: string;
  storageKey: string;
  uploadedByUserId: string;
  uploadedByName: string | null;
  visibilityScope: string;
  audienceScope: string;
  documentStatus: "active" | "pending_review" | "superseded" | "archived";
  isSuperseded: boolean;
  supersededByDocumentId: string | null;
  links: DocumentLinkRow[];
  createdAt: Date;
  updatedAt: Date;
};

type DocumentAudience = "contractor" | "subcontractor" | "client";

// Role-scoped read of every document on a project. Contractor sees all
// non-archived rows; subs are blocked from client-only / internal-only
// content; clients get only project-wide or explicitly client-visible
// material. Supersession is resolved via document_links rows carrying
// link_role='supersedes' (schema rule: don't add a column for this).
async function loadDocumentsForProject(
  projectId: string,
  audience: DocumentAudience,
): Promise<DocumentRow[]> {
  const rows = await db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      documentType: documents.documentType,
      title: documents.title,
      storageKey: documents.storageKey,
      uploadedByUserId: documents.uploadedByUserId,
      uploadedByName: users.displayName,
      visibilityScope: documents.visibilityScope,
      audienceScope: documents.audienceScope,
      documentStatus: documents.documentStatus,
      isSuperseded: documents.isSuperseded,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.uploadedByUserId))
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.createdAt));

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
  const linkRows = await db
    .select({
      documentId: documentLinks.documentId,
      linkedObjectType: documentLinks.linkedObjectType,
      linkedObjectId: documentLinks.linkedObjectId,
      linkRole: documentLinks.linkRole,
    })
    .from(documentLinks)
    .where(inArray(documentLinks.documentId, ids));

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

  // Superseded-by lookup: a newer document carries a document_links row
  // with (linkedObjectType='document', linkedObjectId=<oldId>, linkRole='supersedes').
  const supersedesRows = await db
    .select({
      newDocumentId: documentLinks.documentId,
      oldDocumentId: documentLinks.linkedObjectId,
    })
    .from(documentLinks)
    .where(
      and(
        eq(documentLinks.linkedObjectType, "document"),
        eq(documentLinks.linkRole, "supersedes"),
        inArray(documentLinks.linkedObjectId, ids),
      ),
    );
  const supersededByMap = new Map<string, string>();
  for (const s of supersedesRows) {
    supersededByMap.set(s.oldDocumentId, s.newDocumentId);
  }

  return filtered.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    documentType: r.documentType,
    title: r.title,
    storageKey: r.storageKey,
    uploadedByUserId: r.uploadedByUserId,
    uploadedByName: r.uploadedByName,
    visibilityScope: r.visibilityScope,
    audienceScope: r.audienceScope,
    documentStatus: r.documentStatus,
    isSuperseded: r.isSuperseded,
    supersededByDocumentId: supersededByMap.get(r.id) ?? null,
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
  }>;
  retainageReleases: RetainageReleaseRow[];
  uploadRequests: Array<{
    id: string;
    title: string;
    requestStatus: string;
    requestedFromOrganizationId: string | null;
    expectedFileType: string | null;
    dueAt: Date | null;
    submittedDocumentId: string | null;
  }>;
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
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        milestoneStatus: milestones.milestoneStatus,
        scheduledDate: milestones.scheduledDate,
      })
      .from(milestones)
      .where(eq(milestones.projectId, projectId))
      .orderBy(milestones.scheduledDate),
    loadRfisWithResponses(projectId),
    db
      .select({
        id: changeOrders.id,
        title: changeOrders.title,
        changeOrderStatus: changeOrders.changeOrderStatus,
      })
      .from(changeOrders)
      .where(eq(changeOrders.projectId, projectId))
      .orderBy(desc(changeOrders.createdAt)),
    db
      .select()
      .from(drawRequests)
      .where(eq(drawRequests.projectId, projectId))
      .orderBy(desc(drawRequests.drawNumber)),
    db
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
    db
      .select({
        id: uploadRequests.id,
        title: uploadRequests.title,
        requestStatus: uploadRequests.requestStatus,
        requestedFromOrganizationId: uploadRequests.requestedFromOrganizationId,
        expectedFileType: uploadRequests.expectedFileType,
        dueAt: uploadRequests.dueAt,
        submittedDocumentId: uploadRequests.submittedDocumentId,
      })
      .from(uploadRequests)
      .where(eq(uploadRequests.projectId, projectId))
      .orderBy(desc(uploadRequests.createdAt)),
    db
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
    db
      .select({
        id: complianceRecords.id,
        organizationId: complianceRecords.organizationId,
        organizationName: organizations.name,
        complianceType: complianceRecords.complianceType,
        complianceStatus: complianceRecords.complianceStatus,
        expiresAt: complianceRecords.expiresAt,
        documentId: complianceRecords.documentId,
      })
      .from(complianceRecords)
      .leftJoin(organizations, eq(organizations.id, complianceRecords.organizationId))
      .where(eq(complianceRecords.projectId, projectId))
      .orderBy(desc(complianceRecords.createdAt)),
    db
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
  ]);

  const drawIds = drawRows.map((d) => d.id);
  const [drawLineItemRows, waiverRows, releaseRows] = await Promise.all([
    drawIds.length
      ? db
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
          .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber))
      : Promise.resolve([] as never[]),
    drawIds.length
      ? db
          .select()
          .from(lienWaivers)
          .where(inArray(lienWaivers.drawRequestId, drawIds))
          .orderBy(asc(lienWaivers.lienWaiverType), desc(lienWaivers.createdAt))
      : Promise.resolve([] as never[]),
    db
      .select()
      .from(retainageReleases)
      .where(eq(retainageReleases.projectId, projectId))
      .orderBy(desc(retainageReleases.createdAt)),
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
  }));

  const selections = await loadSelectionsForProject(projectId);
  const conversationList = await loadConversationsForUser(projectId, context.user.id);
  const documentList = await loadDocumentsForProject(projectId, "contractor");

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

  const [clientOrgRow] = await db
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
    .limit(1);

  const sovRow = sovRows[0] ?? null;
  const sovLineItemRows = sovRow
    ? await db
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
        .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber))
    : [];

  return {
    context,
    project: context.project,
    teamCount: teamRows.length,
    milestones: milestoneRows,
    rfis: rfiRows,
    changeOrders: coRows,
    drawRequests: drawRequestsView,
    retainageReleases: retainageReleasesView,
    uploadRequests: uploadRequestRows,
    approvals: approvalRows,
    complianceRecords: complianceRows,
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
  complianceRecords: Array<{
    id: string;
    complianceType: string;
    complianceStatus: string;
    expiresAt: Date | null;
    documentId: string | null;
  }>;
  conversations: ConversationRow[];
  documents: DocumentRow[];
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

  const [rfiRows, coRows, milestoneRows, pendingRows, complianceRows] = await Promise.all([
    loadRfisWithResponses(projectId, { assignedToOrganizationId: subOrgId }),
    db
      .select({
        id: changeOrders.id,
        title: changeOrders.title,
        changeOrderStatus: changeOrders.changeOrderStatus,
      })
      .from(changeOrders)
      .where(eq(changeOrders.projectId, projectId))
      .orderBy(desc(changeOrders.createdAt)),
    db
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
    db
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
    db
      .select({
        id: complianceRecords.id,
        complianceType: complianceRecords.complianceType,
        complianceStatus: complianceRecords.complianceStatus,
        expiresAt: complianceRecords.expiresAt,
        documentId: complianceRecords.documentId,
      })
      .from(complianceRecords)
      .where(
        and(
          eq(complianceRecords.projectId, projectId),
          eq(complianceRecords.organizationId, subOrgId),
        ),
      )
      .orderBy(desc(complianceRecords.createdAt)),
  ]);

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
    complianceRecords: complianceRows,
    conversations: await loadConversationsForUser(projectId, context.user.id),
    documents: await loadDocumentsForProject(projectId, "subcontractor"),
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
  }>;
  retainageReleases: RetainageReleaseRow[];
  selections: SelectionCategoryRow[];
  conversations: ConversationRow[];
  documents: DocumentRow[];
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
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        milestoneStatus: milestones.milestoneStatus,
        scheduledDate: milestones.scheduledDate,
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
    db
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
    db
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
    db
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
    db
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
  ]);

  const clientDrawIds = drawRows.map((d) => d.id);
  const [clientDrawLineRows, clientWaiverRows, clientReleaseRows] =
    await Promise.all([
      clientDrawIds.length
        ? db
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
            .orderBy(asc(sovLineItems.sortOrder), asc(sovLineItems.itemNumber))
        : Promise.resolve([] as never[]),
      clientDrawIds.length
        ? db
            .select()
            .from(lienWaivers)
            .where(inArray(lienWaivers.drawRequestId, clientDrawIds))
            .orderBy(
              asc(lienWaivers.lienWaiverType),
              desc(lienWaivers.createdAt),
            )
        : Promise.resolve([] as never[]),
      db
        .select()
        .from(retainageReleases)
        .where(eq(retainageReleases.projectId, projectId))
        .orderBy(desc(retainageReleases.createdAt)),
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
      ? await loadSelectionsForProject(projectId, { publishedOnly: true })
      : [];
  const clientConversations = await loadConversationsForUser(
    projectId,
    context.user.id,
  );
  const clientDocuments = await loadDocumentsForProject(projectId, "client");

  return {
    context,
    project: context.project,
    isResidential: context.role === "residential_client",
    selections,
    conversations: clientConversations,
    documents: clientDocuments,
    milestones: milestoneRows.map(({ visibilityScope: _v, ...rest }) => rest),
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
    })),
  };
}
