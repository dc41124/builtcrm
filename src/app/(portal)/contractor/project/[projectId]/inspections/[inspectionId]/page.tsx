import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getInspection } from "@/domain/loaders/inspections";
import { AuthorizationError } from "@/domain/permissions";

import { InspectionDetailView } from "./detail";
import "../../../../../inspections.css";

export default async function ContractorInspectionDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; inspectionId: string }>;
}) {
  const { projectId, inspectionId } = await params;
  const { session } = await requireServerSession();
  try {
    const detail = await getInspection({
      session: session,
      inspectionId,
    });
    return (
      <InspectionDetailView
        portal="contractor"
        portalBase={`/contractor/project/${projectId}`}
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
