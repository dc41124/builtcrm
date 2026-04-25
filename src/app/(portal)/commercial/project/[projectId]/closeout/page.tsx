import { notFound, redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { getCloseoutPackagesForProject } from "@/domain/loaders/closeout-packages";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../closeout-packages.css";
import { ClientCloseoutList } from "../../../../closeout-shared";

export default async function CommercialCloseoutPage({
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
          reviewHrefBase={`/commercial/project/${projectId}/closeout`}
          emptyTitle="No closeout package yet"
          emptySub="Your contractor will share the closeout package here when the project is ready for handover."
          vocab={{
            pageTitle: "Project closeout",
            pageSub:
              "When your project is ready for handover, the closeout package shows up here. Review each section, leave comments where needed, and sign off when you're satisfied.",
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
