import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
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
  // Pre-tenant: just resolving log id → project id for redirect.
  // The destination page does the full auth check via getDailyLog.
  const [log] = await dbAdmin
    .select({ projectId: dailyLogs.projectId })
    .from(dailyLogs)
    .where(eq(dailyLogs.id, logId))
    .limit(1);
  if (!log) notFound();

  redirect(
    `/subcontractor/project/${log.projectId}/daily-logs/${logId}`,
  );
}
