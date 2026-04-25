import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getPrequalTemplateDetailView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../../../prequalification.css";
import { TemplateEditor } from "./editor";

export default async function ContractorPrequalTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  try {
    const detail = await getPrequalTemplateDetailView({
      session: sessionLike,
      templateId,
    });
    return (
      <div className="pq-content">
        <div className="pq-page-hdr">
          <div>
            <h1 className="pq-page-title">{detail.name}</h1>
            <p className="pq-page-sub">
              {detail.tradeCategory ?? "General"} ·{" "}
              {detail.questionCount} questions · pass {detail.passThreshold}
            </p>
          </div>
          <div className="pq-page-acts">
            <Link
              className="pq-btn ghost"
              href="/contractor/settings/prequalification/templates"
            >
              ← Templates
            </Link>
          </div>
        </div>
        <TemplateEditor template={detail} />
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
