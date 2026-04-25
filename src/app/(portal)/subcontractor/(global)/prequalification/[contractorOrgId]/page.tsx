import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getSubPrequalFormView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../prequalification.css";
import { SubFormShell } from "./form-shell";

export default async function SubPrequalFormPage({
  params,
}: {
  params: Promise<{ contractorOrgId: string }>;
}) {
  const { contractorOrgId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  try {
    const view = await getSubPrequalFormView({
      session: sessionLike,
      contractorOrgId,
    });

    return (
      <div className="pq-content">
        <div className="pq-page-hdr">
          <div>
            <h1 className="pq-page-title">{view.contractorOrgName}</h1>
            <p className="pq-page-sub">
              {view.template.tradeCategory ?? "General"} prequalification ·{" "}
              {view.template.questionCount} questions ·{" "}
              {view.template.validityMonths == null
                ? "no expiry"
                : `${view.template.validityMonths}-month validity`}
            </p>
          </div>
          <div className="pq-page-acts">
            <Link
              className="pq-btn ghost"
              href="/subcontractor/prequalification"
            >
              ← All requests
            </Link>
          </div>
        </div>
        <SubFormShell view={view} />
      </div>
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="pq-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }
}
