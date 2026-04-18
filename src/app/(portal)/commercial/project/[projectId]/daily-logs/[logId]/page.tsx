import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getDailyLog,
  type DailyLogDetailRedacted,
} from "@/domain/loaders/daily-logs";
import { AuthorizationError } from "@/domain/permissions";

import { CommercialDailyLogDetail } from "./log-detail";

export default async function CommercialDailyLogDetailPage({
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
    // Commercial portal must receive the redacted shape — the loader
    // decides based on the session's effective role, so a client
    // always gets `mode: 'redacted'` back. If somehow we got 'full',
    // the caller is in the wrong portal — 404 rather than leak.
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

  return <CommercialDailyLogDetail projectId={projectId} log={log} />;
}
