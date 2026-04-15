import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import { auth } from "@/auth/config";
import {
  getContractorProjectView,
  type ContractorProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import {
  ProjectHomeActivity,
  type ActivityRow,
} from "./project-home-activity";

const OPEN_RFI_STATUSES = new Set(["draft", "open", "answered"]);
const OPEN_CO_STATUSES = new Set(["draft", "submitted", "under_review"]);
const PENDING_APPROVAL_STATUSES = new Set(["pending", "open", "submitted"]);

export default async function ContractorProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view: ContractorProjectView;
  try {
    view = await getContractorProjectView({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const { project, details, teamMembers } = view;
  const basePath = `/contractor/project/${project.id}`;

  const activeRfis = view.rfis.filter((r) => OPEN_RFI_STATUSES.has(r.rfiStatus));
  const openCos = view.changeOrders.filter((c) =>
    OPEN_CO_STATUSES.has(c.changeOrderStatus),
  );
  const pendingApprovals = view.approvals.filter((a) =>
    PENDING_APPROVAL_STATUSES.has(a.approvalStatus),
  );
  const nextDraw = [...view.drawRequests]
    .filter((d) =>
      ["draft", "submitted", "under_review"].includes(d.drawRequestStatus),
    )
    .sort((a, b) => b.drawNumber - a.drawNumber)[0];
  const complianceExpiring = view.complianceRecords.filter(
    (c) =>
      c.expiresAt &&
      c.expiresAt.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30,
  ).length;

  const contractCents = details.contractValueCents ?? 0;
  const billedCents = view.drawRequests.reduce(
    (sum, d) => sum + (d.totalCompletedToDateCents ?? 0),
    0,
  );
  const budgetPct =
    contractCents > 0 ? Math.min(100, Math.round((billedCents / contractCents) * 100)) : 0;

  const actionItems = buildActionItems(view);
  const activityItems = buildActivityItems(view);
  const upcomingMilestones = view.milestones
    .filter((m) => m.scheduledDate.getTime() >= Date.now() - 1000 * 60 * 60 * 24)
    .slice(0, 4);

  const addressLine = [
    details.addressLine1,
    [details.city, details.stateProvince].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="cph">
      <header className="cph-head">
        <div className="cph-head-main">
          <h1 className="cph-title">{project.name}</h1>
          <div className="cph-meta">
            {addressLine && <span className="cph-meta-item">{addressLine}</span>}
            {details.clientOrganizationName && (
              <span className="cph-meta-item">
                <strong>Client:</strong> {details.clientOrganizationName}
              </span>
            )}
            {details.projectType && (
              <span className="cph-meta-item">
                <strong>Type:</strong> {details.projectType}
              </span>
            )}
            {details.startDate && (
              <span className="cph-meta-item">
                <strong>Start:</strong> {formatDate(details.startDate)}
              </span>
            )}
            {details.targetCompletionDate && (
              <span className="cph-meta-item">
                <strong>Target:</strong> {formatDate(details.targetCompletionDate)}
              </span>
            )}
          </div>
          <div className="cph-pills">
            <Pill color={projectStatusColor(details.projectStatus)}>
              {formatStatus(details.projectStatus)}
            </Pill>
            <Pill color="purple">{formatStatus(details.currentPhase)}</Pill>
          </div>
        </div>
      </header>

      <div className="cph-kpis">
        <KpiCard
          label="Active RFIs"
          value={activeRfis.length.toString()}
          meta={
            activeRfis.length === 0 ? "All clear" : `${view.rfis.length} total`
          }
          iconColor="amber"
        />
        <KpiCard
          label="Open change orders"
          value={openCos.length.toString()}
          meta={
            openCos.length === 0 ? "Nothing pending" : `${view.changeOrders.length} total`
          }
          iconColor="purple"
        />
        <KpiCard
          label="Pending approvals"
          value={pendingApprovals.length.toString()}
          meta={pendingApprovals.length === 0 ? "Nothing waiting" : "Need decision"}
          iconColor="red"
          alert={pendingApprovals.length > 0}
        />
        <KpiCard
          label="Next draw"
          value={nextDraw ? `#${nextDraw.drawNumber}` : "—"}
          meta={
            nextDraw
              ? `${formatStatus(nextDraw.drawRequestStatus)} · ${formatCurrency(nextDraw.currentPaymentDueCents ?? 0)}`
              : "No draw in flight"
          }
          iconColor="green"
        />
        <KpiCard
          label="Budget status"
          value={
            contractCents > 0 ? `${budgetPct}%` : formatCurrency(billedCents)
          }
          meta={
            contractCents > 0
              ? `${formatCurrency(billedCents)} of ${formatCurrency(contractCents)}`
              : "Contract value not set"
          }
          trend={
            complianceExpiring > 0
              ? `${complianceExpiring} compliance expiring`
              : undefined
          }
          trendType="warn"
          iconColor="blue"
        />
      </div>

      <div className="cph-grid">
        <div className="cph-main">
          <Card
            title="Action items"
            subtitle="What needs your attention on this project"
          >
            {actionItems.length === 0 ? (
              <EmptyState
                title="Nothing pressing"
                description="No open RFIs, CO decisions, or approvals waiting on you."
              />
            ) : (
              <ul className="cph-actions">
                {actionItems.map((a) => (
                  <li
                    key={a.id}
                    className={`cph-action ${a.urgent ? "cph-action-urgent" : ""}`}
                  >
                    <div className="cph-action-body">
                      <h5>{a.title}</h5>
                      <p>{a.description}</p>
                    </div>
                    <div className="cph-action-meta">
                      <Pill color={a.pillColor}>{a.pillLabel}</Pill>
                      <Link href={a.href} className="cph-action-link">
                        Open →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ProjectHomeActivity items={activityItems} />
        </div>

        <aside className="cph-rail">
          <Card title="Project team" subtitle={`${teamMembers.length} members`}>
            {teamMembers.length === 0 ? (
              <EmptyState title="No team yet" description="Invite members to this project." />
            ) : (
              <ul className="cph-team">
                {teamMembers.slice(0, 8).map((m) => (
                  <li key={m.id} className="cph-team-row">
                    <div
                      className="cph-avatar"
                      style={{ background: orgAccent(m.organizationType) }}
                    >
                      {initials(m.displayName ?? m.email)}
                    </div>
                    <div className="cph-team-info">
                      <div className="cph-team-name">{m.displayName ?? m.email}</div>
                      <div className="cph-team-role">
                        {formatStatus(m.roleKey)} · {m.organizationName ?? "—"}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Upcoming milestones" subtitle="Next scheduled events">
            {upcomingMilestones.length === 0 ? (
              <EmptyState title="Nothing scheduled" description="No upcoming milestones." />
            ) : (
              <ul className="cph-ms">
                {upcomingMilestones.map((m) => {
                  const d = m.scheduledDate;
                  return (
                    <li key={m.id} className="cph-ms-row">
                      <div className="cph-ms-date">
                        <div className="cph-ms-day">{d.getDate()}</div>
                        <div className="cph-ms-month">
                          {d.toLocaleString("en-US", { month: "short" })}
                        </div>
                      </div>
                      <div className="cph-ms-info">
                        <h5>{m.title}</h5>
                        <p>{formatStatus(m.milestoneStatus)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Quick actions" subtitle="Jump into a workflow">
            <div className="cph-qa">
              <Link className="cph-qa-row" href={`${basePath}/rfis?action=create`}>
                <span>Create RFI</span>
                <span className="cph-qa-arrow">→</span>
              </Link>
              <Link className="cph-qa-row" href={`${basePath}/change-orders?action=create`}>
                <span>Create change order</span>
                <span className="cph-qa-arrow">→</span>
              </Link>
              <Link className="cph-qa-row" href={`${basePath}/billing?action=submit-draw`}>
                <span>Submit draw request</span>
                <span className="cph-qa-arrow">→</span>
              </Link>
              <Link className="cph-qa-row" href={`${basePath}/upload-requests?action=create`}>
                <span>Request an upload</span>
                <span className="cph-qa-arrow">→</span>
              </Link>
              <Link className="cph-qa-row" href={`${basePath}/messages?action=new`}>
                <span>Start a message thread</span>
                <span className="cph-qa-arrow">→</span>
              </Link>
              <Link className="cph-qa-row" href={`${basePath}/documents?action=upload`}>
                <span>Upload a document</span>
                <span className="cph-qa-arrow">→</span>
              </Link>
            </div>
          </Card>
        </aside>
      </div>

      <style>{`
        .cph{display:flex;flex-direction:column;gap:24px}
        .cph-head-main{display:flex;flex-direction:column;gap:10px}
        .cph-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cph-meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
        .cph-meta-item strong{font-weight:680;color:var(--t1)}
        .cph-pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
        .cph-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
        @media(max-width:1200px){.cph-kpis{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:700px){.cph-kpis{grid-template-columns:repeat(2,1fr)}}
        .cph-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:flex-start}
        @media(max-width:1100px){.cph-grid{grid-template-columns:1fr}}
        .cph-main{display:flex;flex-direction:column;gap:20px;min-width:0}
        .cph-rail{display:flex;flex-direction:column;gap:20px;min-width:0}
        .cph-actions{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
        .cph-action{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px;border-radius:var(--r-m);border:1px solid transparent;transition:all var(--df) var(--e)}
        .cph-action:hover{background:var(--sh);border-color:var(--s3)}
        .cph-action-urgent{background:var(--dg-s);border-color:rgba(201,59,59,.25)}
        .cph-action-urgent:hover{background:var(--dg-s)}
        .cph-action-body{min-width:0;flex:1}
        .cph-action-body h5{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.01em;margin:0 0 3px}
        .cph-action-body p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.45}
        .cph-action-meta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
        .cph-action-link{font-family:var(--fd);font-size:12px;font-weight:650;color:var(--ac-t);text-decoration:none}
        .cph-action-link:hover{text-decoration:underline}
        .cph-team{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .cph-team-row{display:flex;align-items:center;gap:10px}
        .cph-avatar{width:32px;height:32px;border-radius:999px;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:720;color:#fff;flex-shrink:0;letter-spacing:.02em}
        .cph-team-info{min-width:0;flex:1}
        .cph-team-name{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .cph-team-role{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:1px}
        .cph-ms{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .cph-ms-row{display:flex;align-items:center;gap:12px}
        .cph-ms-date{width:44px;flex-shrink:0;text-align:center;background:var(--s2);border-radius:var(--r-m);padding:6px 0}
        .cph-ms-day{font-family:var(--fd);font-size:16px;font-weight:820;color:var(--t1);line-height:1}
        .cph-ms-month{font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-top:2px}
        .cph-ms-info{min-width:0;flex:1}
        .cph-ms-info h5{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);margin:0}
        .cph-ms-info p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin:2px 0 0}
        .cph-qa{display:flex;flex-direction:column;gap:2px}
        .cph-qa-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:var(--r-m);font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);text-decoration:none;transition:all var(--df) var(--e)}
        .cph-qa-row:hover{background:var(--ac-s);color:var(--ac-t)}
        .cph-qa-arrow{font-weight:700;color:var(--t3)}
        .cph-qa-row:hover .cph-qa-arrow{color:var(--ac-t)}
      `}</style>
    </div>
  );
}

function buildActionItems(view: ContractorProjectView): Array<{
  id: string;
  title: string;
  description: string;
  pillLabel: string;
  pillColor: PillColor;
  urgent: boolean;
  href: string;
}> {
  const now = Date.now();
  const basePath = `/contractor/project/${view.project.id}`;
  const items: Array<{
    id: string;
    title: string;
    description: string;
    pillLabel: string;
    pillColor: PillColor;
    urgent: boolean;
    href: string;
  }> = [];

  for (const r of view.rfis.filter((r) => OPEN_RFI_STATUSES.has(r.rfiStatus))) {
    const overdue = r.dueAt && r.dueAt.getTime() < now;
    items.push({
      id: `rfi-${r.id}`,
      title: `RFI-${r.sequentialNumber} · ${r.subject}`,
      description: r.body ?? "Awaiting response",
      pillLabel: overdue ? "Overdue" : formatStatus(r.rfiStatus),
      pillColor: overdue ? "red" : "amber",
      urgent: Boolean(overdue),
      href: `${basePath}/rfis`,
    });
  }
  for (const a of view.approvals.filter((a) =>
    PENDING_APPROVAL_STATUSES.has(a.approvalStatus),
  )) {
    items.push({
      id: `appr-${a.id}`,
      title: `Approval #${a.approvalNumber} · ${a.title}`,
      description: a.decisionNote ?? `${formatStatus(a.category)} decision pending`,
      pillLabel: "Pending",
      pillColor: "red",
      urgent: true,
      href: `${basePath}/approvals`,
    });
  }
  for (const c of view.changeOrders.filter((c) =>
    OPEN_CO_STATUSES.has(c.changeOrderStatus),
  )) {
    items.push({
      id: `co-${c.id}`,
      title: c.title,
      description: `Change order · ${formatStatus(c.changeOrderStatus)}`,
      pillLabel: formatStatus(c.changeOrderStatus),
      pillColor: "purple",
      urgent: false,
      href: `${basePath}/change-orders`,
    });
  }

  return items.slice(0, 6);
}

function buildActivityItems(view: ContractorProjectView): ActivityRow[] {
  const rows: Array<ActivityRow & { ts: number }> = [];

  for (const r of view.rfis.slice(0, 6)) {
    rows.push({
      id: `rfi-${r.id}`,
      type: "rfi",
      title: `RFI-${r.sequentialNumber} · ${r.subject}`,
      description: r.body ?? "—",
      pillLabel: formatStatus(r.rfiStatus),
      pillColor: "amber",
      time: relativeTime(r.createdAt),
      ts: r.createdAt.getTime(),
    });
  }
  for (const c of view.changeOrders.slice(0, 6)) {
    rows.push({
      id: `co-${c.id}`,
      type: "co",
      title: c.title,
      description: `Change order · ${formatStatus(c.changeOrderStatus)}`,
      pillLabel: formatStatus(c.changeOrderStatus),
      pillColor: "purple",
      time: "Recent",
      ts: 0,
    });
  }
  for (const d of view.drawRequests.slice(0, 4)) {
    rows.push({
      id: `draw-${d.id}`,
      type: "billing",
      title: `Draw #${d.drawNumber}`,
      description: `${formatStatus(d.drawRequestStatus)} · ${formatCurrency(d.currentPaymentDueCents ?? 0)}`,
      pillLabel: "Billing",
      pillColor: "green",
      time: d.submittedAt ? relativeTime(d.submittedAt) : "Draft",
      ts: d.submittedAt?.getTime() ?? 0,
    });
  }
  for (const c of view.complianceRecords.slice(0, 4)) {
    rows.push({
      id: `cmp-${c.id}`,
      type: "compliance",
      title: `${formatStatus(c.complianceType)} · ${c.organizationName ?? "—"}`,
      description: c.expiresAt
        ? `Expires ${formatDate(c.expiresAt)}`
        : formatStatus(c.complianceStatus),
      pillLabel: formatStatus(c.complianceStatus),
      pillColor: c.complianceStatus === "active" ? "green" : "amber",
      time: "—",
      ts: 0,
    });
  }

  rows.sort((a, b) => b.ts - a.ts);
  return rows.slice(0, 10).map(({ ts: _ts, ...r }) => r);
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `C$${(dollars / 1_000_000).toFixed(2)}M`;
  if (dollars >= 1_000) return `C$${Math.round(dollars / 1_000)}K`;
  return `C$${Math.round(dollars)}`;
}

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return formatDate(d);
}

function projectStatusColor(s: string): PillColor {
  if (s === "active" || s === "in_progress" || s === "construction") return "green";
  if (s === "on_hold" || s === "draft") return "amber";
  if (s === "cancelled") return "red";
  return "gray";
}

function orgAccent(t: string): string {
  if (t === "general_contractor") return "#5b4fc7";
  if (t === "subcontractor") return "#3d6b8e";
  if (t === "commercial_client") return "#3178b9";
  if (t === "residential_client") return "#2a7f6f";
  return "#7d8290";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
