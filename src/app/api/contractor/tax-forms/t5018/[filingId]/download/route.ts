import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { t5018Filings } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";
import { presignDownloadUrl } from "@/lib/storage";

// Step 67 — Download a T5018 package artifact (zip | xml | csv) by
// filing id. Returns a presigned R2 URL the browser follows directly,
// so we never proxy multi-MB blobs through Node.

const ALLOWED_KINDS = ["zip", "xml", "csv"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

function isKind(value: string | null): value is Kind {
  return value === "zip" || value === "xml" || value === "csv";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ filingId: string }> },
) {
  return withErrorHandler(
    async () => {
      const { filingId } = await params;
      const url = new URL(req.url);
      const kindParam = url.searchParams.get("kind");
      if (!isKind(kindParam)) {
        return NextResponse.json(
          { error: "invalid_kind", allowed: ALLOWED_KINDS },
          { status: 400 },
        );
      }
      const kind: Kind = kindParam;

      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can download T5018 packages.",
          "forbidden",
        );
      }

      const rows = await dbAdmin
        .select({
          id: t5018Filings.id,
          contractorOrgId: t5018Filings.contractorOrgId,
          fiscalYear: t5018Filings.fiscalYear,
          zipStorageKey: t5018Filings.zipStorageKey,
          xmlStorageKey: t5018Filings.xmlStorageKey,
          csvStorageKey: t5018Filings.csvStorageKey,
        })
        .from(t5018Filings)
        .where(
          and(
            eq(t5018Filings.id, filingId),
            eq(t5018Filings.contractorOrgId, ctx.organization.id),
          ),
        )
        .limit(1);
      if (rows.length === 0) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      const filing = rows[0];

      const key =
        kind === "zip"
          ? filing.zipStorageKey
          : kind === "xml"
            ? filing.xmlStorageKey
            : filing.csvStorageKey;
      if (!key) {
        return NextResponse.json(
          { error: "artifact_missing", kind },
          { status: 404 },
        );
      }

      const presigned = await presignDownloadUrl({
        key,
        expiresInSeconds: 60,
      });

      await writeOrgAuditEvent(ctx, {
        resourceType: "t5018_filing",
        resourceId: filing.id,
        action: `tax.t5018.${kind}_downloaded`,
        details: {
          metadata: {
            fiscalYear: filing.fiscalYear,
            kind,
          },
        },
      });

      return NextResponse.json({ ok: true, url: presigned });
    },
    {
      path: "/api/contractor/tax-forms/t5018/[filingId]/download",
      method: "GET",
    },
  );
}
