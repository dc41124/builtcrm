import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";
import {
  FormTypeBadge,
  Icon,
  SAFETY_FORM_TYPE_CONFIG,
} from "@/app/(portal)/safety-forms-shared";
import "../../../../safety-forms.css";
import { getSafetyFormTemplates } from "@/domain/loaders/safety-forms";
import { AuthorizationError } from "@/domain/permissions";

export default async function SafetyTemplatesPage() {
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

  const active = templates.filter((t) => !t.isArchived);

  return (
    <div className="sf-content">
      <div className="sf-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/contractor/settings" className="sf-btn ghost sm">
            {Icon.back} Settings
          </Link>
          <div>
            <h1 className="sf-page-title">Safety form templates</h1>
            <div className="sf-page-sub">
              {active.length} active template{active.length === 1 ? "" : "s"} · Standard library + custom forms
            </div>
          </div>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="sf-empty">
          <h3>No templates yet</h3>
          <p>The standard library should seed three templates on org bootstrap. If none appear, run db:seed.</p>
        </div>
      ) : (
        <div className="sf-tpl-grid">
          {active.map((t) => {
            const cfg = SAFETY_FORM_TYPE_CONFIG[t.formType];
            return (
              <Link key={t.id} href={`/contractor/settings/safety-templates/${t.id}`} className="sf-tpl-card">
                <div className="sf-tpl-card-hdr">
                  <div className="sf-tpl-card-name">{t.name}</div>
                  <FormTypeBadge type={t.formType} size="sm" />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45, minHeight: 32 }}>
                  {t.description ?? cfg.desc}
                </div>
                <div className="sf-tpl-card-meta">
                  <span className="sf-tpl-card-meta-item">
                    {Icon.fileText} {t.fieldCount} fields
                  </span>
                  <span className="sf-tpl-card-meta-item">
                    {Icon.refresh} {t.timesUsed} uses
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
