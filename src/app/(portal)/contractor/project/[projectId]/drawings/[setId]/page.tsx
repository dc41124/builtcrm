import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  computeDisciplineCounts,
  getDrawingSetIndex,
} from "@/domain/loaders/drawings";
import { AuthorizationError } from "@/domain/permissions";

import "../drawings.css";
import { SheetIndexWorkspace } from "./workspace";

export default async function ContractorSheetIndexPage({
  params,
}: {
  params: Promise<{ projectId: string; setId: string }>;
}) {
  const { projectId, setId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getDrawingSetIndex({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
      setId,
    });
    const counts = computeDisciplineCounts(view.sheets);

    return (
      <SheetIndexWorkspace
        projectId={projectId}
        set={view.set}
        versionChain={view.versionChain}
        sheets={view.sheets}
        disciplineCounts={counts}
        scopeDiscipline={view.scopeDiscipline}
        portal={view.portal}
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
