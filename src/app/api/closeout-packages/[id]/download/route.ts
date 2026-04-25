import { GetObjectCommand } from "@aws-sdk/client-s3";
import { renderToBuffer } from "@react-pdf/renderer";
import archiver from "archiver";
import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { Readable } from "node:stream";

import { db } from "@/db/client";
import {
  closeoutPackageItems,
  closeoutPackageSections,
  closeoutPackages,
  documents,
  organizations,
  projects,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  CloseoutCoverDocument,
  type CloseoutCoverData,
  type CloseoutCoverSection,
} from "@/lib/pdf/closeout-cover-template";
import {
  sectionFolderSlug,
  sectionLabelFor,
} from "@/lib/closeout-packages/section-config";
import { R2_BUCKET, r2 } from "@/lib/storage";
import { formatCloseoutNumber } from "@/domain/loaders/closeout-packages";

// GET /api/closeout-packages/:id/download — streams an indexed ZIP with:
//   INDEX.pdf                                   (cover letter)
//   00_om_manuals/001_HVAC_Carrier_OM.pdf
//   00_om_manuals/002_Boiler_OM.pdf
//   01_warranties/001_Roofing_GAF.pdf
//   ...
//
// Contractor can download any time (preview or archive). Client can
// download when the package is delivered or accepted. Access is gated
// via getEffectiveContext — no anonymous tokens (owner signs in to
// their portal to fetch the bundle).

export const runtime = "nodejs";

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const [head] = await db
      .select({
        id: closeoutPackages.id,
        projectId: closeoutPackages.projectId,
        organizationId: closeoutPackages.organizationId,
        status: closeoutPackages.status,
        title: closeoutPackages.title,
        sequenceYear: closeoutPackages.sequenceYear,
        sequenceNumber: closeoutPackages.sequenceNumber,
        deliveredAt: closeoutPackages.deliveredAt,
        deliveredByUserId: closeoutPackages.deliveredByUserId,
      })
      .from(closeoutPackages)
      .where(eq(closeoutPackages.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isClient =
      ctx.role === "commercial_client" || ctx.role === "residential_client";
    if (!isContractor && !isClient) {
      throw new AuthorizationError("forbidden", "forbidden");
    }
    if (isClient && head.status !== "delivered" && head.status !== "accepted") {
      throw new AuthorizationError(
        "Package is not available for download",
        "forbidden",
      );
    }

    const numberLabel = formatCloseoutNumber(
      head.sequenceYear,
      head.sequenceNumber,
    );

    // Collect sections + items ordered the same way the UI renders them.
    const sectionRows = await db
      .select({
        id: closeoutPackageSections.id,
        sectionType: closeoutPackageSections.sectionType,
        customLabel: closeoutPackageSections.customLabel,
        orderIndex: closeoutPackageSections.orderIndex,
      })
      .from(closeoutPackageSections)
      .where(eq(closeoutPackageSections.packageId, id))
      .orderBy(
        asc(closeoutPackageSections.orderIndex),
        asc(closeoutPackageSections.createdAt),
      );

    const sectionIds = sectionRows.map((s) => s.id);
    const itemRows =
      sectionIds.length === 0
        ? []
        : await db
            .select({
              id: closeoutPackageItems.id,
              sectionId: closeoutPackageItems.sectionId,
              documentId: closeoutPackageItems.documentId,
              name: documents.title,
              storageKey: documents.storageKey,
              sizeBytes: documents.fileSizeBytes,
              notes: closeoutPackageItems.notes,
              sortOrder: closeoutPackageItems.sortOrder,
            })
            .from(closeoutPackageItems)
            .innerJoin(
              documents,
              eq(documents.id, closeoutPackageItems.documentId),
            )
            .where(inArray(closeoutPackageItems.sectionId, sectionIds))
            .orderBy(
              asc(closeoutPackageItems.sortOrder),
              asc(closeoutPackageItems.createdAt),
            );

    if (itemRows.length === 0) {
      return NextResponse.json(
        { error: "empty_package" },
        { status: 410 },
      );
    }

    // Cover letter data.
    const [orgRow] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, head.organizationId))
      .limit(1);
    const [projRow] = await db
      .select({
        name: projects.name,
        addressLine1: projects.addressLine1,
        city: projects.city,
        stateProvince: projects.stateProvince,
      })
      .from(projects)
      .where(eq(projects.id, head.projectId))
      .limit(1);

    const coverSections: CloseoutCoverSection[] = sectionRows.map((s, si) => {
      const items = itemRows.filter((it) => it.sectionId === s.id);
      return {
        sectionLabel: sectionLabelFor(
          s.sectionType as Parameters<typeof sectionLabelFor>[0],
          s.customLabel,
        ),
        items: items.map((it, ii) => ({
          indexLabel: `${String(si + 1).padStart(2, "0")}.${String(ii + 1).padStart(3, "0")}`,
          name: it.name,
          sizeBytes: Number(it.sizeBytes ?? 0),
          notes: it.notes,
        })),
      };
    });

    const addr = [
      projRow?.addressLine1,
      [projRow?.city, projRow?.stateProvince].filter(Boolean).join(", "),
    ]
      .filter((s) => s && s.trim().length > 0)
      .join(" · ");

    const coverData: CloseoutCoverData = {
      numberLabel,
      title: head.title,
      contractorOrgName: orgRow?.name ?? ctx.organization.name,
      projectName: projRow?.name ?? "",
      projectAddress: addr.length > 0 ? addr : null,
      deliveredAt: head.deliveredAt ?? null,
      deliveredByName: ctx.user.displayName,
      sections: coverSections,
    };

    const coverBuffer = await renderToBuffer(
      CloseoutCoverDocument({ data: coverData }),
    );

    // Audit download (contractor preview + client fetch all go through here).
    await db.transaction(async (tx) => {
      await writeAuditEvent(
        ctx,
        {
          action: "downloaded",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            metadata: {
              via: isClient ? "client_portal" : "contractor_portal",
              itemCount: itemRows.length,
            },
          },
        },
        tx,
      );
    });

    // Stream the ZIP. Cover letter first, then section folders.
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.append(coverBuffer, { name: "INDEX.pdf" });

    for (let si = 0; si < sectionRows.length; si += 1) {
      const sec = sectionRows[si];
      const folderName = sectionFolderSlug(
        sec.sectionType as Parameters<typeof sectionFolderSlug>[0],
        sec.customLabel,
        si + 1,
      );
      const items = itemRows.filter((it) => it.sectionId === sec.id);
      for (let ii = 0; ii < items.length; ii += 1) {
        const it = items[ii];
        const obj = await r2.send(
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: it.storageKey }),
        );
        if (!obj.Body) continue;
        const body = obj.Body as Readable;
        const entryName = `${folderName}/${String(ii + 1).padStart(3, "0")}_${safeFilename(it.name)}`;
        archive.append(body, { name: entryName });
      }
    }

    archive.finalize().catch((err) => {
      console.error("closeout archive.finalize failed", err);
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
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
