import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  changeOrders,
  conversationParticipants,
  conversations,
  documents,
  organizations,
  projects,
  rfis,
  roleAssignments,
  users,
} from "@/db/schema";

import { getAccessibleProjects } from "./portals";

// Global command-palette search.
//
// Scope per portal mirrors the project-access rules plus a few
// additional safety fences:
//
//   - Documents: accessible projects AND audience_scope compatible
//     with the reader's portal AND visibility_scope not blocking them.
//   - Messages: only conversations the user is a participant in.
//     Body-content search is deferred until a pg_trgm GIN index lands;
//     V1 matches conversation title + last_message_preview only.
//   - People: clients never see subs; subs never see other subs. All
//     three non-contractor portals see the contractor PMs/admins on
//     their accessible projects. Contractor sees all team members and
//     every user holding a role on any accessible project.
//
// Performance: each category runs one query limited to RESULTS_PER_GROUP.
// Ranking: ILIKE substring match is the filter; prefix matches (starts_with)
// sort ahead of mid-string matches. No fuzzy/trigram for V1.
//
// TODO(perf): add `pg_trgm` GIN indexes on conversations.last_message_preview
// and messages.body_text when scaling past portfolio volumes.

export type SearchPortal =
  | "contractor"
  | "subcontractor"
  | "commercial"
  | "residential";

export type SearchResultGroups = {
  projects: Array<{
    id: string;
    name: string;
    phase: string | null;
    href: string;
  }>;
  rfis: Array<{
    id: string;
    number: number;
    subject: string;
    projectName: string;
    projectId: string;
    href: string;
  }>;
  changeOrders: Array<{
    id: string;
    number: number;
    title: string;
    projectName: string;
    projectId: string;
    href: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    documentType: string;
    projectName: string;
    projectId: string;
    href: string;
  }>;
  messages: Array<{
    id: string; // conversation id
    title: string;
    preview: string | null;
    projectName: string;
    projectId: string;
    href: string;
  }>;
  people: Array<{
    id: string; // userId
    name: string;
    email: string;
    title: string | null;
    orgName: string | null;
  }>;
};

export type GlobalSearchInput = {
  appUserId: string;
  portalType: SearchPortal;
  query: string;
};

const RESULTS_PER_GROUP = 5;
const MIN_QUERY_LENGTH = 2;

function emptyGroups(): SearchResultGroups {
  return {
    projects: [],
    rfis: [],
    changeOrders: [],
    documents: [],
    messages: [],
    people: [],
  };
}

type AudienceScope =
  | "internal"
  | "contractor"
  | "subcontractor"
  | "client"
  | "commercial_client"
  | "residential_client"
  | "mixed";

// Which `documents.audience_scope` values this portal is allowed to
// read. Contractors read everything; subs read their own + mixed +
// (contractor-published if visibility_scope permits); clients see
// their subtype + generic "client" + mixed.
function allowedAudiencesFor(portal: SearchPortal): AudienceScope[] {
  if (portal === "contractor") {
    return [
      "internal",
      "contractor",
      "subcontractor",
      "client",
      "commercial_client",
      "residential_client",
      "mixed",
    ];
  }
  if (portal === "subcontractor") {
    return ["subcontractor", "mixed"];
  }
  if (portal === "commercial") {
    return ["client", "commercial_client", "mixed"];
  }
  return ["client", "residential_client", "mixed"];
}

// Visibility scopes that are NEVER legal for this portal — e.g. a
// client should never see `internal_only` or `subcontractor_scoped`
// docs even if the audience_scope looks compatible.
function forbiddenVisibilityFor(portal: SearchPortal): string[] {
  if (portal === "contractor") return [];
  if (portal === "subcontractor") return ["internal_only", "client_visible"];
  return ["internal_only", "subcontractor_scoped"];
}

// Build the portal-specific project URL base.
function projectBase(portal: SearchPortal, projectId: string): string {
  return `/${portal}/project/${projectId}`;
}

// Change-order detail lives under /change-orders on contractor/commercial/
// sub portals but under /scope-changes on residential — the vocabulary
// rule from CLAUDE.md.
function changeOrderHref(portal: SearchPortal, projectId: string): string {
  const base = projectBase(portal, projectId);
  return portal === "residential" ? `${base}/scope-changes` : `${base}/change-orders`;
}

