import { redirect } from "next/navigation";
import Link from "next/link";

import { getServerSession } from "@/auth/session";
import { loadUserPortalContext, portalLabel } from "@/domain/loaders/portals";

export default async function SelectPortalPage() {
  const sessionData = await getServerSession();
  if (!sessionData) {
    redirect("/login?next=/select-portal");
  }
  const { session, user } = sessionData;

  const appUserId = session.appUserId;
  if (!appUserId) {
    redirect("/login");
  }

  const ctx = await loadUserPortalContext(appUserId);

  if (ctx.options.length === 0) {
    return (
      <div className="auth-card">
        <h2>No portal access</h2>
        <p className="auth-sub">
          Your account isn&apos;t linked to any organization yet. Ask the
          person who invited you to send a fresh invitation.
        </p>
      </div>
    );
  }
  if (ctx.options.length === 1) {
    redirect(ctx.options[0].href);
  }

  return (
    <>
      <div className="auth-card">
        <h2>Where do you want to go?</h2>
        <p className="auth-sub">
          You have access to multiple portals. Choose one to continue, or jump
          directly into a project.
        </p>

        <div className="portal-grid">
          {ctx.options.map((opt) => {
            const label = portalLabel(opt);
            return (
              <Link
                key={opt.roleAssignmentId}
                href={opt.href}
                className="portal-option"
                style={{ textDecoration: "none" }}
              >
                <div
                  className="portal-dot-lg"
                  style={{ background: label.cssVar }}
                >
                  {label.initials}
                </div>
                <div className="portal-option-info">
                  <div className="portal-option-name">{label.name}</div>
                  <div className="portal-option-desc">
                    {opt.organizationName} · {opt.projectCount}{" "}
                    {opt.projectCount === 1 ? "project" : "projects"}
                  </div>
                </div>
                <span className="portal-option-arrow">→</span>
              </Link>
            );
          })}
        </div>

        {ctx.projectShortcuts.length > 0 ? (
          <div className="project-list">
            <div className="project-list-label">Or jump to a project</div>
            {ctx.projectShortcuts.map((s) => (
              <Link
                key={s.projectId + s.href}
                href={s.href}
                className="project-list-item"
                style={{ textDecoration: "none" }}
              >
                <span>{s.projectName}</span>
                <span className="pli-meta">{s.portalLabel}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="auth-footer">
        Signed in as <strong>{user.email}</strong>
      </div>
    </>
  );
}
