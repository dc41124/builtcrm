import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import {
  FormTypeBadge,
  Icon,
  StatusPill,
  SAFETY_FORM_TYPE_CONFIG,
} from "@/app/(portal)/safety-forms-icons";
import "../../../../safety-forms.css";
import { getSubSafetyFormsView } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";

export default async function SubSafetyFormsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { session } = await requireServerSession();

  let view;
  try {
    view = await getSubSafetyFormsView({ session, projectId });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="sf-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  return (
    <div className="sf-content">
      <div className="sf-page-hdr">
        <div>
          <h1 className="sf-page-title">Safety forms</h1>
          <p className="sf-page-sub">Templates assigned to your crew. Click to begin.</p>
        </div>
      </div>

      <div className="sf-section-hdr">
        <div className="sf-section-title">Start a new form</div>
        <div className="sf-section-sub">
          {view.assignedTemplates.length === 0
            ? "No templates assigned yet — your GC will assign safety forms to your crew."
            : `${view.assignedTemplates.length} template${view.assignedTemplates.length === 1 ? "" : "s"} assigned.`}
        </div>
      </div>

      {view.assignedTemplates.length > 0 && (
        <div className="sf-tpl-grid">
          {view.assignedTemplates.map((t) => {
            const cfg = SAFETY_FORM_TYPE_CONFIG[t.formType];
            return (
              <Link
                key={t.id}
                href={`/subcontractor/project/${projectId}/safety-forms/new/${t.id}`}
                className="sf-tpl-card"
              >
                <div className="sf-tpl-card-hdr">
                  <FormTypeBadge type={t.formType} size="sm" />
                  <span className="sf-tpl-card-time">
                    ~{Math.max(1, Math.round(t.fieldCount * 0.7))} min
                  </span>
                </div>
                <div className="sf-tpl-card-name">{t.name}</div>
                <div className="sf-tpl-card-desc">{t.description ?? cfg.desc}</div>
                <div className="sf-tpl-card-foot">
                  <span>{t.fieldCount} fields</span>
                  <span className="sf-tpl-card-cta">
                    Start {Icon.chevR}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="sf-section-hdr" style={{ marginTop: 24 }}>
        <div className="sf-section-title">Your recent submissions</div>
        <div className="sf-section-sub">Forms you&apos;ve submitted on this project.</div>
      </div>

      <div className="sf-table-wrap">
        <table className="sf-table">
          <thead>
            <tr>
              <th style={{ width: 110 }}>ID</th>
              <th>Form</th>
              <th style={{ width: 140 }}>Type</th>
              <th style={{ width: 140 }}>Submitted</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {view.recentSubmissions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)", fontSize: 13 }}>
                  No submissions yet. Pick a template above to get started.
                </td>
              </tr>
            ) : (
              view.recentSubmissions.map((s) => (
                <tr key={s.id} style={{ cursor: "default" }}>
                  <td>
                    <span className="sf-table-num">{s.formNumber}</span>
                  </td>
                  <td>
                    <div className="sf-table-title">{s.title}</div>
                    {s.attendeesCount > 0 && (
                      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {s.attendeesCount} attendees
                      </div>
                    )}
                  </td>
                  <td>
                    <FormTypeBadge type={s.formType} size="sm" />
                  </td>
                  <td
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      fontFamily: "'JetBrains Mono',monospace",
                    }}
                  >
                    {s.submittedAt
                      ? s.submittedAt.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td>
                    <StatusPill status={s.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
