import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { ScheduleView } from "@/components/schedule-ui";
import { getScheduleView } from "@/domain/loaders/schedule";
import { AuthorizationError } from "@/domain/permissions";

// Single client route — renders the standard phase-grouped list for
// commercial clients and the softened residential timeline for residential
// clients. The loader returns the same shape; ScheduleView branches on role.
export default async function ClientSchedulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  let view;
  try {
    view = await getScheduleView({
      session: session,
      projectId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <main style={{ padding: 24 }}>
      <ScheduleView
        nowMs={Date.now()}
        projectId={view.project.id}
        projectName={view.project.name}
        role={view.role}
        canWrite={view.canWrite}
        milestones={view.milestones}
        dependencies={view.dependencies}
        phases={view.phases}
        stats={view.stats}
        overallProgressPct={view.overallProgressPct}
      />
    </main>
  );
}
