import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

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
  const { session } = await requireServerSession();
  try {
    const view = await getDrawingSheetDetail({
      session: session,
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
        photoPins={view.photoPins}
        calibration={view.calibration}
        presignedSourceUrl={view.presignedSourceUrl}
        compare={view.compare}
        portal={view.portal}
        canAnnotate={view.canAnnotate}
        canCalibrate={view.canCalibrate}
        currentUserId={view.currentUserId}
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
