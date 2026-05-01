import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import { SAFETY_FORM_TYPE_CONFIG } from "@/app/(portal)/safety-forms-icons";
import { getSubSafetyFormsView } from "@/domain/loaders/safety-forms";
import { loadPortalShell } from "@/lib/portal-shell";
import { AuthorizationError } from "@/domain/permissions";

import "../../m-safety.css";

// Mobile PWA — assigned templates + recent submissions for one project.
// Mirrors the prototype's "MOBILE · LIST" section (lines 1635–1703).
export default async function MobileSafetyFormsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ submitted?: string; queued?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const { session } = await requireServerSession();

  let view;
  let shell;
  try {
    view = await getSubSafetyFormsView({ session, projectId });
    shell = await loadPortalShell("subcontractor", projectId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login?next=/m/safety");
      return (
        <div style={{ padding: 24 }}>
          <pre style={{ fontSize: 13, color: "#c93b3b" }}>
            Forbidden: {err.message}
          </pre>
        </div>
      );
    }
    throw err;
  }

  const project = shell.projects.find((p) => p.id === projectId);
  const projectName = project?.name ?? "Project";
  const submittedToast = sp.submitted === "1";
  const queuedToast = sp.queued === "1";

  return (
    <div className="sfm-page">
      {/* Header */}
      <header className="sfm-hdr">
        <div className="sfm-hdr-top">
          <span>SAFETY FORMS</span>
          <Link href="/m" className="sfm-hdr-back">
            Home
          </Link>
        </div>
        <h1 className="sfm-hdr-title">Hi {shell.userName.split(" ")[0]}</h1>
        <div className="sfm-hdr-sub">
          {shell.orgName} · {projectName} ·{" "}
          {view.recentSubmissions.length} form
          {view.recentSubmissions.length === 1 ? "" : "s"} this month
        </div>
      </header>

      {(submittedToast || queuedToast) && (
        <div
          style={{
            margin: "14px 16px 0",
            padding: "11px 14px",
            borderRadius: 10,
            background: queuedToast
              ? "rgba(196,112,11,.11)"
              : "rgba(45,138,94,.12)",
            color: queuedToast ? "#c4700b" : "#2d8a5e",
            border: queuedToast
              ? "1px solid rgba(196,112,11,.22)"
              : "1px solid rgba(45,138,94,.22)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {queuedToast
            ? "Saved offline — will sync when you're back online."
            : "Submitted. Project admins notified."}
        </div>
      )}

      <div className="sfm-list-body">
        <div className="sfm-section-label">Start a new form</div>
        {view.assignedTemplates.length === 0 ? (
          <div className="sfm-empty">
            No templates assigned yet — your GC will assign safety forms
            to your crew.
          </div>
        ) : (
          view.assignedTemplates.map((t) => {
            const cfg = SAFETY_FORM_TYPE_CONFIG[t.formType];
            const minutes = Math.max(1, Math.round(t.fieldCount * 0.7));
            return (
              <Link
                key={t.id}
                href={`/m/safety/project/${projectId}/new/${t.id}`}
                className="sfm-tpl-card"
              >
                <div className="sfm-tpl-card-hdr">
                  <span
                    className="sfm-type-badge"
                    style={{
                      background: cfg.soft,
                      color: cfg.solid,
                      borderColor: cfg.soft,
                    }}
                  >
                    <span
                      className="sfm-type-dot"
                      style={{ background: cfg.solid }}
                    />
                    {cfg.short}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--text-tertiary)",
                      fontFamily: "'DM Sans',sans-serif",
                      fontWeight: 660,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    ~{minutes} min
                  </span>
                </div>
                <div className="sfm-tpl-card-name">{t.name}</div>
                <div className="sfm-tpl-card-desc">{t.description ?? cfg.desc}</div>
                <div className="sfm-tpl-card-foot">
                  <span>{t.fieldCount} fields</span>
                  <span
                    style={{
                      color: cfg.solid,
                      fontFamily: "'DM Sans',sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    Start →
                  </span>
                </div>
              </Link>
            );
          })
        )}

        <div className="sfm-section-label" style={{ marginTop: 8 }}>
          Recent submissions
        </div>
        {view.recentSubmissions.length === 0 ? (
          <div
            className="sfm-empty"
            style={{ padding: 22, fontStyle: "italic" }}
          >
            No submissions yet. Tap a template above to get started.
          </div>
        ) : (
          view.recentSubmissions.slice(0, 8).map((s) => {
            const cfg = SAFETY_FORM_TYPE_CONFIG[s.formType];
            return (
              <div key={s.id} className="sfm-recent-row">
                <span
                  className="sfm-type-badge"
                  style={{
                    background: cfg.soft,
                    color: cfg.solid,
                    borderColor: cfg.soft,
                  }}
                >
                  <span
                    className="sfm-type-dot"
                    style={{ background: cfg.solid }}
                  />
                  {cfg.short}
                </span>
                <div className="sfm-recent-text">
                  <div className="sfm-recent-num">{s.formNumber}</div>
                  <div className="sfm-recent-title">{s.title}</div>
                </div>
                <span
                  className={`sfm-status-pill ${
                    s.status === "submitted"
                      ? "sfm-status-ok"
                      : "sfm-status-muted"
                  }`}
                >
                  {s.status === "submitted" ? "Submitted" : "Draft"}
                </span>
              </div>
            );
          })
        )}

        {/* Project switcher when multi-project */}
        {shell.projects.length > 1 && (
          <>
            <div className="sfm-section-label" style={{ marginTop: 8 }}>
              Other projects
            </div>
            {shell.projects
              .filter((p) => p.id !== projectId)
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/m/safety/project/${p.id}`}
                  className="sfm-recent-row"
                >
                  <div className="sfm-recent-text">
                    <div className="sfm-recent-title">{p.name}</div>
                  </div>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 18 }}>›</span>
                </Link>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
