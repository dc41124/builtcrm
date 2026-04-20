import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getDrawingSetsIndex } from "@/domain/loaders/drawings";
import { AuthorizationError } from "@/domain/permissions";

import "./drawings.css";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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

    const currents = view.sets.filter((s) => s.status === "current");
    const totalSheets = currents.reduce((a, s) => a + s.sheetCount, 0);
    const supersededCount = view.sets.filter(
      (s) => s.status === "superseded",
    ).length;
    const asBuiltCount = currents.filter((s) => s.asBuilt).length;
    const processingCount = view.sets.filter(
      (s) =>
        s.processingStatus === "pending" || s.processingStatus === "processing",
    ).length;

    return (
      <div className="dr-page">
        <div className="dr-page-hdr">
          <div>
            <h1 className="dr-page-title">Drawings</h1>
            <p className="dr-page-desc">
              Sheet sets, version chains, and markup. Upload a new PDF sheet set
              to supersede an existing version.
            </p>
          </div>
          <div className="dr-page-actions">
            {view.canUpload ? (
              <Link
                className="dr-btn primary"
                href={`${portalBase}/drawings/new`}
              >
                Upload sheet set
              </Link>
            ) : null}
          </div>
        </div>

        <div className="dr-summary">
          <div className="dr-sc strong">
            <div className="dr-sc-label">Current sets</div>
            <div className="dr-sc-value">{currents.length}</div>
            <div className="dr-sc-meta">{view.sets.length} total incl. history</div>
          </div>
          <div className="dr-sc info">
            <div className="dr-sc-label">Sheets in current</div>
            <div className="dr-sc-value">{totalSheets}</div>
            <div className="dr-sc-meta">Live sheet count</div>
          </div>
          <div className="dr-sc alert">
            <div className="dr-sc-label">Processing</div>
            <div className="dr-sc-value">{processingCount}</div>
            <div className="dr-sc-meta">
              {processingCount ? "Extraction in progress" : "All sets ready"}
            </div>
          </div>
          <div className="dr-sc success">
            <div className="dr-sc-label">As-built</div>
            <div className="dr-sc-value">{asBuiltCount}</div>
            <div className="dr-sc-meta">Closeout-ready</div>
          </div>
          <div className="dr-sc teal">
            <div className="dr-sc-label">Superseded</div>
            <div className="dr-sc-value">{supersededCount}</div>
            <div className="dr-sc-meta">History retained</div>
          </div>
        </div>

        <div className="dr-sets-grid">
          <div className="dr-sets-list">
            {view.sets.length === 0 ? (
              <div className="dr-empty">
                <h3>No sheet sets yet</h3>
                <p>
                  Upload a multi-page PDF to create a new set. Sheet numbers
                  are auto-detected from the title block; misses can be edited
                  on the index page.
                </p>
                {view.canUpload ? (
                  <Link
                    className="dr-btn primary"
                    href={`${portalBase}/drawings/new`}
                  >
                    Upload sheet set
                  </Link>
                ) : null}
              </div>
            ) : (
              view.sets.map((s) => (
                <Link
                  key={s.id}
                  className={`dr-set-card ${s.status}`}
                  href={`${portalBase}/drawings/${s.id}`}
                >
                  <div className="dr-set-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="dr-set-body">
                    <div className="dr-set-title-row">
                      <div className="dr-set-title">{s.name}</div>
                      <div className="dr-set-ver">v{s.version}</div>
                      {s.status === "current" ? (
                        <span className="dr-pill accent">Current</span>
                      ) : s.status === "superseded" ? (
                        <span className="dr-pill gray">Superseded</span>
                      ) : (
                        <span className="dr-pill gray">Historical</span>
                      )}
                      {s.asBuilt ? (
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
                    {s.note ? <div className="dr-set-note">{s.note}</div> : null}
                    <div className="dr-set-stats">
                      <div className="dr-set-stat">
                        <div className="dr-set-stat-k">Sheets</div>
                        <div className="dr-set-stat-v">{s.sheetCount}</div>
                      </div>
                      <div className="dr-set-stat">
                        <div className="dr-set-stat-k">Uploaded</div>
                        <div className="dr-set-stat-v">
                          {formatRelative(s.uploadedAt)}
                        </div>
                      </div>
                      <div className="dr-set-stat">
                        <div className="dr-set-stat-k">Size</div>
                        <div className="dr-set-stat-v">
                          {formatFileSize(s.fileSizeBytes)}
                        </div>
                      </div>
                      <div className="dr-set-stat">
                        <div className="dr-set-stat-k">By</div>
                        <div className="dr-set-stat-v">
                          {s.uploadedByName ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="dr-rail">
            <div className="dr-card">
              <div className="dr-card-hdr">
                <h3>Recent activity</h3>
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
                      <span className="dr-a-dot" />
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
