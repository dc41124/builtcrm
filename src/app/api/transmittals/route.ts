import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  documents,
  transmittalDocuments,
  transmittalRecipients,
  transmittals,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/transmittals — create a transmittal as a DRAFT. Drafts
// hold the subject, message, planned recipients, and planned
// documents but have no sequential number, no tokens, and no audit
// breadcrumb (drafts are pre-formal). The number + tokens are
// generated on /send.
//
// The create path accepts inline recipients + documents for the common
// case where the contractor builds the whole thing in one modal pass.
// Subsequent edits use PUT /api/transmittals/[id].

const RecipientSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(160),
  orgLabel: z.string().max(160).nullable().optional(),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  subject: z.string().min(1).max(300),
  message: z.string().max(8000).default(""),
  recipients: z.array(RecipientSchema).max(50).default([]),
  documentIds: z.array(z.string().uuid()).max(50).default([]),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const ctx = await getEffectiveContext(
      session,
      input.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create transmittals",
        "forbidden",
      );
    }

    // Validate attached docs belong to this project — prevents cross-
    // project exfil via the create form.
    if (input.documentIds.length > 0) {
      const docRows = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({ id: documents.id, projectId: documents.projectId })
          .from(documents)
          .where(inArray(documents.id, input.documentIds)),
      );
      if (docRows.length !== input.documentIds.length) {
        return NextResponse.json(
          { error: "document_not_found" },
          { status: 400 },
        );
      }
      if (docRows.some((d) => d.projectId !== input.projectId)) {
        throw new AuthorizationError(
          "Document is not on this project",
          "forbidden",
        );
      }
    }

    // Dedup recipient emails within the submission (spec: unique
    // per-transmittal email at the DB layer too).
    const emailSeen = new Set<string>();
    for (const r of input.recipients) {
      const lower = r.email.toLowerCase();
      if (emailSeen.has(lower)) {
        return NextResponse.json(
          { error: "duplicate_recipient", message: r.email },
          { status: 400 },
        );
      }
      emailSeen.add(lower);
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(transmittals)
        .values({
          projectId: input.projectId,
          subject: input.subject,
          message: input.message,
          status: "draft",
          createdByUserId: ctx.user.id,
        })
        .returning();

      if (input.recipients.length > 0) {
        await tx.insert(transmittalRecipients).values(
          input.recipients.map((r) => ({
            transmittalId: row.id,
            email: r.email.toLowerCase(),
            name: r.name,
            orgLabel: r.orgLabel ?? null,
          })),
        );
      }

      if (input.documentIds.length > 0) {
        await tx.insert(transmittalDocuments).values(
          input.documentIds.map((docId, idx) => ({
            transmittalId: row.id,
            documentId: docId,
            sortOrder: idx,
            attachedByUserId: ctx.user.id,
          })),
        );
      }

      // Audit write on draft create — drafts are still a user-
      // initiated action worth logging even if the transmittal never
      // ships. Keeps the full history of intentions visible.
      await writeAuditEvent(
        ctx,
        {
          action: "draft_created",
          resourceType: "transmittal",
          resourceId: row.id,
          details: {
            nextState: {
              subject: input.subject,
              recipientCount: input.recipients.length,
              documentCount: input.documentIds.length,
            },
          },
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({ id: result.id, status: result.status });
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

