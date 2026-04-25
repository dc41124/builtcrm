import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getPrequalSubmissionDetailView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PrequalReviewPanel } from "@/components/prequal/PrequalReviewPanel";
import { PrequalFormRenderer } from "@/components/prequal/PrequalFormRenderer";

import "../../../../prequalification.css";

export default async function ContractorPrequalReviewDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");
  const sessionLike = sessionData.session;

  try {
    const detail = await getPrequalSubmissionDetailView({
      session: sessionLike,
      submissionId,
    });

    return (
      <div className="pq-content">
        <div className="pq-page-hdr">
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span className={`pq-pill ${pillFor(detail.status)}`}>
                {detail.status.replace("_", " ")}
              </span>
              <span className="pq-pill accent">
                {detail.tradeCategory ?? "General"}
              </span>
              {detail.hasGatingFailures ? (
                <span className="pq-pill red">
                  {detail.gatingFailures.length} gating fail
                  {detail.gatingFailures.length === 1 ? "" : "s"}
                </span>
              ) : null}
              <span className="pq-pill">
                {detail.documents.length} doc
                {detail.documents.length === 1 ? "" : "s"}
              </span>
            </div>
            <h1 className="pq-page-title">
              {detail.submittedByOrgName}
            </h1>
            <p className="pq-page-sub">
              {detail.templateName} · submitted{" "}
              {detail.submittedAt
                ? new Date(detail.submittedAt).toLocaleString()
                : "—"}
            </p>
          </div>
          <div className="pq-page-acts">
            <Link className="pq-btn ghost" href="/contractor/prequalification">
              ← Queue
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 380px",
            gap: 16,
            alignItems: "start",
          }}
          className="pq-detail-grid"
        >
          <div className="pq-detail">
            <div className="pq-detail-hdr">
              <h2 className="pq-detail-title">Answers</h2>
              <div className="pq-detail-org">
                Sub org · {detail.submittedByOrgId.slice(0, 8)}…
              </div>
            </div>
            <PrequalFormRenderer
              questions={detail.template.questions}
              answers={detail.answers}
              mode="review"
            />
            {detail.documents.length > 0 ? (
              <div className="pq-form-section">
                <h4>Supporting documents</h4>
                <div className="pq-doc-list">
                  {detail.documents.map((d) => (
                    <DocumentLink key={d.id} doc={d} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside>
            <PrequalReviewPanel submission={detail} />
          </aside>
        </div>
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

function pillFor(status: string): string {
  return (
    {
      draft: "",
      submitted: "orange",
      under_review: "blue",
      approved: "green",
      rejected: "red",
      expired: "red",
    }[status as string] ?? ""
  );
}

function DocumentLink({
  doc,
}: {
  doc: {
    id: string;
    documentType: string;
    title: string;
    fileSizeBytes: number;
    label: string | null;
    createdAt: string;
  };
}) {
  const sizeMb = doc.fileSizeBytes / (1024 * 1024);
  const sizeStr =
    sizeMb >= 1
      ? `${sizeMb.toFixed(1)} MB`
      : `${Math.round(doc.fileSizeBytes / 1024)} KB`;
  return (
    <a
      className="pq-doc-row"
      href={`/api/prequal/documents/${doc.id}`}
      target="_blank"
      rel="noreferrer"
    >
      <div className="pq-doc-type">{doc.documentType.replace("_", " ")}</div>
      <div>
        <div className="pq-doc-title">{doc.title}</div>
        <div className="pq-doc-meta">
          {sizeStr} · {new Date(doc.createdAt).toLocaleDateString()}
          {doc.label ? ` · ${doc.label}` : ""}
        </div>
      </div>
      <div className="pq-btn xs">Open</div>
    </a>
  );
}
