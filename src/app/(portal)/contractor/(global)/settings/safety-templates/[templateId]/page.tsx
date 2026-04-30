import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import {
  FieldTypeIcon,
  FormTypeBadge,
  Icon,
} from "@/app/(portal)/safety-forms-shared";
import "../../../../../safety-forms.css";
import { getSafetyFormTemplates } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";

export default async function SafetyTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const { session } = await requireServerSession();
  let templates;
  try {
    templates = await getSafetyFormTemplates({ session });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="sf-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const tpl = templates.find((t) => t.id === templateId);
  if (!tpl) redirect("/contractor/settings/safety-templates");

  return (
    <div className="sf-content">
      <div className="sf-page-hdr">
        <div>
          <Link href="/contractor/settings/safety-templates" className="sf-btn ghost" style={{ marginBottom: 8 }}>
            {Icon.back} Back to templates
          </Link>
          <h1 className="sf-page-title">{tpl.name}</h1>
          <div className="sf-detail-meta">
            <FormTypeBadge type={tpl.formType} />
            <span>·</span>
            <span>{tpl.fieldCount} fields</span>
            <span>·</span>
            <span>{tpl.timesUsed} uses</span>
          </div>
        </div>
        <div className="sf-page-actions">
          {/* Both buttons are Phase 6.5 follow-ups. Edit fields →
              safety_template_field_editor.md. Assign to subs →
              safety_v1_stubs.md §3 (the API exists at
              PUT /api/safety-form-templates/[id]/assignments). */}
          <button
            className="sf-btn"
            type="button"
            disabled
            title="Stub — see docs/specs/production_grade_upgrades/safety_v1_stubs.md §3"
          >
            {Icon.users} Assign to subs
          </button>
          <button
            className="sf-btn"
            type="button"
            disabled
            title="Phase 6.5 — see safety_template_field_editor.md"
          >
            {Icon.edit} Edit fields
          </button>
        </div>
      </div>

      <div className="sf-tpl-detail">
        <div className="sf-tpl-detail-hdr">
          <div>
            <h3
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 700,
                fontSize: 14,
                margin: 0,
                color: "var(--text-primary)",
                letterSpacing: "-.005em",
              }}
            >
              Field definitions
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
              These render in mobile order during completion. The field editor (drag-reorder + add/edit) ships in Phase 6.5.
            </p>
          </div>
        </div>

        <div className="sf-tpl-field-list">
          {tpl.fields.map((f, i) => (
            <div key={f.key} className="sf-tpl-field">
              <span className="sf-tpl-field-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="sf-tpl-field-icon">
                <FieldTypeIcon type={f.type} />
              </span>
              <span className="sf-tpl-field-label">{f.label}</span>
              {f.required && <span className="sf-tpl-field-req">REQUIRED</span>}
              <span className="sf-tpl-field-type">{f.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
