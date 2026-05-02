import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { loadSubProfileView } from "@/domain/loaders/sub-profile";
import { AuthorizationError } from "@/domain/permissions";

import { SubProfileRbqUI } from "./sub-profile-rbq-ui";

// Step 66 — Subcontractor profile page (RBQ verification surface).
//
// Built scope-tight: identity header + RBQ widget + side panel listing
// active assignments and a couple of placeholder compliance signals.
// The full sub profile (rating, message threads, document pack) is its
// own future module; this page is structured to host that content as it
// lands.

export const dynamic = "force-dynamic";

export default async function SubcontractorProfilePage({
  params,
}: {
  params: Promise<{ subOrgId: string }>;
}) {
  const { subOrgId } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  let isAdmin = false;
  let contractorOrgId: string;
  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    contractorOrgId = ctx.organization.id;
    isAdmin = ctx.role === "contractor_admin";
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div style={{ padding: 24, fontFamily: "'Instrument Sans',sans-serif" }}>
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }

  const view = await loadSubProfileView(subOrgId, contractorOrgId);
  if (!view) notFound();

  return (
    <SubProfileRbqUI
      subOrgId={subOrgId}
      view={view}
      isAdmin={isAdmin}
      prequalHref={`/contractor/subcontractors/${subOrgId}/prequalification`}
      backHref="/contractor/prequalification"
    />
  );
}

// Suppress unused-import warning for Link (kept for future link surfaces).
void Link;