export async function getGlobalSearchResults(
  input: GlobalSearchInput,
): Promise<SearchResultGroups> {
  const q = input.query.trim();
  if (q.length < MIN_QUERY_LENGTH) return emptyGroups();

  const accessible = await getAccessibleProjects(
    input.appUserId,
    input.portalType,
  );
  if (accessible.length === 0) return emptyGroups();
  const projectIds = accessible.map((p) => p.projectId);
  const projectNameById = new Map(
    accessible.map((p) => [p.projectId, p.projectName]),
  );

  // ILIKE uses `%q%` for the match; Postgres escapes nothing special
  // inside the parameter, and we don't treat q as a regex, so a `%`
  // or `_` inside the user's query reads literally — acceptable.
  const like = `%${q}%`;
  const prefix = `${q}%`;

  const [
    projectRows,
    rfiRows,
    coRows,
    documentRows,
    messageRows,
    peopleRows,
  ] = await Promise.all([
    searchProjects(projectIds, like, prefix),
    searchRfis(projectIds, like, prefix),
    searchChangeOrders(projectIds, like, prefix),
    searchDocuments(projectIds, input.portalType, like, prefix),
    searchMessages(input.appUserId, projectIds, like, prefix),
    searchPeople(input.appUserId, input.portalType, projectIds, like, prefix),
  ]);

  return {
    projects: projectRows.map((r) => ({
      id: r.id,
      name: r.name,
      phase: r.currentPhase ?? null,
      href: projectBase(input.portalType, r.id),
    })),
    rfis: rfiRows.map((r) => ({
      id: r.id,
      number: r.sequentialNumber,
      subject: r.subject,
      projectId: r.projectId,
      projectName: projectNameById.get(r.projectId) ?? "Project",
      href: `${projectBase(input.portalType, r.projectId)}/rfis`,
    })),
    changeOrders: coRows.map((r) => ({
      id: r.id,
      number: r.changeOrderNumber,
      title: r.title,
      projectId: r.projectId,
      projectName: projectNameById.get(r.projectId) ?? "Project",
      href: changeOrderHref(input.portalType, r.projectId),
    })),
    documents: documentRows.map((r) => ({
      id: r.id,
      title: r.title,
      documentType: r.documentType,
      projectId: r.projectId,
      projectName: projectNameById.get(r.projectId) ?? "Project",
      href: `${projectBase(input.portalType, r.projectId)}/documents`,
    })),
    messages: messageRows.map((r) => ({
      id: r.id,
      title: r.title ?? "Conversation",
      preview: r.lastMessagePreview,
      projectId: r.projectId,
      projectName: projectNameById.get(r.projectId) ?? "Project",
      href: `${projectBase(input.portalType, r.projectId)}/messages`,
    })),
    people: peopleRows,
  };
}

async function searchProjects(
  projectIds: string[],
  like: string,
  prefix: string,
) {
  if (projectIds.length === 0) return [];
  return db
    .select({
      id: projects.id,
      name: projects.name,
      currentPhase: projects.currentPhase,
    })
    .from(projects)
    .where(and(inArray(projects.id, projectIds), ilike(projects.name, like)))
    .orderBy(
      // Prefix matches first, then alphabetical.
      sql`CASE WHEN ${projects.name} ILIKE ${prefix} THEN 0 ELSE 1 END`,
      asc(projects.name),
    )
    .limit(RESULTS_PER_GROUP);
}

