import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { ScheduleView } from "@/components/schedule-ui";
import { getScheduleView } from "@/domain/loaders/schedule";
import { AuthorizationError } from "@/domain/permissions";

export default async function ContractorSchedulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getScheduleView({
      session: session.session as unknown as { appUserId?: string | null },
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
        projectId={view.project.id}
        projectName={view.project.name}
        role={view.role}
        canWrite={view.canWrite}
        phases={view.phases}
        stats={view.stats}
        overallProgressPct={view.overallProgressPct}
      />
    </main>
  );
}
