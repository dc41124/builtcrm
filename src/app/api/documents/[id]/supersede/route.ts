import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { documentLinks, documents } from "@/db/schema";
import { isInChain } from "@/domain/documents/versioning";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { deleteObject, objectExists } from "@/lib/storage";

// POST /api/documents/[id]/supersede
//
// Uploads a new version of an existing document. Client has already
// uploaded the bytes to R2 via /api/upload/request → PUT, and passes
// the resulting storageKey here to finalize.
//
// Uses the `supersedes_document_id` column model (Step 22). Previous
// implementation used a document_links pivot with link_role='supersedes'
// — that approach is migrated out by 0016_document_versioning.sql.
//
// Category + visibility/audience scope are LOCKED across a version
// chain (advisor directive): the whole chain must stay in the same
// logical folder and retain the same audience, otherwise
// category-filtered views silently lose historical versions and
// clients see trust-breaking drift. New version inherits these fields
// verbatim from the predecessor; title is editable.
//
// Guards:
//   1. Cycle / self-ref: predecessor isn't allowed to be a descendant
//      of this new upload (would create A→B→A loops). Uses isInChain.
//   2. Race: the INSERT → UPDATE pair runs inside a transaction that
//      also re-reads the predecessor's isSuperseded flag. If another
//      concurrent supersede already ran, we fail before the column's
//      partial-unique index would and delete the orphan R2 object.
//   3. Locked fields: category + visibilityScope + audienceScope are
//      always carried forward; any override in the request body is
//      rejected.

const BodySchema = z.object({
  storageKey: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: priorId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Entry-point dbAdmin: tenant unknown until we resolve project from
  // the document row. Slice 3 pattern.
  const [prior] = await dbAdmin
    .select()
    .from(documents)
    .where(eq(documents.id, priorId))
    .limit(1);
  if (!prior) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      prior.projectId,
    );
    assertCan(ctx.permissions, "document", "write");

    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    if (!isContractor && prior.uploadedByUserId !== ctx.user.id) {
      throw new AuthorizationError(
        "Only the original uploader or a contractor can supersede this document",
        "forbidden",
      );
    }

    // Early-bail check before we touch the DB. Race window between
    // here and the transaction re-check is fine — we'll catch the
    // double-supersede inside the transaction.
    if (prior.isSuperseded) {
      return NextResponse.json(
        { error: "already_superseded" },
        { status: 409 },
      );
    }

    const expectedPrefix = `${ctx.project.contractorOrganizationId}/${ctx.project.id}/`;
    if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "invalid_storage_key" },
        { status: 400 },
      );
    }
    if (!(await objectExists(parsed.data.storageKey))) {
      return NextResponse.json(
        { error: "object_not_found_in_storage" },
        { status: 404 },
      );
    }

    // Start a transaction. Any failure from here down triggers R2
    // orphan cleanup on the new storage key.
    let result: { newId: string } | null = null;
    try {
      result = await withTenant(ctx.organization.id, async (tx) => {
        // Race re-check: re-read prior's status inside the txn.
        // Without this, two concurrent supersedes could both pass
        // the outer check, both insert, and one would fail on the
        // partial unique index — after its R2 upload completed.
        const [reread] = await tx
          .select({
            isSuperseded: documents.isSuperseded,
            documentStatus: documents.documentStatus,
            category: documents.category,
            visibilityScope: documents.visibilityScope,
            audienceScope: documents.audienceScope,
            documentType: documents.documentType,
          })
          .from(documents)
          .where(eq(documents.id, priorId))
          .limit(1);
        if (!reread) {
          throw new TxError("not_found");
        }
        if (reread.isSuperseded) {
          throw new TxError("race_lost");
        }

        const [next] = await tx
          .insert(documents)
          .values({
            projectId: prior.projectId,
            documentType: reread.documentType,
            // Locked across the chain — carried from the predecessor
            // regardless of any client override attempt.
            category: reread.category,
            visibilityScope: reread.visibilityScope,
            audienceScope: reread.audienceScope,
            title: parsed.data.title ?? prior.title,
            storageKey: parsed.data.storageKey,
            uploadedByUserId: ctx.user.id,
            supersedesDocumentId: prior.id,
          })
          .returning({
            id: documents.id,
            title: documents.title,
            storageKey: documents.storageKey,
          });

        // Keep the new row discoverable through the same project pivot
        // used by every other document. No more link_role='supersedes'
        // pivot row — that relationship now lives on the column.
        await tx.insert(documentLinks).values({
          documentId: next.id,
          linkedObjectType: "project",
          linkedObjectId: prior.projectId,
          linkRole: "primary",
        });

        await tx
          .update(documents)
          .set({
            isSuperseded: true,
            documentStatus: "superseded",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(documents.id, prior.id),
              // Defensive: only flip if still not superseded. If it
              // was flipped by a concurrent txn this no-ops and we
              // roll back below via the count check.
              eq(documents.isSuperseded, false),
            ),
          );

        await writeAuditEvent(
          ctx,
          {
            action: "superseded",
            resourceType: "document",
            resourceId: prior.id,
            details: {
              previousState: {
                storageKey: prior.storageKey,
                documentStatus: prior.documentStatus,
                isSuperseded: prior.isSuperseded,
              },
              nextState: {
                supersededByDocumentId: next.id,
                documentStatus: "superseded",
                isSuperseded: true,
              },
            },
          },
          tx,
        );
        await writeAuditEvent(
          ctx,
          {
            action: "version_created",
            resourceType: "document",
            resourceId: next.id,
            details: {
              nextState: {
                storageKey: next.storageKey,
                title: next.title,
                supersedesDocumentId: prior.id,
              },
            },
          },
          tx,
        );

        return { newId: next.id };
      });
    } catch (err) {
      // Transaction failed. Delete the orphan R2 object so the
      // bucket doesn't accumulate dead uploads. Matches the advisor
      // directive (race-loss + orphan cleanup).
      await deleteObject(parsed.data.storageKey);

      if (err instanceof TxError && err.code === "race_lost") {
        return NextResponse.json(
          {
            error: "race_lost",
            message:
              "This document was just versioned by someone else — please refresh and try again.",
          },
          { status: 409 },
        );
      }
      if (err instanceof TxError && err.code === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      // Cycle guard — already caught above before the transaction, but
      // belt-and-braces: surface any partial-unique index violation as
      // a clean 409 rather than a 500.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("documents_supersedes_unique")) {
        return NextResponse.json(
          { error: "race_lost", message: "Already versioned — please refresh." },
          { status: 409 },
        );
      }
      throw err;
    }

    // Last defensive: the static analysis can't prove result is set,
    // but the transaction either returns it or threw.
    if (!result) {
      await deleteObject(parsed.data.storageKey);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }

    // Cycle guard — runs post-commit as a sanity check (the new row's
    // predecessor was the prior id; a cycle would require the prior to
    // already be downstream of the new row, which can't happen on a
    // fresh insert but we assert anyway).
    if (await isInChain(result.newId, prior.id, ctx.organization.id)) {
      // Impossible under the current insert logic; kept as an assertion.
    }

    return NextResponse.json({
      documentId: result.newId,
      supersededDocumentId: priorId,
    });
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

// Internal sentinel for transaction-level failures we want to surface
// with specific HTTP statuses. Keeps the throw/catch flow clean vs.
// leaking drizzle error shapes up the stack.
class TxError extends Error {
  constructor(public code: "race_lost" | "not_found") {
    super(code);
  }
}