async function searchRfis(
  projectIds: string[],
  like: string,
  prefix: string,
) {
  if (projectIds.length === 0) return [];
  return db
    .select({
      id: rfis.id,
      projectId: rfis.projectId,
      sequentialNumber: rfis.sequentialNumber,
      subject: rfis.subject,
    })
    .from(rfis)
    .where(
      and(
        inArray(rfis.projectId, projectIds),
        or(ilike(rfis.subject, like), ilike(rfis.body, like)),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${rfis.subject} ILIKE ${prefix} THEN 0 ELSE 1 END`,
      desc(rfis.createdAt),
    )
    .limit(RESULTS_PER_GROUP);
}

async function searchChangeOrders(
  projectIds: string[],
  like: string,
  prefix: string,
) {
  if (projectIds.length === 0) return [];
  return db
    .select({
      id: changeOrders.id,
      projectId: changeOrders.projectId,
      changeOrderNumber: changeOrders.changeOrderNumber,
      title: changeOrders.title,
    })
    .from(changeOrders)
    .where(
      and(
        inArray(changeOrders.projectId, projectIds),
        or(
          ilike(changeOrders.title, like),
          ilike(changeOrders.description, like),
        ),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${changeOrders.title} ILIKE ${prefix} THEN 0 ELSE 1 END`,
      desc(changeOrders.createdAt),
    )
    .limit(RESULTS_PER_GROUP);
}

async function searchDocuments(
  projectIds: string[],
  portal: SearchPortal,
  like: string,
  prefix: string,
) {
  if (projectIds.length === 0) return [];
  const audiences = allowedAudiencesFor(portal);
  const forbiddenVis = forbiddenVisibilityFor(portal);

  const whereClauses = [
    inArray(documents.projectId, projectIds),
    eq(documents.documentStatus, "active"),
    ilike(documents.title, like),
    inArray(documents.audienceScope, audiences),
  ];
  if (forbiddenVis.length > 0) {
    // `notInArray` via raw SQL — drizzle's helpers exist but the
    // audience/visibility lookups are narrow enough to spell out.
    whereClauses.push(
      sql`${documents.visibilityScope}::text NOT IN (${sql.join(
        forbiddenVis.map((v) => sql`${v}`),
        sql`, `,
      )})`,
    );
  }
  return db
    .select({
      id: documents.id,
      projectId: documents.projectId,
      title: documents.title,
      documentType: documents.documentType,
    })
    .from(documents)
    .where(and(...whereClauses))
    .orderBy(
      sql`CASE WHEN ${documents.title} ILIKE ${prefix} THEN 0 ELSE 1 END`,
      desc(documents.createdAt),
    )
    .limit(RESULTS_PER_GROUP);
}

async function searchMessages(
  appUserId: string,
  projectIds: string[],
  like: string,
  prefix: string,
) {
  if (projectIds.length === 0) return [];
  // Scope: the user must be a participant in the conversation. This
  // prevents a palette-level scope leak (e.g., a residential client
  // searching "lawsuit" and hitting contractor-internal threads).
  return db
    .selectDistinct({
      id: conversations.id,
      projectId: conversations.projectId,
      title: conversations.title,
      lastMessagePreview: conversations.lastMessagePreview,
      lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .innerJoin(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, conversations.id),
        eq(conversationParticipants.userId, appUserId),
      ),
    )
    .where(
      and(
        inArray(conversations.projectId, projectIds),
        or(
          ilike(conversations.title, like),
          ilike(conversations.lastMessagePreview, like),
        ),
      ),
    )
    .orderBy(
      sql`CASE WHEN COALESCE(${conversations.title}, '') ILIKE ${prefix} THEN 0 ELSE 1 END`,
      desc(conversations.lastMessageAt),
    )
    .limit(RESULTS_PER_GROUP);
}

async function searchPeople(
  appUserId: string,
  portal: SearchPortal,
  projectIds: string[],
  like: string,
  prefix: string,
) {
  if (projectIds.length === 0) return [];

  // Which portal-types of peers this portal can see:
  //   contractor  — sees everyone on accessible projects
  //   subcontractor — sees own org + contractor staff on their projects
  //                   (NOT other subs, NOT clients)
  //   client      — sees own org + contractor staff on their projects
  //                   (NOT subs, NOT other clients)
  const visiblePortalTypes: Array<"contractor" | "subcontractor" | "client"> =
    portal === "contractor"
      ? ["contractor", "subcontractor", "client"]
      : ["contractor"];

  // The user's own org — added unconditionally so the caller sees their
  // teammates regardless of portal.
  const [ownAssignment] = await db
    .select({
      organizationId: roleAssignments.organizationId,
      portalType: roleAssignments.portalType,
    })
    .from(roleAssignments)
    .where(
      and(
        eq(roleAssignments.userId, appUserId),
        eq(
          roleAssignments.portalType,
          portal === "contractor"
            ? "contractor"
            : portal === "subcontractor"
              ? "subcontractor"
              : "client",
        ),
      ),
    )
    .limit(1);

  // Contractor organizations that own the caller's accessible projects.
  // Non-contractor portals use these to expose contractor PMs.
  const contractorOrgs = await db
    .select({ contractorOrganizationId: projects.contractorOrganizationId })
    .from(projects)
    .where(inArray(projects.id, projectIds));
  const contractorOrgIds = Array.from(
    new Set(contractorOrgs.map((r) => r.contractorOrganizationId)),
  );

  const orgIds: string[] = [];
  if (ownAssignment) orgIds.push(ownAssignment.organizationId);
  for (const id of contractorOrgIds) orgIds.push(id);
  const uniqueOrgIds = Array.from(new Set(orgIds));

  if (uniqueOrgIds.length === 0) return [];

  const rows = await db
    .selectDistinct({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      title: users.title,
      orgName: organizations.name,
      portalType: roleAssignments.portalType,
    })
    .from(users)
    .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
    .innerJoin(
      organizations,
      eq(organizations.id, roleAssignments.organizationId),
    )
    .where(
      and(
        inArray(roleAssignments.organizationId, uniqueOrgIds),
        inArray(roleAssignments.portalType, visiblePortalTypes),
        eq(users.isActive, true),
        or(
          ilike(users.displayName, like),
          ilike(users.email, like),
          sql`COALESCE(${users.title}, '') ILIKE ${like}`,
        ),
      ),
    )
    .orderBy(
      sql`CASE WHEN COALESCE(${users.displayName}, ${users.email}) ILIKE ${prefix} THEN 0 ELSE 1 END`,
      asc(users.displayName),
    )
    .limit(RESULTS_PER_GROUP);

  return rows.map((r) => ({
    id: r.id,
    name: r.displayName ?? r.email,
    email: r.email,
    title: r.title,
    orgName: r.orgName,
  }));
}
