import "./dashboard.css";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/card";
import { Pill } from "@/components/pill";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import {
  getContractorDashboardData,
  type ContractorDashboardData,
} from "@/domain/loaders/contractor-dashboard";
import { formatMoneyCentsCompact } from "@/lib/format/money";
import { loadPortalShell } from "@/lib/portal-shell";
import { PrioritiesCard } from "./priorities-card";

// ── Inline icons (from prototype) ──────────────────────────────
const BuildingIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="6" width="16" height="14" rx="2" fill="currentColor" opacity=".15" />
    <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.8" />
    <path d="M9 10h2m-2 4h2m4-4h-1m1 4h-1" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10 20v-3h4v3" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
const CheckSquareIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" opacity=".15" />
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8" />
    <path d="m8 12 3 3 5-5" stroke="currentColor" strokeWidth="2.2" />
  </svg>
);
const DollarIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="13" rx="3" fill="currentColor" opacity=".15" />
    <rect x="2" y="6" width="20" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
const ChatBubbleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M12 8v3" />
    <circle cx="12" cy="14" r=".5" fill="currentColor" />
  </svg>
);
const ShieldIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" opacity=".15" />
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const CreditCardIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity=".15" />
    <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
    <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export default async function ContractorDashboardPage() {
  const shell = await loadPortalShell("contractor");
  const data = await getContractorDashboardData({
    contractorOrganizationId: shell.orgId,
  });

  return (
    <div className="cd">
      <div className="cd-ph">
        <div>
          <h1 className="cd-pt">Dashboard</h1>
          <p className="cd-pst">
            What needs attention across your active projects today.
          </p>
        </div>
        <div className="cd-pa">
          <Button>New Project</Button>
          <Button variant="primary">Open Approvals</Button>
        </div>
      </div>

      <KpiStrip data={data} />

      <FinancialHealthStrip fin={data.financialHealth} />

      <div className="cd-dg">
        <div className="cd-dm">
          <PrioritiesCard
            priorities={data.priorities}
            approvals={data.approvalsAsPriorities}
            projectsTab={[]}
            financials={[]}
          />

          <Card title="Project health" subtitle="Completion and status across active projects">
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

          <Card
            title="Recent activity"
            subtitle="What happened across your projects"
            headerRight={<button className="cd-viewall" type="button">View all</button>}
          >
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
                        {a.detail ? ` ${a.detail}` : ""}
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

        <div className="cd-drl">
          <Card title="Approvals waiting" subtitle="Blocking release steps" alert>
            {data.approvalsWaiting.length === 0 ? (
              <EmptyState
                title="No approvals pending"
                description="Approvals awaiting response will appear here."
              />
            ) : (
              <ul className="cd-rows">
                {data.approvalsWaiting.map((a) => (
                  <li key={a.id} className="cd-row">
                    <div className="cd-row-body">
                      <h5>{a.title}</h5>
                      <p>{a.description}</p>
                    </div>
                    <div className="cd-row-meta">
                      <Pill color={a.pillColor}>{a.pillLabel}</Pill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Upcoming this week"
            headerRight={<button className="cd-viewall" type="button">Schedule</button>}
          >
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

          <Card title="Quick health">
            <div className="cd-mets">
              <div className="cd-met">
                <div className="cd-met-l">Delay risk</div>
                <div className="cd-met-v">—</div>
                <div className="cd-met-h">No data yet</div>
              </div>
              <div className="cd-met">
                <div className="cd-met-l">Open RFIs</div>
                <div className="cd-met-v">{data.kpis.openRfis}</div>
                <div className="cd-met-h">
                  {data.kpis.overdueRfis > 0
                    ? `${data.kpis.overdueRfis} overdue`
                    : "On pace"}
                </div>
              </div>
              <div className="cd-met">
                <div className="cd-met-l">Unread msgs</div>
                <div className="cd-met-v">—</div>
                <div className="cd-met-h">No data yet</div>
              </div>
              <div className="cd-met">
                <div className="cd-met-l">Open draws</div>
                <div className="cd-met-v">{data.kpis.drawsInReview}</div>
                <div className="cd-met-h">
                  {data.kpis.openPaymentCents > 0
                    ? `${formatCurrencyCompact(data.kpis.openPaymentCents)} out`
                    : "None"}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title="Recent messages"
            headerRight={<button className="cd-viewall" type="button">View all</button>}
          >
            {data.recentMessages.length === 0 ? (
              <EmptyState
                title="No messages yet"
                description="Recent project conversations will appear here."
              />
            ) : (
              <ul className="cd-rows">
                {data.recentMessages.map((m) => (
                  <li key={m.id} className="cd-row">
                    <div className="cd-row-body">
                      <h5>{m.from}</h5>
                      <p>{m.text}</p>
                    </div>
                    <div className="cd-row-meta">
                      <span className="cd-time">{m.time}</span>
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
    k.openPaymentCents > 0 ? formatCurrencyCompact(k.openPaymentCents) : "$0";
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
        icon={BuildingIcon}
        iconColor="blue"
      />
      <KpiCard
        label="Approvals queue"
        value={k.pendingApprovals.toString()}
        meta={k.pendingApprovals === 0 ? "All clear" : "Awaiting review"}
        icon={CheckSquareIcon}
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
        icon={DollarIcon}
        iconColor="green"
      />
      <KpiCard
        label="Open RFIs"
        value={k.openRfis.toString()}
        meta={k.overdueRfis === 0 ? "On pace" : undefined}
        trend={k.overdueRfis > 0 ? `${k.overdueRfis} overdue` : undefined}
        trendType="down"
        icon={ChatBubbleIcon}
        iconColor="amber"
      />
      <KpiCard
        label="Compliance"
        value={k.complianceAlerts.toString()}
        trend={k.complianceAlertLabel ?? undefined}
        trendType="warn"
        icon={ShieldIcon}
        iconColor="red"
        alert={k.complianceAlerts > 0}
      />
    </div>
  );
}

function FinancialHealthStrip({
  fin,
}: {
  fin: ContractorDashboardData["financialHealth"];
}) {
  const total = fin.totalContractCents;
  const hasData = total > 0;
  const pct = (n: number) =>
    total > 0 ? Math.max(0, Math.min(100, (n / total) * 100)) : 0;
  const segments = [
    { label: "Paid", value: fin.paidCents, color: "ok" as const },
    { label: "Unpaid", value: fin.unpaidCents, color: "ac" as const },
    { label: "Retainage", value: fin.retainageCents, color: "wr" as const },
    { label: "Remaining", value: fin.remainingCents, color: "s4" as const },
  ];
  return (
    <section className="cd-fin">
      <div className="cd-fin-left">
        <div className="cd-fin-title">
          {CreditCardIcon}
          Financial health
        </div>
        <div className="cd-fin-total">
          <span className="cd-fin-val">
            {hasData ? formatCurrencyCompact(total) : "—"}
          </span>
          <span className="cd-fin-label">total contract value</span>
        </div>
      </div>
      <div className="cd-fin-center">
        {hasData ? (
          <>
            <div className="cd-fin-bar">
              {segments.map((seg) => (
                <div
                  key={seg.label}
                  className={`cd-fin-seg cd-fin-seg-${seg.color}`}
                  style={{ width: `${pct(seg.value)}%` }}
                  title={`${seg.label}: ${formatCurrencyCompact(seg.value)}`}
                />
              ))}
            </div>
            <div className="cd-fin-legend">
              {segments.map((seg) => (
                <div key={seg.label} className="cd-fin-leg">
                  <span className={`cd-fin-dot cd-fin-dot-${seg.color}`} />
                  {seg.label} · {formatCurrencyCompact(seg.value)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="cd-fin-empty">
            No contract values set yet. Add them on project records.
          </div>
        )}
      </div>
      <div className="cd-fin-right">
        <a className="cd-fin-link" href="/contractor/billing">
          View financials →
        </a>
      </div>
    </section>
  );
}

const formatCurrencyCompact = (c: number) => formatMoneyCentsCompact(c);
