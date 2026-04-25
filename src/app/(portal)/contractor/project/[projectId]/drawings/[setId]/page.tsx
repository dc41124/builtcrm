import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  computeDisciplineCounts,
  getDrawingSetIndex,
} from "@/domain/loaders/drawings";
import { AuthorizationError } from "@/domain/permissions";

import "../drawings.css";
import { SheetIndexWorkspace } from "./workspace";
import { ThumbnailMinter } from "./thumbnail-minter";

export default async function ContractorSheetIndexPage({
  params,
}: {
  params: Promise<{ projectId: string; setId: string }>;
}) {
  const { projectId, setId } = await params;
  const { session } = await requireServerSession();
  try {
    const view = await getDrawingSetIndex({
      session: session,
      projectId,
      setId,
    });
    const counts = computeDisciplineCounts(view.sheets);

    const pendingSheets = view.sheets
      .filter((s) => !s.thumbnailUrl)
      .map((s) => ({ id: s.id, pageIndex: s.pageIndex }));

    return (
      <>
        <SheetIndexWorkspace
          projectId={projectId}
          set={view.set}
          versionChain={view.versionChain}
          sheets={view.sheets}
          disciplineCounts={counts}
          scopeDiscipline={view.scopeDiscipline}
          portal={view.portal}
          canEditSheets={view.canEditSheets}
        />
        {pendingSheets.length > 0 ? (
          <ThumbnailMinter
            sourceUrl={view.sourcePresignedUrl}
            pendingSheets={pendingSheets}
          />
        ) : null}
      </>
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
