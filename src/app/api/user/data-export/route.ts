import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { dataExports, roleAssignments } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeSystemAuditEvent } from "@/domain/audit";
import { buildUserExportManifest } from "@/lib/user-export/build";
import { sendDataExportReadyEmail } from "@/lib/user-export/email";
import { presignDownloadUrl, putObject } from "@/lib/storage";

// POST /api/user/data-export — request a GDPR Article 15 data export
// for the calling user. Re-auth gated (matches /api/user/delete via
// freshAge). The export is generated synchronously in v1 — the
// scoped table set is small enough that this completes in <5s for
// typical users. If volume grows, refactor to a Trigger.dev task.
//
// GET /api/user/data-export — list the caller's past export requests
// with status + (if ready and unexpired) a freshly-presigned download
// URL. Used by the settings page to render history.
//
// See docs/specs/user_deletion_and_export_plan.md.

const FRESH_AGE_MS = 60 * 60 * 24 * 1000; // 1 day; matches src/auth/config.ts freshAge
const EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7-day download window

function isFresh(session: { createdAt: unknown }): boolean {
  const ts = new Date(session.createdAt as string).getTime();
  return Date.now() - ts <= FRESH_AGE_MS;
}

export async function POST() {
  const { session } = await requireServerSession();
  if (!isFresh(session)) {
    return NextResponse.json(
      {
        error: "stale_session",
        message:
          "Re-authenticate to continue. For your protection we require a recent password entry before generating a data export.",
      },
      { status: 401 },
    );
  }

  const appUserId = session.appUserId;
  if (!appUserId) {
    return NextResponse.json(
      { error: "no_app_user" },
      { status: 400 },
    );
  }

  // dataExports.organizationId is NOT NULL — use the user's primary
  // role assignment (or first available) for the org context. The
  // export itself is user-scoped and spans data across every org the
  // user appears in; org context here is just for surfacing the
  // export in the right org's settings page history. Pre-tenant
  // resolution against RLS-enabled `role_assignments` — admin pool.
  const [primary] = await dbAdmin
    .select({ organizationId: roleAssignments.organizationId })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, appUserId))
    .orderBy(desc(roleAssignments.isPrimary))
    .limit(1);
  if (!primary) {
    return NextResponse.json(
      {
        error: "no_org",
        message: "You must belong to at least one organization to request a data export.",
      },
      { status: 409 },
    );
  }

  const expiresAt = new Date(Date.now() + EXPORT_TTL_MS);

  const [exportRow] = await withTenant(primary.organizationId, (tx) =>
    tx
      .insert(dataExports)
      .values({
        organizationId: primary.organizationId,
        requestedByUserId: appUserId,
        exportKind: "user_data_gdpr",
        status: "running",
        expiresAt,
        startedAt: new Date(),
      })
      .returning({ id: dataExports.id }),
  );

  await writeSystemAuditEvent({
    resourceType: "data_export",
    resourceId: exportRow.id,
    organizationId: primary.organizationId,
    action: "user.data_export_requested",
    details: {
      metadata: { exportKind: "user_data_gdpr", requestedByUserId: appUserId },
    },
  });

  try {
    const manifest = await buildUserExportManifest(appUserId, exportRow.id);
    const json = JSON.stringify(manifest, null, 2);
    const storageKey = `gdpr-exports/${appUserId}/${exportRow.id}.json`;
    await putObject({
      key: storageKey,
      body: json,
      contentType: "application/json",
    });

    await withTenant(primary.organizationId, (tx) =>
      tx
        .update(dataExports)
        .set({
          status: "ready",
          storageKey,
          completedAt: new Date(),
        })
        .where(eq(dataExports.id, exportRow.id)),
    );

    const downloadUrl = await presignDownloadUrl({
      key: storageKey,
      expiresInSeconds: 60 * 60 * 24 * 7,
    });

    // Email stub — when real email infra ships, this lands the link
    // in the user's inbox. For now they get it in the response.
    const [user] = await dbAdmin
      .select({ email: roleAssignments.userId })
      .from(roleAssignments)
      .where(eq(roleAssignments.userId, appUserId))
      .limit(1);
    void user;
    await sendDataExportReadyEmail({
      toEmail: "(see download URL in response)",
      downloadUrl,
      expiresAt,
    });

    await writeSystemAuditEvent({
      resourceType: "data_export",
      resourceId: exportRow.id,
      organizationId: primary.organizationId,
      action: "user.data_export_completed",
      details: { metadata: { storageKey, expiresAt: expiresAt.toISOString() } },
    });

    return NextResponse.json({
      exportId: exportRow.id,
      status: "ready",
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withTenant(primary.organizationId, (tx) =>
      tx
        .update(dataExports)
        .set({ status: "failed", errorMessage: message.slice(0, 500) })
        .where(eq(dataExports.id, exportRow.id)),
    );
    return NextResponse.json(
      { error: "export_failed", message: "Could not generate the export. Try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const { session } = await requireServerSession();
  const appUserId = session.appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "no_app_user" }, { status: 400 });
  }

  // Cross-org by design — a user's GDPR export history should include
  // every org they've ever belonged to (the row's organizationId is
  // just the org the export was filed under at the time, derived from
  // their then-primary role assignment). Wrapping in withTenant for
  // the user's CURRENT primary org would silently hide history filed
  // under a previous primary. Use the admin pool to read the truth.
  const rows = await dbAdmin
    .select({
      id: dataExports.id,
      status: dataExports.status,
      storageKey: dataExports.storageKey,
      expiresAt: dataExports.expiresAt,
      createdAt: dataExports.createdAt,
      completedAt: dataExports.completedAt,
      errorMessage: dataExports.errorMessage,
    })
    .from(dataExports)
    .where(
      and(
        eq(dataExports.requestedByUserId, appUserId),
        eq(dataExports.exportKind, "user_data_gdpr"),
      ),
    )
    .orderBy(desc(dataExports.createdAt));

  // Mint a fresh download URL for each ready+unexpired row.
  const now = Date.now();
  const enriched = await Promise.all(
    rows.map(async (r) => {
      const expiresAtMs = r.expiresAt ? r.expiresAt.getTime() : 0;
      let downloadUrl: string | null = null;
      if (
        r.status === "ready" &&
        r.storageKey &&
        expiresAtMs > now
      ) {
        try {
          downloadUrl = await presignDownloadUrl({
            key: r.storageKey,
            expiresInSeconds: Math.max(60, Math.floor((expiresAtMs - now) / 1000)),
          });
        } catch {
          downloadUrl = null;
        }
      }
      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        errorMessage: r.errorMessage,
        downloadUrl,
      };
    }),
  );

  return NextResponse.json({ exports: enriched });
}
