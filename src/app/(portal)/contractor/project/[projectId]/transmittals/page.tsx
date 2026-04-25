import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documents, projects } from "@/db/schema";
import {
  getTransmittalActivity,
  getTransmittals,
  type TransmittalActivityRow,
  type TransmittalListRow,
} from "@/domain/loaders/transmittals";
import { AuthorizationError } from "@/domain/permissions";

import { TransmittalsWorkspace, type ProjectDocPick } from "./workspace";
import "../../../../transmittals.css";

export default async function ContractorTransmittalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let rows: TransmittalListRow[] = [];
  let activity: TransmittalActivityRow[] = [];
  let projectName = "";
  try {
    const [view, act, projRow] = await Promise.all([
      getTransmittals({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
      }),
      getTransmittalActivity({
        session: session.session as unknown as { appUserId?: string | null },
        projectId,
        limit: 8,
      }),
      db
        .select({ name: projects.name })
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1),
    ]);
    rows = view.rows;
    activity = act;
    projectName = projRow[0]?.name ?? "";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="tm-recipient-fail">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  // Project documents grouped by category for the create-modal picker.
  // The picker mirrors the JSX prototype's collapsible folder list.
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
      <TransmittalsWorkspace
        projectId={projectId}
        projectName={projectName}
        rows={rows}
        activity={activity}
        projectDocs={projectDocs}
      />
    </div>
  );
}
