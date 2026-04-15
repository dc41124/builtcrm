import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  organizationUsers,
  organizations,
  projectOrganizationMemberships,
  projectUserMemberships,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type EffectiveRole,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

import {
  loadConversationsForUser,
  type ConversationRow,
} from "./project-home";

export type MessagesViewPortal =
  | "contractor"
  | "subcontractor"
  | "commercial"
  | "residential";

export type MessagesParticipantOption = {
  userId: string;
  displayName: string;
  organizationName: string | null;
};

export type MessagesView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  portal: MessagesViewPortal;
  currentUserId: string;
  conversations: ConversationRow[];
  participantOptions: MessagesParticipantOption[];
};

type LoaderInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

const ROLE_TO_PORTAL: Record<EffectiveRole, MessagesViewPortal> = {
  contractor_admin: "contractor",
  contractor_pm: "contractor",
  subcontractor_user: "subcontractor",
  commercial_client: "commercial",
  residential_client: "residential",
};

export async function getMessagesView(
  input: LoaderInput,
  expected: MessagesViewPortal,
): Promise<MessagesView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  const actual = ROLE_TO_PORTAL[context.role];
  if (actual !== expected) {
    throw new AuthorizationError(
      `Messages view for ${expected} requires a matching role`,
      "forbidden",
    );
  }

  const conversations = await loadConversationsForUser(
    context.project.id,
    context.user.id,
  );

  // Participant picker options: only contractors create conversations, and
  // only they need the full member list. Other portals surface read-only
  // composers that post into existing threads with the contractor team.
  let participantOptions: MessagesParticipantOption[] = [];
  if (expected === "contractor") {
    const projectUserRows = await db
      .select({
        userId: projectUserMemberships.userId,
        displayName: users.displayName,
        email: users.email,
        organizationName: organizations.name,
      })
      .from(projectUserMemberships)
      .innerJoin(users, eq(users.id, projectUserMemberships.userId))
      .leftJoin(
        organizationUsers,
        eq(organizationUsers.userId, projectUserMemberships.userId),
      )
      .leftJoin(
        organizations,
        eq(organizations.id, organizationUsers.organizationId),
      )
      .where(
        and(
          eq(projectUserMemberships.projectId, context.project.id),
          eq(projectUserMemberships.membershipStatus, "active"),
          eq(projectUserMemberships.accessState, "active"),
        ),
      );

    const contractorOrgRows = await db
      .select({
        userId: organizationUsers.userId,
        displayName: users.displayName,
        email: users.email,
        organizationName: organizations.name,
      })
      .from(organizationUsers)
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .innerJoin(
        organizations,
        eq(organizations.id, organizationUsers.organizationId),
      )
      .where(
        and(
          eq(
            organizationUsers.organizationId,
            context.project.contractorOrganizationId,
          ),
          eq(organizationUsers.membershipStatus, "active"),
        ),
      );

    const clientOrgUserRows = await db
      .select({
        userId: organizationUsers.userId,
        displayName: users.displayName,
        email: users.email,
        organizationName: organizations.name,
      })
      .from(projectOrganizationMemberships)
      .innerJoin(
        organizationUsers,
        eq(
          organizationUsers.organizationId,
          projectOrganizationMemberships.organizationId,
        ),
      )
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .innerJoin(
        organizations,
        eq(organizations.id, organizationUsers.organizationId),
      )
      .where(
        and(
          eq(projectOrganizationMemberships.projectId, context.project.id),
          inArray(projectOrganizationMemberships.membershipType, [
            "client",
            "subcontractor",
          ]),
        ),
      );

    const seen = new Map<string, MessagesParticipantOption>();
    const merge = (rows: typeof projectUserRows) => {
      for (const row of rows) {
        if (row.userId === context.user.id) continue;
        if (seen.has(row.userId)) continue;
        seen.set(row.userId, {
          userId: row.userId,
          displayName: row.displayName ?? row.email,
          organizationName: row.organizationName ?? null,
        });
      }
    };
    merge(projectUserRows);
    merge(contractorOrgRows);
    merge(clientOrgUserRows);
    participantOptions = Array.from(seen.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  return {
    context,
    project: context.project,
    portal: expected,
    currentUserId: context.user.id,
    conversations,
    participantOptions,
  };
}
