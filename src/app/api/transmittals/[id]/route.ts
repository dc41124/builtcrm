import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
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

// PUT /api/transmittals/:id — bulk replace a DRAFT transmittal's
// recipients + attached documents + subject + message. A full-body
// replace makes the draft editor simple: the UI sends whatever the
// user has on screen and the server diffs against existing rows.
//
// Only drafts are editable. Sent transmittals are immutable at the
// content level; only per-recipient revoke is available via the
// dedicated route.

const RecipientSchema = z.object({
  // id is optional — present for existing rows, absent for new ones.
  id: z.string().uuid().nullable().optional(),
  email: z.string().email().max(255),
  name: z.string().min(1).max(160),
  orgLabel: z.string().max(160).nullable().optional(),
});

const BodySchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  message: z.string().max(8000).optional(),
  recipients: z.array(RecipientSchema).max(50).optional(),
  documentIds: z.array(z.string().uuid()).max(50).optional(),
});

export async function PUT(
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
  const input = parsed.data;

  try {
    // Pre-tenant head lookup: tenant unknown until we resolve project.
    const [head] = await dbAdmin
      .select({
        id: transmittals.id,
        projectId: transmittals.projectId,
        status: transmittals.status,
      })
      .from(transmittals)
      .where(eq(transmittals.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit transmittals",
        "forbidden",
      );
    }
    if (head.status !== "draft") {
      return NextResponse.json(
        {
          error: "not_editable",
          message: "Sent transmittals cannot be edited",
        },
        { status: 409 },
      );
    }

    if (input.documentIds && input.documentIds.length > 0) {
      const documentIds = input.documentIds;
      const docRows = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({ id: documents.id, projectId: documents.projectId })
          .from(documents)
          .where(inArray(documents.id, documentIds)),
      );
      if (docRows.length !== documentIds.length) {
        return NextResponse.json(
          { error: "document_not_found" },
          { status: 400 },
        );
      }
      if (docRows.some((d) => d.projectId !== head.projectId)) {
        throw new AuthorizationError(
          "Document is not on this project",
          "forbidden",
        );
      }
    }

    if (input.recipients) {
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
    }

    await withTenant(ctx.organization.id, async (tx) => {
      const updates: Record<string, unknown> = {};
      if (input.subject !== undefined) updates.subject = input.subject;
      if (input.message !== undefined) updates.message = input.message;
      if (Object.keys(updates).length > 0) {
        await tx.update(transmittals).set(updates).where(eq(transmittals.id, id));
      }

      if (input.recipients) {
        const existing = await tx
          .select({ id: transmittalRecipients.id })
          .from(transmittalRecipients)
          .where(eq(transmittalRecipients.transmittalId, id));
        const keepIds = input.recipients
          .map((r) => r.id)
          .filter((v): v is string => !!v);
        if (existing.length > 0) {
          if (keepIds.length > 0) {
            await tx
              .delete(transmittalRecipients)
              .where(
                and(
                  eq(transmittalRecipients.transmittalId, id),
                  notInArray(transmittalRecipients.id, keepIds),
                ),
              );
          } else {
            await tx
              .delete(transmittalRecipients)
              .where(eq(transmittalRecipients.transmittalId, id));
          }
        }
        for (const r of input.recipients) {
          if (r.id) {
            await tx
              .update(transmittalRecipients)
              .set({
                email: r.email.toLowerCase(),
                name: r.name,
                orgLabel: r.orgLabel ?? null,
              })
              .where(eq(transmittalRecipients.id, r.id));
          } else {
            await tx.insert(transmittalRecipients).values({
              transmittalId: id,
              email: r.email.toLowerCase(),
              name: r.name,
              orgLabel: r.orgLabel ?? null,
            });
          }
        }
      }

      if (input.documentIds) {
        // Drop-and-recreate join rows. Cheap at our scale; preserves
        // sort order by array index.
        await tx
          .delete(transmittalDocuments)
          .where(eq(transmittalDocuments.transmittalId, id));
        if (input.documentIds.length > 0) {
          await tx.insert(transmittalDocuments).values(
            input.documentIds.map((docId, idx) => ({
              transmittalId: id,
              documentId: docId,
              sortOrder: idx,
              attachedByUserId: ctx.user.id,
            })),
          );
        }
      }

      await writeAuditEvent(
        ctx,
        {
          action: "draft_updated",
          resourceType: "transmittal",
          resourceId: id,
          details: {
            metadata: {
              subjectChanged: input.subject !== undefined,
              recipientsReplaced: input.recipients !== undefined,
              documentsReplaced: input.documentIds !== undefined,
            },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
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

// DELETE /api/transmittals/:id — discard a draft. Sent transmittals
// are not deletable (the audit trail says they were sent; revoke
// per-recipient to block downloads instead).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    // Pre-tenant head lookup: tenant unknown until we resolve project.
    const [head] = await dbAdmin
      .select({
        id: transmittals.id,
        projectId: transmittals.projectId,
        status: transmittals.status,
        subject: transmittals.subject,
      })
      .from(transmittals)
      .where(eq(transmittals.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can discard transmittals",
        "forbidden",
      );
    }
    if (head.status !== "draft") {
      return NextResponse.json(
        {
          error: "not_deletable",
          message: "Sent transmittals cannot be deleted — revoke per-recipient instead",
        },
        { status: 409 },
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      await writeAuditEvent(
        ctx,
        {
          action: "draft_discarded",
          resourceType: "transmittal",
          resourceId: id,
          details: {
            previousState: { subject: head.subject, status: head.status },
          },
        },
        tx,
      );
      await tx.delete(transmittals).where(eq(transmittals.id, id));
    });

    return NextResponse.json({ ok: true });
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
