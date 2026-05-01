import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import {
  getAdminTeamView,
  getAdminWorkerDetailView,
} from "@/domain/loaders/time-entries";
import { AuthorizationError } from "@/domain/permissions";

import { AdminTimeTrackingShell } from "./admin-shell";
import "../../../../time-tracking.css";

export default async function SubcontractorTimeAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; worker?: string }>;
}) {
  const params = await searchParams;
  const weekOffset = params.week
    ? Math.max(-12, Math.min(0, parseInt(params.week, 10) || 0))
    : 0;
  const { session } = await requireServerSession();
  try {
    const team = await getAdminTeamView({ session, weekOffset });
    const workerDetail = params.worker
      ? await getAdminWorkerDetailView({
          session,
          workerId: params.worker,
          weekOffset,
        })
      : null;
    return (
      <AdminTimeTrackingShell team={team} workerDetail={workerDetail} />
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre style={{ padding: 24 }}>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
