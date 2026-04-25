import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getCloseoutPackage } from "@/domain/loaders/closeout-packages";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../../closeout-packages.css";
import { ClientCloseoutReview } from "../../../../../closeout-shared";

export default async function ResidentialCloseoutReviewPage({
  params,
}: {
  params: Promise<{ projectId: string; packageId: string }>;
}) {
  const { projectId, packageId } = await params;
  const { session } = await requireServerSession();
  const sessionLike = session;

  try {
    const pkg = await getCloseoutPackage({ session: sessionLike, packageId });
    return (
      <div className="cp-content">
        <ClientCloseoutReview
          pkg={pkg}
          backHref={`/residential/project/${projectId}/closeout`}
          signerSuggestion={pkg.acceptedSigner ?? ""}
        />
      </div>
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="cp-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }
}
