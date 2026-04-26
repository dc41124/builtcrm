import { NextResponse } from "next/server";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { projects } from "@/db/schema";
import { buildStorageKey, presignUploadUrl } from "@/lib/storage";
import { validateReviewerToken } from "@/lib/submittals/reviewer-auth";
import { eq } from "drizzle-orm";

// POST /api/reviewer/[token]/upload-request
//
// Token-authenticated parallel of /api/upload/request. Presigns a
// single R2 PUT URL scoped to the submittal's project folder. The
// reviewer never sees project or org IDs — everything is resolved
// server-side from their token.

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
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

  // Reviewer-uploaded docs always go under the project's own folder,
  // tagged `documentType: 'submittal_reviewer'` so they're identifiable
  // in storage logs.
  // Reviewer flow is pre-tenant (external token); use dbAdmin.
  const [project] = await dbAdmin
    .select({
      contractorOrganizationId: projects.contractorOrganizationId,
    })
    .from(projects)
    .where(eq(projects.id, auth.projectId))
    .limit(1);
  if (!project) {
    return NextResponse.json({ error: "project_missing" }, { status: 500 });
  }

  const storageKey = buildStorageKey({
    orgId: project.contractorOrganizationId,
    projectId: auth.projectId,
    documentType: "submittal_reviewer",
    filename: parsed.data.filename,
  });
  const uploadUrl = await presignUploadUrl({
    key: storageKey,
    contentType: parsed.data.contentType,
    expiresInSeconds: 300,
  });
  return NextResponse.json({ uploadUrl, storageKey });
}
