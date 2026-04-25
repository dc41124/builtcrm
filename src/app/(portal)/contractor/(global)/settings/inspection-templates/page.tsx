import Link from "next/link";
import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import {
  getInspectionTemplates,
  type InspectionTemplateRow,
} from "@/domain/loaders/inspections";
import { AuthorizationError } from "@/domain/permissions";

import {
  Icon,
  TradeBadge,
} from "../../../../inspections-shared";
import "../../../../inspections.css";

export default async function ContractorTemplateLibraryPage() {
  const { session } = await requireServerSession();
  let templates: InspectionTemplateRow[] = [];
  try {
    templates = await getInspectionTemplates({
      session: session,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="in-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const active = templates.filter((t) => !t.isArchived);
  const archived = templates.filter((t) => t.isArchived);
  const customCount = active.filter((t) => t.isCustom).length;
  const totalUses = templates.reduce((s, t) => s + t.timesUsed, 0);

  return (
    <div className="in-content">
      <div className="in-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/contractor/settings" className="in-btn sm ghost">
            {Icon.back} Settings
          </Link>
          <div>
            <h1 className="in-page-title">Inspection templates</h1>
            <div className="in-page-sub">
              {active.length} template{active.length === 1 ? "" : "s"} ·{" "}
              {customCount} custom · {totalUses} total use
              {totalUses === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="in-empty">
          <h3>No templates yet</h3>
          <p>
            The standard library seeds ten common templates on setup. If none
            appear here, ask an admin to run the dev seed.
          </p>
        </div>
      ) : (
        <div className="in-tpl-grid">
          {active.map((t) => (
            <Link
              key={t.id}
              href={`/contractor/settings/inspection-templates/${t.id}`}
              className={`in-tpl-card${t.isCustom ? " custom" : ""}`}
            >
              <div className="in-tpl-card-top">
                <TradeBadge trade={t.tradeCategory} />
                <span className={`in-tpl-phase ${t.phase}`}>{t.phase}</span>
              </div>
              <h3 className="in-tpl-name">{t.name}</h3>
              <div className="in-tpl-meta">
                <span className="in-tpl-meta-item">
                  <span className="in-tpl-meta-val">{t.itemCount}</span> items
                </span>
                <span className="in-tpl-meta-item">
                  <span className="in-tpl-meta-val">{t.timesUsed}</span> uses
                </span>
                <span
                  className="in-tpl-meta-item"
                  style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}
                >
                  Updated{" "}
                  {new Date(t.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <>
          <h4
            style={{
              margin: "28px 0 10px",
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 720,
              fontSize: 13,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Archived · {archived.length}
          </h4>
          <div className="in-tpl-grid">
            {archived.map((t) => (
              <Link
                key={t.id}
                href={`/contractor/settings/inspection-templates/${t.id}`}
                className={`in-tpl-card archived${t.isCustom ? " custom" : ""}`}
              >
                <div className="in-tpl-card-top">
                  <TradeBadge trade={t.tradeCategory} />
                  <span className={`in-tpl-phase ${t.phase}`}>{t.phase}</span>
                </div>
                <h3 className="in-tpl-name">{t.name}</h3>
                <div className="in-tpl-meta">
                  <span className="in-tpl-meta-item">
                    <span className="in-tpl-meta-val">{t.itemCount}</span> items
                  </span>
                  <span className="in-tpl-meta-item">
                    <span className="in-tpl-meta-val">{t.timesUsed}</span> uses
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
