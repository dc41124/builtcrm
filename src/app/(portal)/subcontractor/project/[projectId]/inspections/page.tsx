import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getInspections,
  type InspectionListRow,
} from "@/domain/loaders/inspections";
import { AuthorizationError } from "@/domain/permissions";

import {
  Icon,
  PassRatePill,
  StatusPill,
  TradeBadge,
  formatDateShort,
} from "../../../../inspections-shared";
import "../../../../inspections.css";

export default async function SubInspectionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let rows: InspectionListRow[] = [];
  try {
    const view = await getInspections({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
    });
    rows = view.rows;
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre className="in-err">Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const portalBase = `/subcontractor/project/${projectId}`;
  const active = rows.filter(
    (r) => r.status === "scheduled" || r.status === "in_progress",
  );
  const done = rows.filter((r) => r.status === "completed");
  const kpiPassRate =
    done.length > 0
      ? Math.round(
          done
            .map((r) => r.passRate ?? 0)
            .reduce((a, b) => a + b, 0) / done.length,
        )
      : 0;

  return (
    <div className="in-content">
      <div className="in-page-hdr">
        <div>
          <h1 className="in-page-title">Inspections</h1>
          <div className="in-page-sub">
            Walk-through each checklist. Your crew sees only inspections assigned
            to your org.
          </div>
        </div>
      </div>

      <div className="in-sub-banner">
        {Icon.phone}
        <span>
          Tap an inspection below to start the mobile walk-through. Fail or
          conditional items require a note; completing an inspection auto-creates
          punch items for any fail/conditional outcomes.
        </span>
      </div>

      <div className="in-kpi-strip">
        <div className="in-kpi">
          <div className="in-kpi-label">To do</div>
          <div className="in-kpi-val">{active.length}</div>
          <div className="in-kpi-meta">Scheduled + in progress</div>
        </div>
        <div className="in-kpi">
          <div className="in-kpi-label">Completed</div>
          <div className="in-kpi-val ok">{done.length}</div>
          <div className="in-kpi-meta">This project</div>
        </div>
        <div className="in-kpi">
          <div className="in-kpi-label">Your pass rate</div>
          <div className="in-kpi-val ok">{kpiPassRate}%</div>
          <div className="in-kpi-meta">Across your completed work</div>
        </div>
        <div className="in-kpi">
          <div className="in-kpi-label">Punches on you</div>
          <div className="in-kpi-val er">
            {rows.reduce((s, r) => s + r.punchCount, 0)}
          </div>
          <div className="in-kpi-meta">From fail / conditional outcomes</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="in-empty">
          <h3>No inspections assigned to your team</h3>
          <p>
            When the contractor schedules a QA/QC inspection and assigns it to
            your organization, it will show up here.
          </p>
        </div>
      ) : (
        <>
          <h4
            style={{
              margin: "18px 0 10px",
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 720,
              fontSize: 13,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Active · {active.length}
          </h4>
          <div className="in-list">
            <div className="in-list-hdr">
              <div>Number</div>
              <div>Inspection</div>
              <div>Trade</div>
              <div>Assignee</div>
              <div>Scheduled</div>
              <div>Status</div>
              <div>Punch</div>
            </div>
            {active.length === 0 ? (
              <div
                style={{
                  padding: "24px 20px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                }}
              >
                Nothing active right now. Completed items are below.
              </div>
            ) : (
              active.map((r) => (
                <Link
                  href={`${portalBase}/inspections/${r.id}`}
                  key={r.id}
                  className="in-row"
                >
                  <div className="in-row-num">{r.numberLabel}</div>
                  <div className="in-row-title">
                    <div className="in-row-title-top">
                      <span className="in-row-title-name">
                        {r.templateName}
                      </span>
                    </div>
                    <span className="in-row-title-zone">{r.zone}</span>
                  </div>
                  <div>
                    <TradeBadge trade={r.templateTradeCategory} />
                  </div>
                  <div className="in-row-assignee">
                    <span className="in-row-assignee-org">
                      {r.assignedOrgName ?? "—"}
                    </span>
                    <span className="in-row-assignee-user">
                      {r.assignedUserName ?? ""}
                    </span>
                  </div>
                  <div className="in-row-date">
                    {formatDateShort(r.scheduledDate)}
                  </div>
                  <div>
                    <StatusPill
                      status={r.status}
                      passRate={r.passRate}
                      progressCount={r.recordedCount}
                      itemCount={r.itemCount}
                    />
                  </div>
                  <div>
                    <span
                      className={`in-row-punch${r.punchCount === 0 ? " zero" : ""}`}
                    >
                      {r.punchCount > 0 ? (
                        <>
                          {Icon.link}
                          {r.punchCount}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          {done.length > 0 && (
            <>
              <h4
                style={{
                  margin: "22px 0 10px",
                  fontFamily: '"DM Sans", sans-serif',
                  fontWeight: 720,
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Completed · {done.length}
              </h4>
              <div className="in-list">
                <div className="in-list-hdr">
                  <div>Number</div>
                  <div>Inspection</div>
                  <div>Trade</div>
                  <div>Assignee</div>
                  <div>Completed</div>
                  <div>Status</div>
                  <div>Punch</div>
                </div>
                {done.map((r) => (
                  <Link
                    href={`${portalBase}/inspections/${r.id}`}
                    key={r.id}
                    className="in-row"
                  >
                    <div className="in-row-num">{r.numberLabel}</div>
                    <div className="in-row-title">
                      <div className="in-row-title-top">
                        <span className="in-row-title-name">
                          {r.templateName}
                        </span>
                      </div>
                      <span className="in-row-title-zone">{r.zone}</span>
                    </div>
                    <div>
                      <TradeBadge trade={r.templateTradeCategory} />
                    </div>
                    <div className="in-row-assignee">
                      <span className="in-row-assignee-org">
                        {r.assignedOrgName ?? "—"}
                      </span>
                      <span className="in-row-assignee-user">
                        {r.assignedUserName ?? ""}
                      </span>
                    </div>
                    <div className="in-row-date">
                      {formatDateShort(r.completedAt)}
                    </div>
                    <div>
                      <PassRatePill rate={r.passRate} size="sm" />
                    </div>
                    <div>
                      <span
                        className={`in-row-punch${r.punchCount === 0 ? " zero" : ""}`}
                      >
                        {r.punchCount > 0 ? (
                          <>
                            {Icon.link}
                            {r.punchCount}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
