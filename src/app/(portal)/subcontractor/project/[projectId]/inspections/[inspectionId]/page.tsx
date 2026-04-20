import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getInspection } from "@/domain/loaders/inspections";
import { AuthorizationError } from "@/domain/permissions";

import { MobileWalkthrough } from "./walkthrough";
import "../../../../../inspections.css";

export default async function SubInspectionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; inspectionId: string }>;
}) {
  const { projectId, inspectionId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const detail = await getInspection({
      session: session.session as unknown as { appUserId?: string | null },
      inspectionId,
    });
    return (
      <MobileWalkthrough
        portalBase={`/subcontractor/project/${projectId}`}
        detail={detail}
      />
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="in-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
