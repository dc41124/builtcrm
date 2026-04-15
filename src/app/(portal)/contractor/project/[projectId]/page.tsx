import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  getContractorProjectView,
  type ContractorProjectView,
} from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import "./project-home.css";
import { WorkspaceCard, type WorkspaceTab } from "./workspace-card";

const OPEN_RFI_STATUSES = new Set(["draft", "open", "answered"]);
const OPEN_CO_STATUSES = new Set(["draft", "submitted", "under_review"]);
const PENDING_APPROVAL_STATUSES = new Set([
  "draft",
  "pending_review",
  "needs_revision",
]);

// Inline SVG icons (from prototype)
const PlusIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const UploadIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M12 18v-6M9 15h6" />
  </svg>
);
const DownloadIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

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

  // ── Derive state ──────────────────────────────────────────────
  const openRfis = view.rfis.filter((r) => OPEN_RFI_STATUSES.has(r.rfiStatus));
  const overdueRfis = openRfis.filter(
    (r) => r.dueAt && r.dueAt.getTime() < Date.now(),
  );
  const openCos = view.changeOrders.filter((c) =>
    OPEN_CO_STATUSES.has(c.changeOrderStatus),
  );
  const pendingApprovals = view.approvals.filter((a) =>
    PENDING_APPROVAL_STATUSES.has(a.approvalStatus),
  );
  const blockedApprovals = pendingApprovals.filter(
    (a) => a.approvalStatus === "needs_revision",
  );
  const complianceExpiringSoon = view.complianceRecords.filter(
    (c) =>
      c.expiresAt &&
      c.expiresAt.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30,
  );
  const complianceActive = view.complianceRecords.filter(
    (c) => c.complianceStatus === "active",
  );
  const activeDraw = [...view.drawRequests]
    .filter((d) =>
      ["draft", "submitted", "under_review", "returned"].includes(
        d.drawRequestStatus,
      ),
    )
    .sort((a, b) => b.drawNumber - a.drawNumber)[0];
  const upcomingMilestones = view.milestones
    .filter((m) => m.scheduledDate.getTime() >= Date.now() - 1000 * 60 * 60 * 24)
    .slice(0, 4);

  const contractCents = details.contractValueCents ?? 0;
  const billedCents = view.drawRequests.reduce(
    (sum, d) => sum + (d.totalCompletedToDateCents ?? 0),
    0,
  );

  const actionItemCount =
    openRfis.length + openCos.length + pendingApprovals.length;
  const complianceAllCurrent =
    view.complianceRecords.length > 0 &&
    complianceExpiringSoon.length === 0 &&
    complianceActive.length === view.complianceRecords.length;

  // ── Hero context pills ────────────────────────────────────────
  const contextPills: Array<{ label: string; kind: string }> = [];
  if (details.projectStatus === "active") {
    contextPills.push({ label: "Active project", kind: "purple" });
  } else {
    contextPills.push({
      label: `${formatStatus(details.projectStatus)} project`,
      kind: "purple",
    });
  }
  if (actionItemCount > 0) {
    contextPills.push({
      label: `${actionItemCount} ${actionItemCount === 1 ? "item" : "items"} need action`,
      kind: "orange",
    });
  }
  if (blockedApprovals.length > 0) {
    contextPills.push({
      label: `${blockedApprovals.length} blocker${blockedApprovals.length === 1 ? "" : "s"} affecting release`,
      kind: "red",
    });
  }
  if (complianceAllCurrent) {
    contextPills.push({ label: "Compliance current", kind: "green" });
  } else if (complianceExpiringSoon.length > 0) {
    contextPills.push({
      label: `${complianceExpiringSoon.length} compliance expiring`,
      kind: "orange",
    });
  }

  // ── Snapshots (hero side) ─────────────────────────────────────
  const nextMilestone = upcomingMilestones[0];
  const snapshots: Array<{
    label: string;
    value: string;
    meta: string;
    kind?: "warn" | "danger";
  }> = [
    blockedApprovals.length > 0
      ? {
          label: "Current blocker",
          value: blockedApprovals[0].title,
          meta: "Holding release steps",
          kind: "danger",
        }
      : openRfis.length > 0
        ? {
            label: "Current focus",
            value: `${openRfis.length} open RFI${openRfis.length === 1 ? "" : "s"}`,
            meta:
              overdueRfis.length > 0
                ? `${overdueRfis.length} overdue`
                : "All on track",
          }
        : {
            label: "Current focus",
            value: "Nothing urgent",
            meta: "No open blockers",
          },
    nextMilestone
      ? {
          label: "Next milestone",
          value: nextMilestone.scheduledDate.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
          }),
          meta: nextMilestone.title,
          kind: "warn",
        }
      : {
          label: "Next milestone",
          value: "—",
          meta: "None scheduled",
        },
    {
      label: "Decision queue",
      value: `${pendingApprovals.length} open`,
      meta:
        pendingApprovals.length === 0
          ? "No approvals pending"
          : `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} waiting`,
    },
    {
      label: "Unread messages",
      value:
        view.unreadConversationCount === 0
          ? "All caught up"
          : `${view.unreadConversationCount} unread`,
      meta:
        view.unreadConversationCount === 0
          ? `${view.conversations.length} total threads`
          : `of ${view.conversations.length} project threads`,
    },
  ];

  // ── Summary strip ─────────────────────────────────────────────
  const phaseLabel = formatStatus(details.currentPhase);
  const summaryCards: Array<{
    label: string;
    value: string;
    meta: string;
    kind?: "accent" | "warn" | "danger" | "success";
  }> = [
    {
      label: "Current phase",
      value: phaseLabel,
      meta: details.projectType ? formatStatus(details.projectType) : "—",
    },
    {
      label: "Approvals waiting",
      value: pendingApprovals.length.toString(),
      meta:
        blockedApprovals.length > 0
          ? `${blockedApprovals.length} blocked`
          : pendingApprovals.length === 0
            ? "Nothing pending"
            : "Awaiting decision",
      kind: blockedApprovals.length > 0 ? "danger" : "accent",
    },
    {
      label: "Open RFIs",
      value: openRfis.length.toString(),
      meta:
        overdueRfis.length > 0
          ? `${overdueRfis.length} overdue`
          : openRfis.length === 0
            ? "All clear"
            : "On pace",
      kind: overdueRfis.length > 0 ? "warn" : undefined,
    },
    {
      label: "Compliance",
      value: complianceAllCurrent
        ? "Current"
        : `${complianceExpiringSoon.length}`,
      meta: complianceAllCurrent
        ? `${view.complianceRecords.length} records tracked`
        : `${complianceExpiringSoon.length} expiring soon`,
      kind: complianceAllCurrent ? "success" : "warn",
    },
    {
      label: "Billing progress",
      value:
        contractCents > 0 ? formatCurrency(billedCents) : formatCurrency(billedCents),
      meta:
        contractCents > 0
          ? `of ${formatCurrency(contractCents)} contract${activeDraw ? ` · Draw #${activeDraw.drawNumber} ${formatStatus(activeDraw.drawRequestStatus)}` : ""}`
          : activeDraw
            ? `Draw #${activeDraw.drawNumber} ${formatStatus(activeDraw.drawRequestStatus)}`
            : "No draws in flight",
    },
  ];

  // ── Today tab data ────────────────────────────────────────────
  const priorityItems = [
    ...overdueRfis.slice(0, 2).map((r) => ({
      id: `rfi-${r.id}`,
      title: `RFI-${r.sequentialNumber} · ${r.subject}`,
      desc: r.body ?? "Awaiting response",
      pill: "Overdue",
      pillKind: "red" as const,
      time: "Overdue",
      hot: true,
      href: `${basePath}/rfis`,
    })),
    ...blockedApprovals.slice(0, 2).map((a) => ({
      id: `appr-${a.id}`,
      title: `Approval #${a.approvalNumber} · ${a.title}`,
      desc: a.decisionNote ?? `${formatStatus(a.category)} decision needs revision`,
      pill: "Blocked",
      pillKind: "red" as const,
      time: "Needs revision",
      hot: true,
      href: `${basePath}/approvals`,
    })),
    ...openRfis
      .filter((r) => !overdueRfis.includes(r))
      .slice(0, 2)
      .map((r) => ({
        id: `rfi-open-${r.id}`,
        title: `RFI-${r.sequentialNumber} · ${r.subject}`,
        desc: r.body ?? "Awaiting response",
        pill: "RFI",
        pillKind: "purple" as const,
        time: "Open",
        hot: false,
        href: `${basePath}/rfis`,
      })),
  ].slice(0, 4);

  const approvalsWaitingRows = pendingApprovals.slice(0, 3).map((a) => {
    const kind: "red" | "orange" | "blue" =
      a.approvalStatus === "needs_revision" ? "red" : "orange";
    return {
      id: a.id,
      title: `#${a.approvalNumber} · ${a.title}`,
      desc:
        a.decisionNote ??
        `${formatStatus(a.category)}${a.impactCostCents > 0 ? ` · ${formatCurrency(a.impactCostCents)}` : ""}`,
      pill:
        a.approvalStatus === "needs_revision" ? "Blocked" : formatStatus(a.approvalStatus),
      pillKind: kind,
      hot: a.approvalStatus === "needs_revision",
      href: `${basePath}/approvals`,
    };
  });

  const riskRows: Array<{
    id: string;
    title: string;
    desc: string;
    pill: string;
    pillKind: "red" | "orange";
    hot: boolean;
  }> = [];
  if (blockedApprovals.length > 0) {
    riskRows.push({
      id: "risk-blocked",
      title: "Client decision dependency",
      desc: `${blockedApprovals[0].title} is the primary blocker affecting release.`,
      pill: "Critical",
      pillKind: "red",
      hot: true,
    });
  }
  if (nextMilestone && upcomingMilestones.length > 1) {
    riskRows.push({
      id: "risk-milestone",
      title: "Upcoming milestone pressure",
      desc: `${nextMilestone.title} depends on closing ${pendingApprovals.length} open item${pendingApprovals.length === 1 ? "" : "s"}.`,
      pill: "Watch",
      pillKind: "orange",
      hot: false,
    });
  }
  if (complianceExpiringSoon.length > 0) {
    const c = complianceExpiringSoon[0];
    const days = c.expiresAt
      ? Math.max(
          0,
          Math.round((c.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : 0;
    riskRows.push({
      id: "risk-compliance",
      title: "Compliance gap risk",
      desc: `${c.organizationName ?? "Vendor"} ${formatStatus(c.complianceType)} expires in ${days}d.`,
      pill: "Expiring",
      pillKind: "orange",
      hot: false,
    });
  }

  // ── Workspace tabs config ─────────────────────────────────────
  const workspaceTabs: WorkspaceTab[] = [
    { id: "today", label: "Today", href: `${basePath}` },
    {
      id: "rfis",
      label: "RFIs",
      href: `${basePath}/rfis`,
      badge: openRfis.length,
      badgeType: overdueRfis.length > 0 ? "warn" : "default",
    },
    {
      id: "cos",
      label: "Change Orders",
      href: `${basePath}/change-orders`,
      badge: openCos.length,
      badgeType: "warn",
    },
    {
      id: "approvals",
      label: "Approvals",
      href: `${basePath}/approvals`,
      badge: pendingApprovals.length,
      badgeType: blockedApprovals.length > 0 ? "danger" : "default",
    },
    {
      id: "compliance",
      label: "Compliance",
      href: `${basePath}/compliance`,
      badge: complianceExpiringSoon.length,
      badgeType: "warn",
    },
    { id: "selections", label: "Selections", href: `${basePath}/selections` },
    { id: "documents", label: "Documents", href: `${basePath}/documents` },
    { id: "billing", label: "Billing", href: `${basePath}/billing` },
    { id: "schedule", label: "Schedule", href: `${basePath}/schedule` },
  ];

  // ── Right rail: blockers ──────────────────────────────────────
  const blockers = blockedApprovals.slice(0, 3).map((a) => ({
    id: a.id,
    title: `Approval #${a.approvalNumber}`,
    desc: `${a.title} — needs revision`,
    hot: true,
  }));

  // ── Quick access modules with counts ──────────────────────────
  const quickLinks: Array<{ label: string; href: string; count?: string }> = [
    {
      label: "Messages",
      href: `${basePath}/messages`,
      count: view.conversations.length > 0 ? `${view.conversations.length} threads` : undefined,
    },
    {
      label: "Documents",
      href: `${basePath}/documents`,
      count: view.documents.length > 0 ? `${view.documents.length} files` : undefined,
    },
    { label: "Schedule", href: `${basePath}/schedule` },
    {
      label: "Financials",
      href: `${basePath}/billing`,
      count: billedCents > 0 ? `${formatCurrency(billedCents)} billed` : undefined,
    },
    {
      label: "Upload Requests",
      href: `${basePath}/upload-requests`,
      count:
        view.uploadRequests.length > 0
          ? `${view.uploadRequests.length} open`
          : undefined,
    },
  ];

  // ── Key contacts (top 6 from team) ────────────────────────────
  const keyContacts = teamMembers.slice(0, 6);

  return (
    <div className="cph">
      {/* HERO */}
      <section className="cph-hero">
        <div className="cph-hero-main">
          <h1 className="cph-title">{project.name}</h1>
          <div className="cph-pills">
            {contextPills.map((p) => (
              <span key={p.label} className={`cph-pl ${p.kind}`}>
                {p.label}
              </span>
            ))}
          </div>
          <p className="cph-desc">
            Live operating surface for this project — current priorities, blockers,
            approvals, movement, and quick access to every workspace module.
          </p>
          <div className="cph-meta-strip">
            {details.clientOrganizationName && (
              <div className="cph-meta-chip">
                <strong>Client:</strong> {details.clientOrganizationName}
              </div>
            )}
            {details.projectType && (
              <div className="cph-meta-chip">
                <strong>Type:</strong> {formatStatus(details.projectType)}
              </div>
            )}
            {details.targetCompletionDate && (
              <div className="cph-meta-chip">
                <strong>Target:</strong> {formatDate(details.targetCompletionDate)}
              </div>
            )}
            {details.startDate && (
              <div className="cph-meta-chip">
                <strong>Start:</strong> {formatDate(details.startDate)}
              </div>
            )}
          </div>
          <div className="cph-hero-btns">
            <Link className="cph-btn pri" href={`${basePath}/rfis?action=create`}>
              {PlusIcon} New RFI
            </Link>
            <Link className="cph-btn" href={`${basePath}/documents?action=upload`}>
              {UploadIcon} Upload Document
            </Link>
            <Link className="cph-btn" href={`${basePath}/billing?action=submit-draw`}>
              {DownloadIcon} Create Draw
            </Link>
            <Link className="cph-btn" href={`${basePath}/messages?action=new`}>
              Send Message
            </Link>
          </div>
        </div>

        <aside className="cph-hero-side">
          <h4>Project snapshot</h4>
          <div className="cph-snap-stack">
            {snapshots.map((s) => (
              <div
                key={s.label}
                className={`cph-snap ${s.kind ?? ""}`}
              >
                <div className="cph-snap-l">{s.label}</div>
                <div className="cph-snap-v">{s.value}</div>
                <div className="cph-snap-m">{s.meta}</div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      {/* KEY CONTACTS */}
      {keyContacts.length > 0 && (
        <section className="cph-contacts">
          <div className="cph-contacts-label">Key contacts</div>
          <div className="cph-contacts-list">
            {keyContacts.map((m) => (
              <div key={m.id} className="cph-cc">
                <div
                  className="cph-cc-av"
                  style={{ background: orgAccent(m.organizationType) }}
                >
                  {initials(m.displayName ?? m.email)}
                </div>
                <div className="cph-cc-text">
                  <span className="cph-cc-name">{m.displayName ?? m.email}</span>
                  <span className="cph-cc-role">{formatStatus(m.roleKey)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SUMMARY STRIP */}
      <section className="cph-sum-strip">
        {summaryCards.map((c) => (
          <div key={c.label} className={`cph-sum ${c.kind ?? ""}`}>
            <div className="cph-sum-l">{c.label}</div>
            <div className="cph-sum-v">{c.value}</div>
            <div className="cph-sum-m">{c.meta}</div>
          </div>
        ))}
      </section>

      {/* PROJECT GRID */}
      <section className="cph-pg">
        <WorkspaceCard
          tabs={workspaceTabs}
          todayContent={
            <div className="cph-ml">
              <div className="cph-stk">
                <div className="cph-blk dom">
                  <h4>Today&rsquo;s priorities</h4>
                  <div className="cph-lst">
                    {priorityItems.length === 0 ? (
                      <EmptyInlineMessage message="Nothing pressing right now." />
                    ) : (
                      priorityItems.map((p) => (
                        <Link
                          key={p.id}
                          href={p.href}
                          className={`cph-lr ${p.hot ? "hot" : ""}`}
                        >
                          <div className="cph-lr-main">
                            <h5>{p.title}</h5>
                            <p>{p.desc}</p>
                          </div>
                          <div className="cph-lr-side">
                            <span className={`cph-pl ${p.pillKind}`}>
                              {p.pill}
                            </span>
                            <span className="cph-tm">{p.time}</span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <div className="cph-blk">
                  <h4>Recent project movement</h4>
                  <div className="cph-lst">
                    {view.activity.length === 0 ? (
                      <EmptyInlineMessage message="Activity feed will populate as events land." />
                    ) : (
                      view.activity.slice(0, 4).map((a) => (
                        <div key={a.id} className="cph-lr">
                          <div className="cph-lr-main">
                            <h5>{a.title}</h5>
                            <p>{a.body ?? formatStatus(a.activityType)}</p>
                          </div>
                          <div className="cph-lr-side">
                            <span className="cph-tm">
                              {a.actorName ? `${a.actorName} · ` : ""}
                              {relativeTime(a.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="cph-stk">
                <div className="cph-blk alert">
                  <h4>Approvals waiting</h4>
                  <div className="cph-lst">
                    {approvalsWaitingRows.length === 0 ? (
                      <EmptyInlineMessage message="No approvals pending." />
                    ) : (
                      approvalsWaitingRows.map((a) => (
                        <Link
                          key={a.id}
                          href={a.href}
                          className={`cph-lr ${a.hot ? "hot" : ""}`}
                        >
                          <div className="cph-lr-main">
                            <h5>{a.title}</h5>
                            <p>{a.desc}</p>
                          </div>
                          <div className="cph-lr-side">
                            <span className={`cph-pl ${a.pillKind}`}>
                              {a.pill}
                            </span>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
                <div className="cph-blk">
                  <h4>Open risks &amp; dependencies</h4>
                  <div className="cph-lst">
                    {riskRows.length === 0 ? (
                      <EmptyInlineMessage message="No open risks flagged." />
                    ) : (
                      riskRows.map((r) => (
                        <div
                          key={r.id}
                          className={`cph-lr ${r.hot ? "hot" : ""}`}
                        >
                          <div className="cph-lr-main">
                            <h5>{r.title}</h5>
                            <p>{r.desc}</p>
                          </div>
                          <div className="cph-lr-side">
                            <span className={`cph-pl ${r.pillKind}`}>
                              {r.pill}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          }
        />

        <aside className="cph-rail">
          <div className="cph-rc danger">
            <div className="cph-rc-head">
              <h3>Current blockers</h3>
              <div className="sub">Issues actively delaying project progress</div>
            </div>
            <div className="cph-rc-body">
              <div className="cph-lst">
                {blockers.length === 0 ? (
                  <EmptyInlineMessage message="No active blockers." />
                ) : (
                  blockers.map((b) => (
                    <div key={b.id} className={`cph-lr ${b.hot ? "hot" : ""}`}>
                      <div className="cph-lr-main">
                        <h5>{b.title}</h5>
                        <p>{b.desc}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="cph-rc">
            <div className="cph-rc-head">
              <h3>Upcoming milestones</h3>
              <div className="sub">What&rsquo;s next for this project</div>
            </div>
            <div className="cph-rc-body">
              {upcomingMilestones.length === 0 ? (
                <EmptyInlineMessage message="Nothing scheduled." />
              ) : (
                upcomingMilestones.map((m) => {
                  const daysOut = Math.round(
                    (m.scheduledDate.getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  );
                  const soon = daysOut <= 7;
                  return (
                    <div key={m.id} className="cph-ms-item">
                      <div className="cph-ms-date">
                        <div className="cph-ms-day">
                          {m.scheduledDate.getDate()}
                        </div>
                        <div className="cph-ms-month">
                          {m.scheduledDate.toLocaleString("en-US", {
                            month: "short",
                          })}
                        </div>
                      </div>
                      <div className="cph-ms-info">
                        <h5>{m.title}</h5>
                        <p>{formatStatus(m.milestoneStatus)}</p>
                      </div>
                      <div className={`cph-ms-cd ${soon ? "soon" : ""}`}>
                        {daysOut <= 0
                          ? "Today"
                          : daysOut === 1
                            ? "1 day"
                            : `${daysOut} days`}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="cph-rc">
            <div className="cph-rc-head">
              <h3>Quick access</h3>
              <div className="sub">Jump into project modules</div>
            </div>
            <div className="cph-rc-body">
              <div className="cph-mod-links">
                {quickLinks.map((q) => (
                  <Link key={q.label} href={q.href} className="cph-mod-link">
                    <span>{q.label}</span>
                    <div className="r">
                      {q.count && <span className="c">{q.count}</span>}
                      <span className="a">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function EmptyInlineMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--fb)",
        fontSize: 12.5,
        fontWeight: 520,
        color: "var(--t3)",
        fontStyle: "italic",
        padding: "8px 2px",
      }}
    >
      {message}
    </div>
  );
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

function relativeTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
