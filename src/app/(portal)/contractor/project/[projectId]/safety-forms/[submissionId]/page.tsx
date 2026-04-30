import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import {
  FormTypeBadge,
  Icon,
  SeverityPill,
  StatusPill,
} from "@/app/(portal)/safety-forms-shared";
import "../../../../../safety-forms.css";
import { getSafetyFormDetail } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";

export default async function ContractorSafetyFormDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; submissionId: string }>;
}) {
  const { projectId, submissionId } = await params;
  const { session } = await requireServerSession();

  let detail;
  try {
    detail = await getSafetyFormDetail({ session, formId: submissionId });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      if (err.code === "not_found") redirect(`/contractor/project/${projectId}/safety-forms`);
      return <pre className="sf-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const { form, incident } = detail;

  return (
    <div className="sf-content">
      <div className="sf-page-hdr">
        <div>
          <Link
            href={`/contractor/project/${projectId}/safety-forms`}
            className="sf-btn ghost"
            style={{ marginBottom: 8 }}
          >
            {Icon.back} Back to all submissions
          </Link>
          <h1 className="sf-page-title">{form.title}</h1>
          <div className="sf-detail-meta">
            <span className="sf-detail-meta-item" style={{ fontFamily: "'JetBrains Mono',monospace" }}>
              {form.formNumber}
            </span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <FormTypeBadge type={form.formType} size="sm" />
            {incident && <SeverityPill severity={incident.severity} />}
            <StatusPill status={form.status} />
          </div>
        </div>
        <div className="sf-page-actions">
          <button className="sf-btn" type="button">
            {Icon.download} Export PDF
          </button>
          <button className="sf-btn" type="button">
            {Icon.copy} Duplicate
          </button>
          <button className="sf-btn" type="button">
            {Icon.send} Forward
          </button>
        </div>
      </div>

      <div className="sf-detail">
        <div className="sf-detail-main">
          <div className="sf-detail-card">
            <div className="sf-detail-section">
              <h3>Submission summary</h3>
              <div className="sf-detail-row">
                <span className="sf-detail-key">Submitted by</span>
                <span className="sf-detail-val">
                  {form.submittedByUserName} ·{" "}
                  <span style={{ color: "var(--text-secondary)" }}>{form.submittedByOrgName}</span>
                </span>
              </div>
              <div className="sf-detail-row">
                <span className="sf-detail-key">Submitted at</span>
                <span
                  className="sf-detail-val"
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}
                >
                  {form.submittedAt
                    ? form.submittedAt.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "Draft"}
                </span>
              </div>
              <div className="sf-detail-row">
                <span className="sf-detail-key">Project</span>
                <span className="sf-detail-val">{form.projectName}</span>
              </div>
              <div className="sf-detail-row">
                <span className="sf-detail-key">Template</span>
                <span className="sf-detail-val">{form.templateName}</span>
              </div>
            </div>
          </div>

          {incident && (
            <div className="sf-detail-card">
              <div className="sf-detail-section">
                <h3>Incident details</h3>
                <div className="sf-detail-row">
                  <span className="sf-detail-key">Severity</span>
                  <span className="sf-detail-val">
                    <SeverityPill severity={incident.severity} />
                  </span>
                </div>
                <div className="sf-detail-row">
                  <span className="sf-detail-key">Date &amp; time</span>
                  <span
                    className="sf-detail-val"
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5 }}
                  >
                    {incident.incidentAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="sf-detail-row">
                  <span className="sf-detail-key">Location</span>
                  <span className="sf-detail-val">{incident.location}</span>
                </div>
              </div>

              {incident.injured.length > 0 && (
                <div className="sf-detail-section">
                  <h3>Injured / affected parties</h3>
                  {incident.injured.map((p, i) => (
                    <div key={i} className="sf-injured-card">
                      <div className="sf-injured-card-name">{p.name}</div>
                      {p.role && <div className="sf-injured-card-role">{p.role}</div>}
                      {(p.bodyPart || p.nature) && (
                        <div className="sf-injured-card-injury">
                          {p.bodyPart && <strong>{p.bodyPart}:</strong>} {p.nature}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {incident.description && (
                <div className="sf-detail-section">
                  <h3>What happened</h3>
                  <p className="sf-detail-prose">{incident.description}</p>
                </div>
              )}

              {incident.rootCauseText && (
                <div className="sf-detail-section">
                  <h3>Root cause analysis</h3>
                  <p className="sf-detail-prose">{incident.rootCauseText}</p>
                </div>
              )}

              {incident.correctiveActions.length > 0 && (
                <div className="sf-detail-section">
                  <h3>Corrective actions</h3>
                  {incident.correctiveActions.map((ca) => (
                    <div key={ca.id} className="sf-action-card">
                      <span className="sf-action-text">{ca.action}</span>
                      <span className="sf-action-owner">{ca.owner}</span>
                      <span className="sf-action-due">due {ca.due}</span>
                    </div>
                  ))}
                </div>
              )}

              {incident.photoCount > 0 && (
                <div className="sf-detail-section">
                  <h3>Photos · {incident.photoCount}</h3>
                  <div className="sf-photo-grid">
                    {Array.from({ length: incident.photoCount }).map((_, i) => (
                      <div key={i} className="sf-photo-tile has-img">
                        {Icon.camera}
                        <span className="sf-photo-tile-label">IMG_{1234 + i}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generic non-incident: render the field answers from data_json. */}
          {!incident && form.templateFields.length > 0 && (
            <div className="sf-detail-card">
              <div className="sf-detail-section">
                <h3>Form contents</h3>
                {form.templateFields.map((f) => {
                  const val = form.dataJson[f.key];
                  if (val == null || val === "") return null;
                  let display: string;
                  if (Array.isArray(val)) {
                    display = val.length > 0 && typeof val[0] === "string"
                      ? (val as string[]).join(", ")
                      : `${val.length} items`;
                  } else if (typeof val === "string" && val.startsWith("data:image/")) {
                    display = "Signed";
                  } else {
                    display = String(val);
                  }
                  return (
                    <div key={f.key} className="sf-detail-row">
                      <span className="sf-detail-key">{f.label}</span>
                      <span className="sf-detail-val">{display}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail rail */}
        <aside className="sf-detail-rail">
          <div className="sf-rail-card">
            <h4>{Icon.bell} Notifications sent</h4>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {form.formType === "incident_report" ? (
                <p style={{ margin: 0 }}>
                  This incident report triggered immediate alerts to all project admins on submit.
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  Standard submission — admins notified via in-app inbox. No immediate alerts triggered.
                </p>
              )}
            </div>
          </div>

          {form.flagged && (
            <div className="sf-rail-card" style={{ borderColor: "var(--er)" }}>
              <h4>{Icon.flag} Flagged</h4>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                {form.flagReason ?? "Flagged for follow-up review."}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
