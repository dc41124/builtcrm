import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { approvals, changeOrders, rfis } from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type EffectiveRole,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

import {
  loadDocumentsForProject,
  type DocumentAudience,
  type DocumentRow,
} from "./project-home";

export type DocumentsViewPortal =
  | "contractor"
  | "subcontractor"
  | "commercial"
  | "residential";

export type LinkableItem = {
  type: "rfi" | "change_order" | "approval";
  id: string;
  label: string;
};

export type DocumentsView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  portal: DocumentsViewPortal;
  currentUserId: string;
  canWrite: boolean;
  canManageAnyDoc: boolean;
  documents: DocumentRow[];
  linkableItems: LinkableItem[];
};

type LoaderInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

const ROLE_TO_PORTAL: Record<EffectiveRole, DocumentsViewPortal> = {
  contractor_admin: "contractor",
  contractor_pm: "contractor",
  subcontractor_user: "subcontractor",
  commercial_client: "commercial",
  residential_client: "residential",
};

const PORTAL_TO_AUDIENCE: Record<DocumentsViewPortal, DocumentAudience> = {
  contractor: "contractor",
  subcontractor: "subcontractor",
  commercial: "client",
  residential: "client",
};

export async function getDocumentsView(
  input: LoaderInput,
  expected: DocumentsViewPortal,
): Promise<DocumentsView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  const actual = ROLE_TO_PORTAL[context.role];
  if (actual !== expected) {
    throw new AuthorizationError(
      `Documents view for ${expected} requires a matching role`,
      "forbidden",
    );
  }

  const audience = PORTAL_TO_AUDIENCE[expected];
  const docs = await loadDocumentsForProject(context.project.id, audience);

  // Linkable items: only the contractor UI exposes the linking picker in
  // the upload modal. Subs/clients can upload but link to their own scope
  // implicitly, so we skip the extra queries for them.
  let linkableItems: LinkableItem[] = [];
  if (expected === "contractor" && context.permissions.can("document", "write")) {
    const [rfiRows, coRows, apRows] = await Promise.all([
      db
        .select({
          id: rfis.id,
          sequentialNumber: rfis.sequentialNumber,
          subject: rfis.subject,
        })
        .from(rfis)
        .where(eq(rfis.projectId, context.project.id))
        .orderBy(desc(rfis.createdAt)),
      db
        .select({
          id: changeOrders.id,
          title: changeOrders.title,
        })
        .from(changeOrders)
        .where(eq(changeOrders.projectId, context.project.id))
        .orderBy(desc(changeOrders.createdAt)),
      db
        .select({
          id: approvals.id,
          approvalNumber: approvals.approvalNumber,
          title: approvals.title,
        })
        .from(approvals)
        .where(eq(approvals.projectId, context.project.id))
        .orderBy(desc(approvals.createdAt)),
    ]);
    linkableItems = [
      ...rfiRows.map((r) => ({
        type: "rfi" as const,
        id: r.id,
        label: `RFI-${String(r.sequentialNumber).padStart(3, "0")} — ${r.subject}`,
      })),
      ...coRows.map((r) => ({
        type: "change_order" as const,
        id: r.id,
        label: r.title,
      })),
      ...apRows.map((r) => ({
        type: "approval" as const,
        id: r.id,
        label: `${r.approvalNumber} — ${r.title}`,
      })),
    ];
  }

  const isContractorManager =
    context.role === "contractor_admin" || context.role === "contractor_pm";

  return {
    context,
    project: context.project,
    portal: expected,
    currentUserId: context.user.id,
    canWrite: context.permissions.can("document", "write"),
    canManageAnyDoc: isContractorManager,
    documents: docs,
    linkableItems,
  };
}
