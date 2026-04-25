import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getTransmittal,
  type TransmittalDetail,
} from "@/domain/loaders/transmittals";
import { AuthorizationError } from "@/domain/permissions";

import { TransmittalDetailUI } from "./detail";
import "../../../../../transmittals.css";

export default async function ContractorTransmittalDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; transmittalId: string }>;
}) {
  const { projectId, transmittalId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let detail: TransmittalDetail | null = null;
  try {
    detail = await getTransmittal({
      session: session.session as unknown as { appUserId?: string | null },
      transmittalId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="tm-recipient-fail">Forbidden: {err.message}</pre>;
    }
    throw err;
  }
  if (!detail) notFound();

  // Drafts use the editor view, not this read-only detail.
  if (detail.status === "draft") {
    redirect(`/contractor/project/${projectId}/transmittals/${transmittalId}/draft`);
  }

  return (
    <div className="tm-content">
      <TransmittalDetailUI projectId={projectId} detail={detail} />
    </div>
  );
}
