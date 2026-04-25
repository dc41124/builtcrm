"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  CO_ICONS,
  fmtSizeBig,
  initials,
  statusLabel,
} from "@/app/(portal)/closeout-icons";
import type {
  CloseoutActivityRow,
  CloseoutPackageListRow,
  CloseoutStatus,
} from "@/domain/loaders/closeout-packages";

type Filter = "all" | CloseoutStatus;

export function CloseoutWorkspace({
  projectId,
  projectName,
  rows,
  activity,
}: {
  projectId: string;
  projectName: string;
  rows: CloseoutPackageListRow[];
  activity: CloseoutActivityRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [creating, startCreate] = useTransition();

  // Restrict to packages on THIS project (loader already does that).
  const onProject = useMemo(
    () => rows.filter((r) => r.projectId === projectId),
    [rows, projectId],
  );

  const filtered = useMemo(() => {
    let out = onProject;
    if (filter !== "all") out = out.filter((r) => r.status === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (r) =>
          r.numberLabel.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.projectName.toLowerCase().includes(q),
      );
    }
    return out;
  }, [onProject, filter, search]);

  const counts = useMemo(
    () => ({
      total: onProject.length,
      building: onProject.filter((r) => r.status === "building").length,
      review: onProject.filter((r) => r.status === "review").length,
      delivered: onProject.filter((r) => r.status === "delivered").length,
      accepted: onProject.filter((r) => r.status === "accepted").length,
    }),
    [onProject],
  );

  const handleCreate = () => {
    startCreate(async () => {
      const res = await fetch("/api/closeout-packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`Failed to create package: ${txt}`);
        return;
      }
      const json = (await res.json()) as { id: string };
      router.push(
        `/contractor/project/${projectId}/closeout-packages/${json.id}`,
      );
      router.refresh();
    });
  };

  return (
    <>
      <div className="cp-page-hdr">
        <div>
          <h1 className="cp-page-title">Closeout packages</h1>
          <div className="cp-page-sub">
            Final handover deliverables for <strong>{projectName}</strong> —
            O&amp;M manuals, warranties, as-builts, permits, and testing
            records bundled into a single owner deliverable.
          </div>
        </div>
        <button
          className="cp-btn primary"
          onClick={handleCreate}
          disabled={creating}
        >
          {CO_ICONS.plus} {creating ? "Creating…" : "New package"}
        </button>
      </div>

      <div className="cp-kpi-strip">
        <div className="cp-kpi">
          <div className="cp-kpi-label">In progress</div>
          <div className="cp-kpi-value">{counts.building}</div>
          <div className="cp-kpi-sub">currently building</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi-label">Internal review</div>
          <div className="cp-kpi-value">{counts.review}</div>
          <div className="cp-kpi-sub">QA before send</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi-label">Delivered</div>
          <div
            className={`cp-kpi-value${counts.delivered > 0 ? " accent" : ""}`}
          >
            {counts.delivered}
          </div>
          <div className="cp-kpi-sub">awaiting client sign-off</div>
        </div>
        <div className="cp-kpi">
          <div className="cp-kpi-label">Accepted</div>
          <div className="cp-kpi-value ok">{counts.accepted}</div>
          <div className="cp-kpi-sub">project closed out</div>
        </div>
      </div>

      <div className="cp-filter-bar">
        <div className="cp-search">
          {CO_ICONS.search}
          <input
            type="text"
            placeholder="Search by package number or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="cp-status-filter">
          {(
            [
              { key: "all", label: "All", count: counts.total },
              { key: "building", label: "Building", count: counts.building },
              { key: "review", label: "Review", count: counts.review },
              { key: "delivered", label: "Delivered", count: counts.delivered },
              { key: "accepted", label: "Accepted", count: counts.accepted },
            ] as Array<{ key: Filter; label: string; count: number }>
          ).map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "active" : ""}
              onClick={() => setFilter(f.key)}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      <div className="cp-workspace-grid">
        <div className="cp-package-grid">
          {filtered.length === 0 && (
            <div className="cp-empty">
              <div className="cp-empty-icon">{CO_ICONS.pkg}</div>
              <div className="cp-empty-title">
                {onProject.length === 0
                  ? "No closeout packages yet"
                  : "No packages match"}
              </div>
              <div className="cp-empty-sub">
                {onProject.length === 0
                  ? "Click “New package” to start assembling the project handover."
                  : "Try clearing the filter or search."}
              </div>
            </div>
          )}
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/contractor/project/${projectId}/closeout-packages/${p.id}`}
              className={`cp-pkg-card status-${p.status}`}
            >
              <div className="cp-pkg-card-hdr">
                <span className={`cp-status-pill ${p.status}`}>
                  {p.status === "building" && CO_ICONS.edit}
                  {p.status === "review" && CO_ICONS.shield}
                  {p.status === "delivered" && CO_ICONS.send}
                  {p.status === "accepted" && CO_ICONS.check}
                  {statusLabel(p.status)}
                </span>
                <span className="cp-pkg-num">{p.numberLabel}</span>
              </div>
              <div>
                <div className="cp-pkg-project-name">{p.title}</div>
                <div className="cp-pkg-project-meta">
                  <span>{CO_ICONS.user}Prepared by {p.preparedByName ?? "—"}</span>
                  {p.preparedByOrgName ? (
                    <span className="cp-pkg-project-addr">
                      {p.preparedByOrgName}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="cp-pkg-progress">
                <div className="cp-pkg-progress-row">
                  <span className="cp-pkg-progress-label">
                    {p.status === "accepted" ? "Final" : "Completion"}
                  </span>
                  <span className="cp-pkg-progress-pct">
                    {p.completionPct}%
                  </span>
                </div>
                <div className="cp-pkg-progress-track">
                  <div
                    className={`cp-pkg-progress-fill status-${p.status}`}
                    style={{ width: `${p.completionPct}%` }}
                  />
                </div>
              </div>
              <div className="cp-pkg-card-stats">
                <div className="cp-pkg-stat">
                  <span className="cp-pkg-stat-value">{p.sectionsCount}</span>
                  <span className="cp-pkg-stat-label">sections</span>
                </div>
                <div className="cp-pkg-stat">
                  <span className="cp-pkg-stat-value">{p.docsCount}</span>
                  <span className="cp-pkg-stat-label">documents</span>
                </div>
                <div className="cp-pkg-stat">
                  <span className="cp-pkg-stat-value">
                    {fmtSizeBig(p.totalSizeBytes)}
                  </span>
                  <span className="cp-pkg-stat-label">bundle</span>
                </div>
              </div>
              <div className="cp-pkg-card-ftr">
                {p.status === "building" && (
                  <span>{CO_ICONS.edit} Assembling — drag in documents</span>
                )}
                {p.status === "review" && (
                  <span>{CO_ICONS.shield} Internal QA in progress</span>
                )}
                {p.status === "delivered" && p.deliveredAt && (
                  <span>
                    {CO_ICONS.send} Delivered{" "}
                    {new Date(p.deliveredAt).toLocaleDateString()}
                  </span>
                )}
                {p.status === "accepted" && p.acceptedAt && (
                  <span className="cp-pkg-accepted">
                    {CO_ICONS.award} Accepted by {p.acceptedSigner ?? "client"}{" "}
                    · {new Date(p.acceptedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <aside className="cp-rail">
          <div className="cp-rail-hdr">
            <h3>Recent activity</h3>
          </div>
          <div className="cp-rail-body">
            {activity.length === 0 && (
              <div className="cp-rail-item">
                <div className="cp-rail-item-body">
                  <div className="cp-rail-item-text">
                    No activity yet. New packages, edits, deliveries, and
                    sign-offs show up here.
                  </div>
                </div>
              </div>
            )}
            {activity.map((a, idx) => (
              <div key={idx} className="cp-rail-item">
                <div className="cp-rail-avatar">{initials(a.actorName)}</div>
                <div className="cp-rail-item-body">
                  <div className="cp-rail-item-text">
                    <strong>{a.actorName ?? "Someone"}</strong> · {a.title}
                  </div>
                  {a.body ? (
                    <div className="cp-rail-item-target">{a.body}</div>
                  ) : null}
                  <div className="cp-rail-item-when">
                    {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
