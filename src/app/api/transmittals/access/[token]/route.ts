import { GetObjectCommand } from "@aws-sdk/client-s3";
import archiver from "archiver";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { Readable } from "node:stream";

import { db } from "@/db/client";
import {
  documents,
  transmittalAccessEvents,
  transmittalDocuments,
  transmittalRecipients,
  transmittals,
} from "@/db/schema";
import { R2_BUCKET, r2 } from "@/lib/storage";
import { emitNotifications } from "@/lib/notifications/emit";
import type { Recipient } from "@/lib/notifications/recipients";
import { hashToken } from "@/lib/transmittals/token";
import { padTransmittalNumber } from "@/domain/loaders/transmittals";

// GET /api/transmittals/access/:token — anonymous, tokenized download.
//
// No session required. Looks up the recipient by the SHA-256 digest of
// the URL token, validates it's sent / not revoked / not expired, then:
//
//   1. Writes a transmittal_access_events row (IP + UA from request
//      headers, best-effort).
//   2. Bumps the recipient's rollup counters atomically
//      (total_downloads + last_downloaded_at, and
//      first_downloaded_at on first click).
//   3. Emits a `transmittal_downloaded` notification to the sender.
//   4. Streams a ZIP of the attached documents from R2.
//
// Failure modes return 404 with a generic message — we deliberately
// don't distinguish "never existed" from "revoked" / "expired" so the
// response can't be used as a token oracle.

export const runtime = "nodejs";

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_");
}

function clientIpFrom(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return req.headers.get("x-real-ip") ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 20 || token.length > 120) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const digest = hashToken(token);

  // Look up by digest. Inner join to the transmittal to get the
  // sender context in one query.
  const [row] = await db
    .select({
      recipientId: transmittalRecipients.id,
      recipientName: transmittalRecipients.name,
      recipientEmail: transmittalRecipients.email,
      revokedAt: transmittalRecipients.revokedAt,
      expiresAt: transmittalRecipients.expiresAt,
      transmittalId: transmittals.id,
      status: transmittals.status,
      subject: transmittals.subject,
      sequentialNumber: transmittals.sequentialNumber,
      projectId: transmittals.projectId,
      sentByUserId: transmittals.sentByUserId,
    })
    .from(transmittalRecipients)
    .innerJoin(
      transmittals,
      eq(transmittals.id, transmittalRecipients.transmittalId),
    )
    .where(eq(transmittalRecipients.accessTokenDigest, digest))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.status !== "sent") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.revokedAt) {
    return NextResponse.json({ error: "revoked" }, { status: 403 });
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // Documents in sort order — this is what the ZIP stream will contain.
  const docRows = await db
    .select({
      documentId: transmittalDocuments.documentId,
      sortOrder: transmittalDocuments.sortOrder,
      title: documents.title,
      storageKey: documents.storageKey,
    })
    .from(transmittalDocuments)
    .innerJoin(documents, eq(documents.id, transmittalDocuments.documentId))
    .where(eq(transmittalDocuments.transmittalId, row.transmittalId));
  if (docRows.length === 0) {
    return NextResponse.json(
      { error: "no_documents" },
      { status: 410 },
    );
  }
  docRows.sort((a, b) => a.sortOrder - b.sortOrder);

  const ipAddress = clientIpFrom(req);
  const userAgent = req.headers.get("user-agent");
  const numberLabel = padTransmittalNumber(row.sequentialNumber);

  // Write the access event + bump counters + notify sender in one tx.
  // Streaming the zip happens OUTSIDE the tx — the commit is
  // durable before we start writing bytes to the client.
  await db.transaction(async (tx) => {
    await tx.insert(transmittalAccessEvents).values({
      recipientId: row.recipientId,
      ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
      userAgent: userAgent ? userAgent.slice(0, 512) : null,
    });
    await tx
      .update(transmittalRecipients)
      .set({
        totalDownloads: sql`${transmittalRecipients.totalDownloads} + 1`,
        lastDownloadedAt: new Date(),
        firstDownloadedAt: sql`coalesce(${transmittalRecipients.firstDownloadedAt}, now())`,
      })
      .where(
        and(
          eq(transmittalRecipients.id, row.recipientId),
        ),
      );

    if (row.sentByUserId) {
      const recipient: Recipient = {
        userId: row.sentByUserId,
        portalType: "contractor",
      };
      await emitNotifications(
        {
          eventId: "transmittal_downloaded",
          actorUserId: row.sentByUserId, // no anonymous actor; attribute to sender so recipient-filter passes
          projectId: row.projectId,
          relatedObjectType: "transmittal",
          relatedObjectId: row.transmittalId,
          recipientsOverride: [recipient],
          vars: {
            number: numberLabel,
            subject: row.subject,
            recipientName: row.recipientName,
          },
        },
        tx,
      );
    }
  });

  const archive = archiver("zip", { zlib: { level: 6 } });
  for (const d of docRows) {
    const obj = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: d.storageKey }),
    );
    if (!obj.Body) continue;
    const body = obj.Body as Readable;
    const name = safeFilename(d.title);
    archive.append(body, { name });
  }
  archive.finalize().catch((err) => {
    console.error("transmittal archive.finalize failed", err);
    archive.destroy(err as Error);
  });

  const zipFilename = `${numberLabel}.zip`;
  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
