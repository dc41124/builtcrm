import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { prequalDocuments, prequalSubmissions } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext, type SessionLike } from "@/domain/context";
import {
  type PrequalDocumentType,
} from "@/domain/loaders/prequal";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { R2_BUCKET, r2 } from "@/lib/storage";

// -----------------------------------------------------------------------------
// Document upload flow.
//
// 1) Sub calls `requestPrequalUploadUrl` with metadata. Returns a presigned
//    PUT URL + a storage key. Client uploads directly to R2.
// 2) Client calls `attachPrequalDocument` to confirm the upload — writes
//    the prequal_documents row.
// 3) `removePrequalDocument` deletes the row (R2 object cleanup happens
//    out-of-band; the row deletion is the source of truth).
//
// SELF-CONTAINED storage: the documents table is NOT touched. Prequal docs
// have no project context at upload time, so they live in their own
// minimal row (storage_key + title + size + mime_type + uploaded_by).
// -----------------------------------------------------------------------------

const ALLOWED_TYPES = new Set<PrequalDocumentType>([
  "bond",
  "insurance",
  "safety_manual",
  "references",
  "financial_statements",
]);

function slugifyFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function loadSubmissionForSubAction(
  submissionId: string,
  subOrgId: string,
): Promise<typeof prequalSubmissions.$inferSelect> {
  const [row] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, submissionId))
    .limit(1);
  if (!row) throw new AuthorizationError("Submission not found", "not_found");
  if (row.submittedByOrgId !== subOrgId) {
    throw new AuthorizationError("Not your submission", "forbidden");
  }
  return row;
}

export async function requestPrequalUploadUrl(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  documentType: PrequalDocumentType;
}): Promise<{ uploadUrl: string; storageKey: string }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "write");
  if (ctx.role !== "subcontractor_user") {
    throw new AuthorizationError("Sub-only action", "forbidden");
  }
  if (!ALLOWED_TYPES.has(input.documentType)) {
    throw new AuthorizationError("Invalid document type", "forbidden");
  }
  if (input.fileSizeBytes <= 0 || input.fileSizeBytes > 50 * 1024 * 1024) {
    throw new AuthorizationError(
      "File size must be between 1 byte and 50 MB",
      "forbidden",
    );
  }

  const sub = await loadSubmissionForSubAction(
    input.submissionId,
    ctx.organization.id,
  );
  if (sub.status !== "draft" && sub.status !== "submitted") {
    throw new AuthorizationError(
      "Cannot attach documents to this submission",
      "forbidden",
    );
  }

  const storageKey = `prequal/${input.submissionId}/${randomUUID()}-${slugifyFilename(
    input.filename,
  )}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
    ContentType: input.mimeType,
    ContentLength: input.fileSizeBytes,
  });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });

  return { uploadUrl, storageKey };
}

export async function attachPrequalDocument(input: {
  session: SessionLike | null | undefined;
  submissionId: string;
  documentType: PrequalDocumentType;
  storageKey: string;
  title: string;
  mimeType: string;
  fileSizeBytes: number;
  label?: string | null;
}): Promise<{ id: string }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "write");
  if (ctx.role !== "subcontractor_user") {
    throw new AuthorizationError("Sub-only action", "forbidden");
  }
  if (!ALLOWED_TYPES.has(input.documentType)) {
    throw new AuthorizationError("Invalid document type", "forbidden");
  }
  // Storage key must match the prefix the upload-URL action would have
  // produced — prevents a malicious sub from claiming someone else's R2 key.
  const expectedPrefix = `prequal/${input.submissionId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    throw new AuthorizationError("Invalid storage key", "forbidden");
  }

  const sub = await loadSubmissionForSubAction(
    input.submissionId,
    ctx.organization.id,
  );
  if (sub.status !== "draft" && sub.status !== "submitted") {
    throw new AuthorizationError(
      "Cannot attach documents to this submission",
      "forbidden",
    );
  }

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(prequalDocuments)
      .values({
        submissionId: input.submissionId,
        documentType: input.documentType,
        storageKey: input.storageKey,
        title: input.title,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        uploadedByUserId: ctx.user.id,
        label: input.label ?? null,
      })
      .returning({ id: prequalDocuments.id });

    await writeOrgAuditEvent(
      ctx,
      {
        action: "document_attached",
        resourceType: "prequal_submission",
        resourceId: input.submissionId,
        details: {
          metadata: {
            documentId: row.id,
            documentType: input.documentType,
            sizeBytes: input.fileSizeBytes,
          },
        },
      },
      tx,
    );
    return row;
  });

  return { id: result.id };
}

export async function removePrequalDocument(input: {
  session: SessionLike | null | undefined;
  documentId: string;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "write");

  const [doc] = await db
    .select({
      id: prequalDocuments.id,
      submissionId: prequalDocuments.submissionId,
      documentType: prequalDocuments.documentType,
    })
    .from(prequalDocuments)
    .where(eq(prequalDocuments.id, input.documentId))
    .limit(1);
  if (!doc) throw new AuthorizationError("Document not found", "not_found");

  const [sub] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, doc.submissionId))
    .limit(1);
  if (!sub) throw new AuthorizationError("Submission not found", "not_found");

  // Only the submitting org can remove a document and only while editable.
  if (sub.submittedByOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Not your document", "forbidden");
  }
  if (sub.status !== "draft" && sub.status !== "submitted") {
    throw new AuthorizationError(
      "Cannot remove documents from this submission",
      "forbidden",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(prequalDocuments)
      .where(eq(prequalDocuments.id, input.documentId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "document_removed",
        resourceType: "prequal_submission",
        resourceId: doc.submissionId,
        details: {
          metadata: {
            documentId: doc.id,
            documentType: doc.documentType,
          },
        },
      },
      tx,
    );
  });
}

// Mediated download URL — neither the contractor nor the sub gets direct
// R2 access; this server-side helper returns a presigned GET URL for a
// short window. Caller must already be authorized to view the submission.
export async function getPrequalDocumentDownloadUrl(input: {
  session: SessionLike | null | undefined;
  documentId: string;
}): Promise<{ url: string }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_submission", "read");

  const [doc] = await db
    .select({
      id: prequalDocuments.id,
      submissionId: prequalDocuments.submissionId,
      storageKey: prequalDocuments.storageKey,
      title: prequalDocuments.title,
    })
    .from(prequalDocuments)
    .where(eq(prequalDocuments.id, input.documentId))
    .limit(1);
  if (!doc) throw new AuthorizationError("Document not found", "not_found");

  const [sub] = await db
    .select()
    .from(prequalSubmissions)
    .where(eq(prequalSubmissions.id, doc.submissionId))
    .limit(1);
  if (!sub) throw new AuthorizationError("Submission not found", "not_found");

  const isContractorReader =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSubReader = ctx.role === "subcontractor_user";
  const orgMatches =
    (isContractorReader && sub.contractorOrgId === ctx.organization.id) ||
    (isSubReader && sub.submittedByOrgId === ctx.organization.id);
  if (!orgMatches) {
    throw new AuthorizationError("Document not visible", "forbidden");
  }

  const command = new (await import("@aws-sdk/client-s3")).GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: doc.storageKey,
    ResponseContentDisposition: `attachment; filename="${doc.title.replace(/"/g, "")}"`,
  });
  const url = await getSignedUrl(r2, command, { expiresIn: 300 });
  return { url };
}
