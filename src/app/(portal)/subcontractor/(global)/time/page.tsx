import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { getWorkerWeekView } from "@/domain/loaders/time-entries";
import { AuthorizationError } from "@/domain/permissions";

import { WorkerTimeTrackingShell } from "./time-shell";
import "../../../time-tracking.css";

export default async function SubcontractorTimePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const weekOffset = params.week
    ? Math.max(-12, Math.min(0, parseInt(params.week, 10) || 0))
    : 0;
  const { session } = await requireServerSession();
  try {
    const view = await getWorkerWeekView({ session, weekOffset });
    return <WorkerTimeTrackingShell view={view} />;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre style={{ padding: 24 }}>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
