import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getDailyLog,
  type DailyLogDetailRedacted,
} from "@/domain/loaders/daily-logs";
import { AuthorizationError } from "@/domain/permissions";

import { ResidentialJournalDetail } from "./journal-detail";

export default async function ResidentialJournalEntryPage({
  params,
}: {
  params: Promise<{ projectId: string; logId: string }>;
}) {
  const { projectId, logId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let log: DailyLogDetailRedacted;
  try {
    const result = await getDailyLog({
      session: session.session as unknown as { appUserId?: string | null },
      logId,
    });
    // Residential portal must receive the redacted shape. The loader
    // gates on role, so a residential_client session always returns
    // 'redacted' here. Defense-in-depth: 404 if shape unexpected.
    if (result.mode !== "redacted") {
      notFound();
    }
    log = result;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return <ResidentialJournalDetail projectId={projectId} log={log} />;
}
