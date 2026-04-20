import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getDrawingSetsIndex } from "@/domain/loaders/drawings";
import { AuthorizationError } from "@/domain/permissions";

import { AsBuiltToggle } from "./as-built-toggle";
import { SetRenameButton } from "./set-rename-button";
import { DisciplineTag } from "./sheet-thumbnail";
import { UploadSetButton } from "./upload-button";
import "./drawings.css";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const delta = Date.now() - then;
  const mins = Math.round(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const FileIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const ChevRightIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const EyeIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export default async function ContractorDrawingsSetsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  try {
    const view = await getDrawingSetsIndex({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
    });

    const portalBase =
      view.portal === "subcontractor"
        ? `/subcontractor/project/${projectId}`
        : `/contractor/project/${projectId}`;
    const isSub = view.portal === "subcontractor";

    // Version chain for the rail card. Groups sets by family and sorts
    // each group by version desc; the prototype shows only the current
    // project's primary family ("cd") but we show the longest chain so
    // multiple-family projects get the most-relevant rail card.
    const familyGroups = new Map<string, typeof view.sets>();
    for (const s of view.sets) {
      const arr = familyGroups.get(s.family) ?? [];
      arr.push(s);
      familyGroups.set(s.family, arr);
    }
    let longestChain: typeof view.sets = [];
    let longestChainFamily = "";
    familyGroups.forEach((arr, family) => {
      if (arr.length > longestChain.length) {
        longestChain = arr;
        longestChainFamily = family;
      }
    });
    longestChain = [...longestChain].sort((a, b) => b.version - a.version);

    return (
      <div className="dr-content">
        <div className="dr-page-hdr">
          <div>
            <h1 className="dr-page-title">Drawings</h1>
            <p className="dr-page-desc">
              Sheet management, markup, and version control. Uploaded sheet
              sets are split into per-sheet pages with auto-extracted sheet
              numbers. New versions supersede old ones — older versions remain
              accessible.
            </p>
          </div>
          <div className="dr-page-actions">
            {view.canUpload ? <UploadSetButton projectId={projectId} /> : null}
          </div>
        </div>

        {isSub ? (
          <div className="dr-sub-banner">
            <EyeIcon />
            <span>
              You&apos;re viewing as <strong>{view.context.organization.name}</strong>
              {" "}— scoped to your trade discipline. You can view all sets but
              markups and comments are limited to your scope.
            </span>
          </div>
        ) : null}

        {/* Summary strip — matches prototype: Active Sets / Total Sheets /
            Changed in current / Active Markups / Open Comments */}
        <div className="dr-summary">
          <div className="dr-sc strong">
            <div className="dr-sc-label">Active Sets</div>
            <div className="dr-sc-value">{view.aggregates.activeSets}</div>
            <div className="dr-sc-meta">
              {view.sets.length - view.aggregates.activeSets} superseded / historical
            </div>
          </div>
          <div className="dr-sc info">
            <div className="dr-sc-label">Total Sheets</div>
            <div className="dr-sc-value">{view.aggregates.totalSheetsCurrent}</div>
            <div className="dr-sc-meta">Across active sets</div>
          </div>
          <div className="dr-sc alert">
            <div className="dr-sc-label">Changed this version</div>
            <div className="dr-sc-value">{view.aggregates.changedInCurrent}</div>
            <div className="dr-sc-meta">vs. previous revision</div>
          </div>
          <div className="dr-sc teal">
            <div className="dr-sc-label">Active Markups</div>
            <div className="dr-sc-value">{view.aggregates.markupsAcrossCurrent}</div>
            <div className="dr-sc-meta">Team annotations</div>
          </div>
          <div className="dr-sc success">
            <div className="dr-sc-label">Open Comments</div>
            <div className="dr-sc-value">
              {view.aggregates.openCommentsAcrossCurrent}
            </div>
            <div className="dr-sc-meta">
              {view.aggregates.resolvedCommentsAcrossCurrent
                ? `${view.aggregates.resolvedCommentsAcrossCurrent} resolved`
                : "no resolved yet"}
            </div>
          </div>
        </div>

        <div className="dr-sets-grid">
          {/* Sets list */}
          <div className="dr-sets-list">
            {view.sets.length === 0 ? (
              <div className="dr-empty">
                <h3>No sheet sets yet</h3>
                <p>
                  Upload a multi-page PDF to create a new set. Sheet numbers
                  are auto-detected from the title block; misses can be edited
                  on the index page.
                </p>
                {view.canUpload ? <UploadSetButton projectId={projectId} /> : null}
              </div>
            ) : (
              view.sets.map((s) => {
                const iconClass =
                  s.family === "shell"
                    ? "shell"
                    : s.status === "current"
                      ? ""
                      : "old";
                return (
                  <Link
                    key={s.id}
                    href={`${portalBase}/drawings/${s.id}`}
                    className={`dr-set-card ${s.status}`}
                  >
                    <div className={`dr-set-icon ${iconClass}`}>
                      <FileIcon />
                    </div>
                    <div className="dr-set-body">
                      <div className="dr-set-title-row">
                        <span className="dr-set-title">{s.name}</span>
                        {view.canUpload ? (
                          <SetRenameButton
                            setId={s.id}
                            initialName={s.name}
                            initialNote={s.note}
                          />
                        ) : null}
                        <span className="dr-set-ver">v{s.version}</span>
                        {s.status === "current" ? (
                          <span className="dr-pill accent">Current</span>
                        ) : s.status === "superseded" ? (
                          <span className="dr-pill gray">Superseded</span>
                        ) : (
                          <span className="dr-pill gray">Historical</span>
                        )}
                        {view.canUpload ? (
                          <AsBuiltToggle
                            setId={s.id}
                            initialAsBuilt={s.asBuilt}
                          />
                        ) : s.asBuilt ? (
                          <span className="dr-pill green">As-built</span>
                        ) : null}
                        {s.processingStatus === "processing" ||
                        s.processingStatus === "pending" ? (
                          <span className="dr-pill orange">
                            {s.processingStatus === "processing"
                              ? "Extracting…"
                              : "Uploading…"}
                          </span>
                        ) : null}
                        {s.processingStatus === "failed" ? (
                          <span className="dr-pill red">Failed</span>
                        ) : null}
                      </div>
                      {s.note ? <p className="dr-set-note">{s.note}</p> : null}
                      <div className="dr-set-stats">
                        <div className="dr-set-stat">
                          <span className="dr-set-stat-k">Sheets</span>
                          <span className="dr-set-stat-v">{s.sheetCount}</span>
                        </div>
                        <div className="dr-set-stat">
                          <span className="dr-set-stat-k">Uploaded</span>
                          <span className="dr-set-stat-v">
                            {formatDate(s.uploadedAt)}
                          </span>
                        </div>
                        <div className="dr-set-stat">
                          <span className="dr-set-stat-k">By</span>
                          <span className="dr-set-stat-v">
                            {s.uploadedByName ?? "—"}
                          </span>
                        </div>
                        <div className="dr-set-stat">
                          <span className="dr-set-stat-k">Size</span>
                          <span className="dr-set-stat-v">
                            {formatFileSize(s.fileSizeBytes)}
                          </span>
                        </div>
                      </div>
                      {Object.keys(s.disciplines).length > 0 ? (
                        <div className="dr-set-disciplines">
                          {Object.entries(s.disciplines)
                            .filter(([code]) => code !== "?")
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([code, count]) => (
                              <DisciplineTag
                                key={code}
                                code={code}
                                count={count}
                              />
                            ))}
                          {s.disciplines["?"] ? (
                            <span
                              className="dr-set-disc-tag"
                              style={{
                                background: "var(--surface-2)",
                                color: "var(--text-tertiary)",
                                border: "1px solid var(--surface-3)",
                              }}
                            >
                              Other · {s.disciplines["?"]}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        color: "var(--text-tertiary)",
                        flexShrink: 0,
                      }}
                    >
                      <ChevRightIcon />
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Rail: version chain + recent activity */}
          <div className="dr-rail">
            {longestChain.length > 0 ? (
              <div className="dr-card">
                <div className="dr-card-hdr">
                  <h3>Version Chain</h3>
                  <span className="dr-pill gray">
                    {longestChainFamily.toUpperCase()}
                  </span>
                </div>
                <div className="dr-chain">
                  {longestChain.map((v) => (
                    <div
                      key={v.id}
                      className={`dr-chain-step${v.status === "current" ? " current" : ""}`}
                    >
                      <div className="dr-chain-dot">v{v.version}</div>
                      <div className="dr-chain-info">
                        <h5>
                          {v.name} v{v.version}
                          {v.status === "current" ? " — current" : ""}
                        </h5>
                        <p>
                          {formatDate(v.uploadedAt)}
                          {v.uploadedByName ? ` · ${v.uploadedByName}` : ""}
                          {v.fileSizeBytes
                            ? ` · ${formatFileSize(v.fileSizeBytes)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="dr-card">
              <div className="dr-card-hdr">
                <h3>Recent Activity</h3>
              </div>
              <div className="dr-activity">
                {view.activity.length === 0 ? (
                  <div className="dr-a-item">
                    <span className="dr-a-dot" />
                    <span className="dr-a-text">No activity yet.</span>
                  </div>
                ) : (
                  view.activity.map((a, i) => (
                    <div className="dr-a-item" key={`${a.time}-${i}`}>
                      <span className={`dr-a-dot ${a.color}`} />
                      <span className="dr-a-text">{a.text}</span>
                      <span className="dr-a-time">
                        {formatRelative(a.time)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }
}
