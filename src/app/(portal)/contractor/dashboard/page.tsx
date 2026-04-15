import "./dashboard.css";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/card";
import { Pill } from "@/components/pill";
import { EmptyState } from "@/components/empty-state";
import {
  getContractorDashboardData,
  type ContractorDashboardData,
} from "@/domain/loaders/contractor-dashboard";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function ContractorDashboardPage() {
  const shell = await loadPortalShell("contractor");
  const data = await getContractorDashboardData({
    contractorOrganizationId: shell.orgId,
  });

  return (
    <div className="cd">
      <div className="cd-ph">
        <h1 className="cd-pt">Dashboard</h1>
        <p className="cd-pst">
          {shell.orgName} — across {data.kpis.activeProjects} active{" "}
          {data.kpis.activeProjects === 1 ? "project" : "projects"}
        </p>
      </div>

      <KpiStrip data={data} />

      <div className="cd-dg">
        <div className="cd-dm">
          <Card
            title="What needs attention"
            subtitle="Overdue items and pending responses across your projects"
          >
            {data.priorities.length === 0 ? (
              <EmptyState
                title="Nothing pressing"
                description="No overdue RFIs or pending responses right now."
              />
            ) : (
              <ul className="cd-rows">
                {data.priorities.map((p) => (
                  <li
                    key={p.id}
                    className={`cd-row ${p.urgent ? "cd-row-urgent" : ""}`}
                  >
                    <div className="cd-row-body">
                      <h5>{p.title}</h5>
                      <p>{p.description}</p>
                    </div>
                    <div className="cd-row-meta">
                      <Pill color={p.pillColor}>{p.pillLabel}</Pill>
                      <span className="cd-time">{p.time}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Project health" subtitle="Status per active project">
            {data.projectHealth.length === 0 ? (
              <EmptyState
                title="No active projects"
                description="Create a project to see health tracking here."
              />
            ) : (
              <ul className="cd-ph-rows">
                {data.projectHealth.map((p) => (
                  <li key={p.id} className="cd-ph-row">
                    <div className="cd-ph-body">
                      <h5>{p.name}</h5>
                      <p>{p.description}</p>
                    </div>
                    <div className="cd-pbar-wrap">
                      <div className="cd-pbar">
                        <div
                          className={`cd-pfill cd-pfill-${p.barColor}`}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                      <span className="cd-pbar-pct">{p.pct}%</span>
                    </div>
                    <span className="cd-ph-phase">{p.phaseLabel}</span>
                    <Pill color={p.pillColor}>{p.pillLabel}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="cd-drl">
          <Card title="Upcoming deadlines" subtitle="Next scheduled milestones">
            {data.upcoming.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                description="No upcoming milestones in the next two weeks."
              />
            ) : (
              <ul className="cd-tl">
                {data.upcoming.map((u) => (
                  <li key={u.id} className="cd-tl-item">
                    <div className="cd-tl-date">
                      <div className="cd-tl-day">{u.day}</div>
                      <div className="cd-tl-mon">{u.month}</div>
                    </div>
                    <div className="cd-tl-content">
                      <h5>{u.title}</h5>
                      <p>{u.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recent activity" subtitle="Latest updates across projects">
            {data.activity.length === 0 ? (
              <EmptyState
                title="No recent activity"
                description="Project events will appear here as they happen."
              />
            ) : (
              <ul className="cd-act">
                {data.activity.map((a) => (
                  <li key={a.id} className="cd-act-item">
                    <span className={`cd-act-dot cd-act-dot-${a.dot}`} />
                    <div className="cd-act-body">
                      <div className="cd-act-text">
                        <strong>{a.title}</strong>
                        {a.detail ? ` — ${a.detail}` : ""}
                      </div>
                      <div className="cd-act-meta">
                        {a.actor} · {a.time}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

    </div>
  );
}

function KpiStrip({ data }: { data: ContractorDashboardData }) {
  const k = data.kpis;
  const openPayments =
    k.openPaymentCents > 0
      ? formatCurrencyCompact(k.openPaymentCents)
      : "C$0";
  return (
    <div className="cd-kpis">
      <KpiCard
        label="Active projects"
        value={k.activeProjects.toString()}
        meta={
          k.projectsInConstruction > 0
            ? `${k.projectsInConstruction} in construction`
            : undefined
        }
        trend={k.projectsInPrecon > 0 ? `${k.projectsInPrecon} precon` : undefined}
        trendType="up"
        iconColor="blue"
      />
      <KpiCard
        label="Approvals queue"
        value={k.pendingApprovals.toString()}
        meta={k.pendingApprovals === 0 ? "All clear" : "Awaiting review"}
        iconColor="purple"
      />
      <KpiCard
        label="Open payments"
        value={openPayments}
        meta={
          k.drawsInReview > 0
            ? `${k.drawsInReview} ${k.drawsInReview === 1 ? "draw" : "draws"} in review`
            : "No draws in review"
        }
        iconColor="green"
      />
      <KpiCard
        label="Open RFIs"
        value={k.openRfis.toString()}
        meta={k.overdueRfis === 0 ? "On pace" : undefined}
        trend={k.overdueRfis > 0 ? `${k.overdueRfis} overdue` : undefined}
        trendType="down"
        iconColor="amber"
      />
      <KpiCard
        label="Compliance"
        value={k.complianceAlerts.toString()}
        trend={k.complianceAlertLabel ?? undefined}
        trendType="warn"
        iconColor="red"
        alert={k.complianceAlerts > 0}
      />
    </div>
  );
}

function formatCurrencyCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `C$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `C$${Math.round(dollars / 1_000)}K`;
  return `C$${Math.round(dollars)}`;
}
