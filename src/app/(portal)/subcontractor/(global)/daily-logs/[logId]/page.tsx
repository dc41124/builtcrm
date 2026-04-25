import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dailyLogs } from "@/db/schema";

// Sub-portal global "detail" route. The sub's daily-logs feed is cross-
// project, but the authoritative detail page lives under the project-
// scoped route (it inherits the project nav context + breadcrumb).
// This page's only job is: look up the log's projectId, redirect there.
//
// No authorization gate here — the destination page calls getDailyLog
// which throws AuthorizationError for anyone without access, and Next
// renders the 404 / forbidden shell.

export default async function SubcontractorGlobalLogRedirect({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  await requireServerSession();
  const [log] = await db
    .select({ projectId: dailyLogs.projectId })
    .from(dailyLogs)
    .where(eq(dailyLogs.id, logId))
    .limit(1);
  if (!log) notFound();

  redirect(
    `/subcontractor/project/${log.projectId}/daily-logs/${logId}`,
  );
}
