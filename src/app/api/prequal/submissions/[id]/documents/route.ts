import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import {
  attachPrequalDocument,
  requestPrequalUploadUrl,
} from "@/domain/prequal";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/prequal/submissions/[id]/documents
//
// Two-phase upload, body.action distinguishes:
//   - "request_upload" → returns presigned PUT URL + storage key
//   - "attach"         → confirms upload, writes prequal_documents row

const DocTypeSchema = z.enum([
  "bond",
  "insurance",
  "safety_manual",
  "references",
  "financial_statements",
]);

const RequestUploadSchema = z.object({
  action: z.literal("request_upload"),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSizeBytes: z.number().int().positive(),
  documentType: DocTypeSchema,
});

const AttachSchema = z.object({
  action: z.literal("attach"),
  documentType: DocTypeSchema,
  storageKey: z.string().min(1),
  title: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  fileSizeBytes: z.number().int().positive(),
  label: z.string().max(255).nullable().optional(),
});

const BodySchema = z.union([RequestUploadSchema, AttachSchema]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const sessionLike = session;

  try {
    if (body.action === "request_upload") {
      const result = await requestPrequalUploadUrl({
        session: sessionLike,
        submissionId: id,
        filename: body.filename,
        mimeType: body.mimeType,
        fileSizeBytes: body.fileSizeBytes,
        documentType: body.documentType,
      });
      return NextResponse.json(result);
    }
    const result = await attachPrequalDocument({
      session: sessionLike,
      submissionId: id,
      documentType: body.documentType,
      storageKey: body.storageKey,
      title: body.title,
      mimeType: body.mimeType,
      fileSizeBytes: body.fileSizeBytes,
      label: body.label ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
