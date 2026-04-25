import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getPrequalEnforcementSettingsView } from "@/domain/loaders/prequal";
import { AuthorizationError } from "@/domain/permissions";
import { PlanGateError } from "@/domain/policies/plan";

import "../../../../prequalification.css";
import { EnforcementModeForm } from "./mode-form";

export default async function ContractorPrequalSettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sessionLike = session.session as unknown as {
    appUserId?: string | null;
  };

  let view: Awaited<ReturnType<typeof getPrequalEnforcementSettingsView>>;
  try {
    view = await getPrequalEnforcementSettingsView({ session: sessionLike });
  } catch (err) {
    if (err instanceof PlanGateError) {
      return (
        <div className="pq-content">
          <div className="pq-empty">
            <div className="pq-empty-title">
              Prequalification is a Professional plan feature
            </div>
            <div className="pq-empty-sub">
              Upgrade to enable subcontractor prequalification, including
              templates, intake, review, and assignment-time enforcement.
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
          <h1 className="pq-page-title">Prequalification settings</h1>
          <p className="pq-page-sub">
            Configure how prequalification is enforced when subcontractors are
            invited to your projects, and manage the templates each trade
            fills out.
          </p>
        </div>
        <div className="pq-page-acts">
          <Link
            className="pq-btn"
            href="/contractor/settings/prequalification/templates"
          >
            Manage templates
          </Link>
          <Link className="pq-btn" href="/contractor/prequalification">
            Review queue
          </Link>
        </div>
      </div>

      <EnforcementModeForm initialMode={view.mode} />

      {view.activeExemptions.length > 0 ? (
        <div className="pq-setting-card">
          <h3>Active project exemptions</h3>
          <p className="pq-setting-sub">
            Per-project escapes you&apos;ve granted while in <strong>block</strong>{" "}
            mode. Exemptions stay in effect until they expire or are
            revoked, or until the sub completes an approved prequal.
          </p>
          <div className="pq-table">
            <table>
              <thead>
                <tr>
                  <th>Subcontractor</th>
                  <th>Project</th>
                  <th>Granted</th>
                  <th>Reason</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {view.activeExemptions.map((e) => (
                  <tr key={e.id}>
                    <td className="pq-table-name">{e.subOrgName}</td>
                    <td>{e.projectId.slice(0, 8)}…</td>
                    <td>
                      {new Date(e.grantedAt).toLocaleDateString()}
                      {e.grantedByName ? (
                        <span style={{ color: "var(--text-tertiary)", fontSize: 11.5, display: "block" }}>
                          by {e.grantedByName}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ maxWidth: 280 }}>{e.reason}</td>
                    <td>
                      {e.expiresAt
                        ? new Date(e.expiresAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
