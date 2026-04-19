import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  documents,
  submittalDocuments,
  submittalTransmittals,
  submittals,
  users,
} from "@/db/schema";
import { presignDownloadUrl } from "@/lib/storage";
import {
  formatNumber,
  formatSpecSection,
  SUBMITTAL_TYPE_LABEL,
  type SubmittalType,
} from "@/lib/submittals/config";
import { validateReviewerToken } from "@/lib/submittals/reviewer-auth";

import { ReviewerExpired } from "./expired";
import { ReviewerWorkspace, type ReviewerPackageDoc } from "./workspace";

// Landing page for external reviewer invitations. Validates the token,
// loads a minimal submittal view, and renders the reviewer workspace.
// Expired/consumed/invalid tokens render the dedicated ReviewerExpired
// screen with the inviting GC's name + email so the reviewer has an
// actionable path.
//
// This route lives outside the middleware's protected matcher — the
// token is the auth. No Better Auth session required.

export default async function ReviewerTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const auth = await validateReviewerToken(token);

  // Resolve inviting GC contact info regardless of outcome — the
  // expired screen needs it for its "contact [X] at [email]" copy.
  const gcContact = await loadGcContact(auth.ok ? auth.invitedByUserId : auth.invitedByUserId);

  if (!auth.ok) {
    return (
      <ReviewerExpired
        reason={auth.reason}
        gcName={gcContact?.displayName ?? null}
        gcEmail={gcContact?.email ?? null}
      />
    );
  }

  // Load the submittal metadata + the most-recent outgoing_to_reviewer
  // transmittal for this submittal (carries GC's cover notes + cover
  // doc link). That's the header + context block in the reviewer view.
  const [s] = await db
    .select({
      id: submittals.id,
      sequentialNumber: submittals.sequentialNumber,
      specSection: submittals.specSection,
      title: submittals.title,
      submittalType: submittals.submittalType,
      dueDate: submittals.dueDate,
      status: submittals.status,
    })
    .from(submittals)
    .where(eq(submittals.id, auth.submittalId))
    .limit(1);
  if (!s) {
    return (
      <ReviewerExpired
        reason="not_found"
        gcName={gcContact?.displayName ?? null}
        gcEmail={gcContact?.email ?? null}
      />
    );
  }

  const [outgoing] = await db
    .select({
      transmittedAt: submittalTransmittals.transmittedAt,
      notes: submittalTransmittals.notes,
      documentId: submittalTransmittals.documentId,
      docTitle: documents.title,
      docStorageKey: documents.storageKey,
    })
    .from(submittalTransmittals)
    .leftJoin(documents, eq(documents.id, submittalTransmittals.documentId))
    .where(
      and(
        eq(submittalTransmittals.submittalId, auth.submittalId),
        eq(submittalTransmittals.direction, "outgoing_to_reviewer"),
      ),
    )
    .orderBy(desc(submittalTransmittals.transmittedAt))
    .limit(1);

  const coverDocUrl = outgoing?.docStorageKey
    ? await presignDownloadUrl({
        key: outgoing.docStorageKey,
        expiresInSeconds: 900,
      }).catch(() => null)
    : null;

  // Package documents — the things the reviewer is here to look at.
  const packageRows = await db
    .select({
      id: submittalDocuments.id,
      documentId: submittalDocuments.documentId,
      title: documents.title,
      storageKey: documents.storageKey,
      fileSizeBytes: documents.fileSizeBytes,
    })
    .from(submittalDocuments)
    .innerJoin(documents, eq(documents.id, submittalDocuments.documentId))
    .where(
      and(
        eq(submittalDocuments.submittalId, auth.submittalId),
        eq(submittalDocuments.role, "package"),
      ),
    )
    .orderBy(asc(submittalDocuments.sortOrder), asc(submittalDocuments.createdAt));

  const urls = await Promise.all(
    packageRows.map((r) =>
      presignDownloadUrl({
        key: r.storageKey,
        expiresInSeconds: 900,
      }).catch(() => ""),
    ),
  );
  const packageDocs: ReviewerPackageDoc[] = packageRows.map((r, i) => ({
    id: r.id,
    documentId: r.documentId,
    title: r.title,
    url: urls[i],
    fileSizeBytes: r.fileSizeBytes,
  }));

  return (
    <ReviewerWorkspace
      token={token}
      submittal={{
        id: s.id,
        number: formatNumber(s.sequentialNumber),
        specSection: formatSpecSection(s.specSection),
        title: s.title,
        submittalType: s.submittalType as SubmittalType,
        submittalTypeLabel: SUBMITTAL_TYPE_LABEL[s.submittalType as SubmittalType],
        dueDate: s.dueDate,
      }}
      sender={{
        name: gcContact?.displayName ?? "The general contractor",
        email: gcContact?.email ?? null,
        sentAt: outgoing?.transmittedAt.toISOString() ?? null,
        notes: outgoing?.notes ?? null,
        coverDocTitle: outgoing?.docTitle ?? null,
        coverDocUrl: coverDocUrl ?? null,
      }}
      reviewer={{
        email: auth.reviewerEmail,
        expiresAt: auth.expiresAt.toISOString(),
      }}
      packageDocs={packageDocs}
    />
  );
}

async function loadGcContact(userId: string | undefined) {
  if (!userId) return null;
  const [row] = await db
    .select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}
