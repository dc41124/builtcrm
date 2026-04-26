import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import { documents } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import {
  getTransmittal,
  type TransmittalDetail,
} from "@/domain/loaders/transmittals";
import { AuthorizationError } from "@/domain/permissions";

import { TransmittalDraftEditor, type ProjectDocPick } from "./editor";
import "../../../../../../transmittals.css";

export default async function ContractorTransmittalDraftPage({
  params,
}: {
  params: Promise<{ projectId: string; transmittalId: string }>;
}) {
  const { projectId, transmittalId } = await params;
  const { session } = await requireServerSession();
  let detail: TransmittalDetail | null = null;
  let callerOrgId = "";
  try {
    const ctx = await getEffectiveContext(session, projectId);
    callerOrgId = ctx.organization.id;
    detail = await getTransmittal({
      session: session,
      transmittalId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="tm-recipient-fail">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
  if (!detail) notFound();

  // Sent transmittals use the read-only detail; bounce.
  if (detail.status !== "draft") {
    redirect(`/contractor/project/${projectId}/transmittals/${transmittalId}`);
  }

  const docRows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
        id: documents.id,
        title: documents.title,
        category: documents.category,
        fileSizeBytes: documents.fileSizeBytes,
      })
      .from(documents)
      .where(
        and(
          eq(documents.projectId, projectId),
          eq(documents.documentStatus, "active"),
        ),
      ),
  );

  const projectDocs: ProjectDocPick[] = docRows.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category ?? "other",
    sizeBytes: Number(d.fileSizeBytes ?? 0),
  }));

  return (
    <div className="tm-content">
      <TransmittalDraftEditor
        projectId={projectId}
        detail={detail}
        projectDocs={projectDocs}
      />
    </div>
  );
}
