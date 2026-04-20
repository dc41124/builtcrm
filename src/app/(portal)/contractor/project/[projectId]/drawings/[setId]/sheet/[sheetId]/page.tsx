import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getDrawingSheetDetail } from "@/domain/loaders/drawings";
import { AuthorizationError } from "@/domain/permissions";

import "../../../drawings.css";
import { SheetDetailWorkspace } from "./workspace";

export default async function ContractorSheetDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; setId: string; sheetId: string }>;
}) {
  const { projectId, setId, sheetId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getDrawingSheetDetail({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
      setId,
      sheetId,
    });

    return (
      <SheetDetailWorkspace
        projectId={projectId}
        set={view.set}
        versionChain={view.versionChain}
        sheet={view.sheet}
        sheetSiblings={view.sheetSiblings}
        markups={view.markups}
        measurements={view.measurements}
        comments={view.comments}
        calibration={view.calibration}
        presignedSourceUrl={view.presignedSourceUrl}
        portal={view.portal}
        canAnnotate={view.canAnnotate}
      />
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
