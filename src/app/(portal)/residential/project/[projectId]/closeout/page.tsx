import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getCloseoutPackagesForProject } from "@/domain/loaders/closeout-packages";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../closeout-packages.css";
import { ClientCloseoutList } from "../../../../closeout-shared";

export default async function ResidentialCloseoutPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();
  const sessionLike = session;

  try {
    const { rows } = await getCloseoutPackagesForProject({
      session: sessionLike,
      projectId,
    });
    return (
      <div className="cp-content">
        <ClientCloseoutList
          rows={rows}
          reviewHrefBase={`/residential/project/${projectId}/closeout`}
          emptyTitle="No handover package yet"
          emptySub="Your builder will share the final handover package here when your home is ready for sign-off."
          vocab={{
            pageTitle: "Final handover",
            pageSub:
              "When your home is ready for handover, your builder will share the final package here — manuals, warranties, permits, and as-built drawings. Review and accept when you're satisfied.",
          }}
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
