import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documents } from "@/db/schema";
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
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let detail: TransmittalDetail | null = null;
  try {
    detail = await getTransmittal({
      session: session.session as unknown as { appUserId?: string | null },
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

  const docRows = await db
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
