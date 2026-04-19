import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documents, submittalDocuments, submittals } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/submittal-documents
//
// Attach an already-uploaded document to a submittal with a role tag.
// Same R2 presign → PUT → finalize flow as the other modules; this
// endpoint only creates the join row.
//
// Role rules:
//  - `package`: sub OR GC. Sub can only attach while status = draft.
//  - `reviewer_comments` / `stamp_page`: GC only.
//
// Document must live on the same project as the submittal, AND the
// action tags the document with `category = 'submittal'` as a side
// effect so the Step 21 document categories UI can find it later.

const BodySchema = z.object({
  submittalId: z.string().uuid(),
  documentId: z.string().uuid(),
  role: z.enum(["package", "reviewer_comments", "stamp_page"]),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const [head] = await db
      .select({
        id: submittals.id,
        projectId: submittals.projectId,
        submittedByOrgId: submittals.submittedByOrgId,
        status: submittals.status,
      })
      .from(submittals)
      .where(eq(submittals.id, input.submittalId))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      head.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isSubmittingSub =
      ctx.role === "subcontractor_user" &&
      head.submittedByOrgId === ctx.organization.id;

    if (input.role === "package") {
      const canAttach =
        isContractor || (isSubmittingSub && head.status === "draft");
      if (!canAttach) {
        throw new AuthorizationError(
          "Sub can attach package docs only while draft",
          "forbidden",
        );
      }
    } else {
      // reviewer_comments + stamp_page = GC only.
      if (!isContractor) {
        throw new AuthorizationError(
          "Only contractors attach reviewer/stamp docs",
          "forbidden",
        );
      }
    }

    const [doc] = await db
      .select({ id: documents.id, projectId: documents.projectId })
      .from(documents)
      .where(eq(documents.id, input.documentId))
      .limit(1);
    if (!doc || doc.projectId !== head.projectId) {
      return NextResponse.json(
        { error: "invalid_document", message: "Document not on this project" },
        { status: 400 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [{ nextOrder }] = await tx
        .select({
          nextOrder: sql<number>`coalesce(max(${submittalDocuments.sortOrder}), -1) + 1`,
        })
        .from(submittalDocuments)
        .where(eq(submittalDocuments.submittalId, input.submittalId));

      const [row] = await tx
        .insert(submittalDocuments)
        .values({
          submittalId: input.submittalId,
          documentId: input.documentId,
          role: input.role,
          sortOrder: nextOrder,
          attachedByUserId: ctx.user.id,
        })
        .returning();

      // Tag the underlying document so Step 21's folder view can find
      // it. `category` default is 'other'; we upgrade to 'submittal'
      // when the doc gets attached here. Benign no-op if already set.
      await tx
        .update(documents)
        .set({ category: "submittal" })
        .where(eq(documents.id, input.documentId));

      await writeAuditEvent(
        ctx,
        {
          action: "document_attached",
          resourceType: "submittal",
          resourceId: input.submittalId,
          details: {
            nextState: {
              attachmentId: row.id,
              documentId: row.documentId,
              role: row.role,
            },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({ id: result.id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
