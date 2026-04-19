import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  documentLinks,
  documents,
  projects,
  submittalDocuments,
} from "@/db/schema";
import { getObjectSize, objectExists } from "@/lib/storage";
import { validateReviewerToken } from "@/lib/submittals/reviewer-auth";

// POST /api/reviewer/[token]/attach-document
//
// Reviewers can only attach the two roles their workflow uses:
// `stamp_page` and `reviewer_comments`. Package uploads are the sub's
// responsibility and aren't reachable via the reviewer portal.
//
// Combines what the regular flow splits into /upload/finalize +
// /submittal-documents: creates the documents row, creates the project
// primary link, creates the submittal_documents join with the chosen
// role, and tags the document's `category = 'submittal'`. One call, one
// transaction — reviewers have a narrower scope and we don't need the
// generic-upload ceremony.

const BodySchema = z.object({
  storageKey: z.string().min(1),
  title: z.string().min(1).max(255),
  role: z.enum(["stamp_page", "reviewer_comments"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const auth = await validateReviewerToken(token);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "expired" ? 410 : 401 },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Storage key must live under this project's folder — identical guard
  // to the standard /api/upload/finalize flow, prevents a malicious or
  // buggy client from registering a document that points at someone
  // else's storage path.
  const [project] = await db
    .select({ contractorOrganizationId: projects.contractorOrganizationId })
    .from(projects)
    .where(eq(projects.id, auth.projectId))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: "project_missing" }, { status: 500 });
  }
  const expectedPrefix = `${project.contractorOrganizationId}/${auth.projectId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "invalid_storage_key" },
      { status: 400 },
    );
  }

  const fileSize = await getObjectSize(input.storageKey);
  if (fileSize === null) {
    if (!(await objectExists(input.storageKey))) {
      return NextResponse.json(
        { error: "object_not_found_in_storage" },
        { status: 404 },
      );
    }
  }

  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({
        projectId: auth.projectId,
        documentType:
          input.role === "stamp_page"
            ? "submittal_stamp"
            : "submittal_reviewer_comments",
        title: input.title,
        storageKey: input.storageKey,
        uploadedByUserId: auth.reviewerUserId,
        visibilityScope: "internal_only",
        audienceScope: "internal",
        fileSizeBytes: fileSize,
        category: "submittal",
      })
      .returning();

    await tx.insert(documentLinks).values({
      documentId: doc.id,
      linkedObjectType: "project",
      linkedObjectId: auth.projectId,
      linkRole: "primary",
    });

    const [{ nextOrder }] = await tx
      .select({
        nextOrder: sql<number>`coalesce(max(${submittalDocuments.sortOrder}), -1) + 1`,
      })
      .from(submittalDocuments)
      .where(
        and(
          eq(submittalDocuments.submittalId, auth.submittalId),
          eq(submittalDocuments.role, input.role),
        ),
      );

    const [attach] = await tx
      .insert(submittalDocuments)
      .values({
        submittalId: auth.submittalId,
        documentId: doc.id,
        role: input.role,
        sortOrder: nextOrder,
        attachedByUserId: auth.reviewerUserId,
      })
      .returning();

    return { attachmentId: attach.id, documentId: doc.id };
  });

  return NextResponse.json(result);
}
