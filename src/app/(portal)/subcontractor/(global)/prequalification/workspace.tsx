"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { SubPrequalListRow } from "@/domain/loaders/prequal";

type Tab = "open" | "submitted" | "decided";

export function SubListWorkspace({
  rows,
  tab,
}: {
  rows: SubPrequalListRow[];
  tab: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const setTab = (next: Tab) => {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", next);
    router.push(`/subcontractor/prequalification?${params.toString()}`);
  };

  const counts = useMemo(() => {
    return {
      open: rows.filter(
        (r) =>
          r.latestStatus == null ||
          r.latestStatus === "draft" ||
          r.latestStatus === "rejected" ||
          r.latestStatus === "expired",
      ).length,
      submitted: rows.filter(
        (r) =>
          r.latestStatus === "submitted" || r.latestStatus === "under_review",
      ).length,
      decided: rows.filter(
        (r) =>
          r.latestStatus === "approved" ||
          r.latestStatus === "rejected" ||
          r.latestStatus === "expired",
      ).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === "submitted")
      return rows.filter(
        (r) =>
          r.latestStatus === "submitted" || r.latestStatus === "under_review",
      );
    if (tab === "decided")
      return rows.filter(
        (r) =>
          r.latestStatus === "approved" ||
          r.latestStatus === "rejected" ||
          r.latestStatus === "expired",
      );
    return rows.filter(
      (r) =>
        r.latestStatus == null ||
        r.latestStatus === "draft" ||
        r.latestStatus === "rejected" ||
        r.latestStatus === "expired",
    );
  }, [rows, tab]);

  const toStartCount = rows.filter(
    (r) => r.latestStatus == null || r.latestStatus === "draft",
  ).length;
  const inProgressCount = rows.filter(
    (r) => r.latestStatus === "draft",
  ).length;
  const submittedCount = counts.submitted;
  const approvedCount = rows.filter(
    (r) => r.latestStatus === "approved",
  ).length;

  return (
    <>
      <div className="pq-page-hdr">
        <div>
          <h1 className="pq-page-title">Prequalification</h1>
          <p className="pq-page-sub">
            Complete prequalification forms from contractors who&apos;ve
            invited you. Approval lets you be assigned to projects without
            delay; expiry tracks when you&apos;ll need to refresh.
          </p>
        </div>
      </div>

      <div className="pq-stat-strip">
        <button
          type="button"
          className={`pq-stat danger clickable${tab === "open" ? " on" : ""}`}
          onClick={() => setTab("open")}
        >
          <div className="pq-stat-label">To start</div>
          <div className="pq-stat-value">{toStartCount}</div>
          <div className="pq-stat-meta">awaiting your input</div>
        </button>
        <button
          type="button"
          className={`pq-stat alert clickable${tab === "open" ? " on" : ""}`}
          onClick={() => setTab("open")}
        >
          <div className="pq-stat-label">In progress</div>
          <div className="pq-stat-value">{inProgressCount}</div>
          <div className="pq-stat-meta">drafts in flight</div>
        </button>
        <button
          type="button"
          className={`pq-stat strong clickable${tab === "submitted" ? " on" : ""}`}
          onClick={() => setTab("submitted")}
        >
          <div className="pq-stat-label">Submitted</div>
          <div className="pq-stat-value">{submittedCount}</div>
          <div className="pq-stat-meta">awaiting GC review</div>
        </button>
        <button
          type="button"
          className={`pq-stat success clickable${tab === "decided" ? " on" : ""}`}
          onClick={() => setTab("decided")}
        >
          <div className="pq-stat-label">Approved</div>
          <div className="pq-stat-value">{approvedCount}</div>
          <div className="pq-stat-meta">in good standing</div>
        </button>
      </div>

      <div className="pq-ws">
        <div className="pq-ws-head">
          <div>
            <h3>Contractor prequalifications</h3>
            <div className="pq-ws-sub">One submission per contractor.</div>
          </div>
        </div>
        <div className="pq-ws-tabs">
          {(
            [
              ["open", "Open", counts.open],
              ["submitted", "Submitted", counts.submitted],
              ["decided", "Decided", counts.decided],
            ] as const
          ).map(([key, label, c]) => (
            <button
              key={key}
              className={`pq-tab${tab === key ? " on" : ""}`}
              onClick={() => setTab(key as Tab)}
            >
              {label}
              <span className="pq-tab-c">{c}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: "16px 20px 20px" }}>
          {filtered.length === 0 ? (
            <div className="pq-empty">
              <div className="pq-empty-title">
                {tab === "open"
                  ? "No invitations open"
                  : tab === "submitted"
                    ? "Nothing in review"
                    : "No history yet"}
              </div>
              <div className="pq-empty-sub">
                {tab === "open"
                  ? "When a contractor invites you to prequalify, the request lands here."
                  : "Submissions awaiting GC review appear here."}
              </div>
            </div>
          ) : (
            <div className="pq-tl" style={{ maxHeight: "none" }}>
              {filtered.map((r) => (
                <Link
                  key={r.contractorOrgId}
                  className="pq-rcd"
                  href={`/subcontractor/prequalification/${r.contractorOrgId}`}
                  style={{ textDecoration: "none" }}
                >
                  <div className="pq-rcd-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="pq-rcd-org">{r.contractorOrgName}</div>
                      <div className="pq-rcd-title">
                        {labelFor(r.latestStatus)}
                      </div>
                      <div className="pq-rcd-desc">
                        {r.latestExpiresAt
                          ? `Expires ${new Date(r.latestExpiresAt).toLocaleDateString()}`
                          : r.latestSubmittedAt
                            ? `Submitted ${new Date(r.latestSubmittedAt).toLocaleDateString()}`
                            : "Awaiting your input."}
                      </div>
                    </div>
                    <span className={`pq-pill ${pillFor(r.latestStatus)}`}>
                      {r.latestStatus
                        ? r.latestStatus.replace("_", " ")
                        : "Not started"}
                    </span>
                  </div>
                  <div className="pq-rcd-foot">
                    <span>Validity: 12 mo once approved</span>
                    <span>
                      {r.latestSubmittedAt
                        ? new Date(r.latestSubmittedAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function pillFor(status: string | null): string {
  if (!status) return "";
  return (
    {
      draft: "",
      submitted: "blue",
      under_review: "blue",
      approved: "green",
      rejected: "red",
      expired: "red",
    }[status] ?? ""
  );
}

function labelFor(status: string | null): string {
  if (!status) return "Not started yet — awaiting your input.";
  return (
    {
      draft: "Draft in progress — pick up where you left off.",
      submitted: "Submitted — awaiting contractor review.",
      under_review: "Under review by the contractor.",
      approved: "Approved — you're in good standing.",
      rejected: "Rejected — see contractor notes.",
      expired: "Expired — submit again to renew.",
    }[status] ?? "—"
  );
}
