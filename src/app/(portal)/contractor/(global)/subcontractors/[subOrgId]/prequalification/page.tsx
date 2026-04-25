import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getPrequalSubcontractorHistoryView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";

import "../../../../../prequalification.css";
import { ReinviteButton } from "./reinvite-button";

export default async function ContractorSubPrequalHistoryPage({
  params,
}: {
  params: Promise<{ subOrgId: string }>;
}) {
  const { subOrgId } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");
  const sessionLike = sessionData.session;

  try {
    const view = await getPrequalSubcontractorHistoryView({
      session: sessionLike,
      subOrgId,
    });

    const subName = view.rows[0]?.submittedByOrgName ?? "Subcontractor";
    const active = view.rows.find(
      (r) => r.status === "approved" || r.status === "submitted" || r.status === "under_review",
    );

    return (
      <div className="pq-content">
        <div className="pq-page-hdr">
          <div>
            <h1 className="pq-page-title">{subName}</h1>
            <p className="pq-page-sub">
              All prequalification submissions from this subcontractor with
              your org. The newest at the top is the authoritative status.
            </p>
          </div>
          <div className="pq-page-acts">
            <Link className="pq-btn ghost" href="/contractor/prequalification">
              ← Queue
            </Link>
            <ReinviteButton subOrgId={subOrgId} />
          </div>
        </div>

        {active ? (
          <div
            className="pq-warn-banner"
            style={{
              background:
                active.status === "approved"
                  ? "var(--ok-soft)"
                  : "var(--wr-soft)",
              borderLeftColor:
                active.status === "approved" ? "var(--ok)" : "var(--wr)",
              color:
                active.status === "approved"
                  ? "var(--ok-text)"
                  : "var(--wr-text)",
              borderColor:
                active.status === "approved" ? "#b0dfc4" : "#f5d5a0",
              marginBottom: 16,
            }}
          >
            <strong>Active: {active.status.replace("_", " ")}</strong> · score{" "}
            {active.scoreTotal ?? "—"} / threshold {active.passThreshold}
            {active.expiresAt
              ? ` · expires ${new Date(active.expiresAt).toLocaleDateString()}`
              : ""}
          </div>
        ) : null}

        {view.rows.length === 0 ? (
          <div className="pq-empty">
            <div className="pq-empty-title">No history yet</div>
            <div className="pq-empty-sub">
              Invite this sub to prequalify to start the history.
            </div>
          </div>
        ) : (
          <div className="pq-table">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Submitted</th>
                  <th>Reviewed</th>
                  <th>Expires</th>
                  <th>Template</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`pq-pill ${pillFor(r.status)}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      {r.scoreTotal == null
                        ? "—"
                        : `${r.scoreTotal} / ${r.passThreshold}`}
                    </td>
                    <td>
                      {r.submittedAt
                        ? new Date(r.submittedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      {r.reviewedAt
                        ? new Date(r.reviewedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      {r.expiresAt
                        ? new Date(r.expiresAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{r.templateName}</td>
                    <td>
                      <Link
                        className="pq-btn xs"
                        href={`/contractor/prequalification/${r.id}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
