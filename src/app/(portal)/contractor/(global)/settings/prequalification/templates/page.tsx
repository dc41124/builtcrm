import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getPrequalTemplatesView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

import "../../../../../prequalification.css";
import { NewTemplateButton } from "./new-template-button";

export default async function ContractorPrequalTemplatesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  let view: Awaited<ReturnType<typeof getPrequalTemplatesView>>;
  try {
    view = await getPrequalTemplatesView({ session: sessionLike });
  } catch (err) {
    if (err instanceof PlanGateError) {
      return (
        <div className="pq-content">
          <div className="pq-empty">
            <div className="pq-empty-title">
              Prequalification is a Professional plan feature
            </div>
          </div>
        </div>
      );
    }
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div className="pq-content">
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="pq-content">
      <div className="pq-page-hdr">
        <div>
          <h1 className="pq-page-title">Templates</h1>
          <p className="pq-page-sub">
            Define what subcontractors fill out. Create one general
            template, or trade-specific templates for your most common subs.
            Each <strong>(trade)</strong> has one default that gets
            auto-suggested when you invite a sub.
          </p>
        </div>
        <div className="pq-page-acts">
          <Link className="pq-btn ghost" href="/contractor/settings/prequalification">
            ← Settings
          </Link>
          <NewTemplateButton />
        </div>
      </div>

      {view.rows.length === 0 ? (
        <div className="pq-empty">
          <div className="pq-empty-title">No templates yet</div>
          <div className="pq-empty-sub">
            Create your first template to start inviting subs to prequalify.
          </div>
        </div>
      ) : (
        <div className="pq-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Trade</th>
                <th>Default</th>
                <th>Validity</th>
                <th>Questions</th>
                <th>Pass threshold</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((t) => (
                <tr key={t.id} className={t.archivedAt ? "archived" : ""}>
                  <td className="pq-table-name">
                    {t.name}
                    {t.archivedAt ? (
                      <span className="pq-pill">Archived</span>
                    ) : null}
                  </td>
                  <td>{t.tradeCategory ?? "General"}</td>
                  <td>
                    {t.isDefault ? (
                      <span className="pq-pill accent">Default</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {t.validityMonths == null
                      ? "Never expires"
                      : `${t.validityMonths} mo`}
                  </td>
                  <td>{t.questionCount}</td>
                  <td>{t.passThreshold}</td>
                  <td>{new Date(t.updatedAt).toLocaleDateString()}</td>
                  <td>
                    <Link
                      className="pq-btn xs"
                      href={`/contractor/settings/prequalification/templates/${t.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
