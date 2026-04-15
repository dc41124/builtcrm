import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill } from "@/components/pill";
import { getSubcontractorProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import { SubComplianceList } from "./compliance-ui";
import { SubRfisList } from "./rfis-ui";
import { PendingUploadRequestsList } from "./upload-requests-ui";

const PHASE_LABELS: Record<string, string> = {
  preconstruction: "Precon",
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  phase_3: "Phase 3",
  closeout: "Closeout",
};

export default async function SubcontractorProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getSubcontractorProjectView({
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

  const openRfiCount = view.assignedRfis.filter(
    (r) => r.rfiStatus === "open" || r.rfiStatus === "pending_response",
  ).length;
  const pendingUploads = view.pendingUploadRequests.length;
  const complianceIssues = view.complianceRecords.filter(
    (c) => c.complianceStatus === "expired" || c.complianceStatus === "rejected",
  ).length;
  const nextMilestone = view.myMilestones.find(
    (m) => m.milestoneStatus === "scheduled" || m.milestoneStatus === "in_progress",
  );
  const phaseLabel =
    view.scope.phaseScope && PHASE_LABELS[view.scope.phaseScope]
      ? PHASE_LABELS[view.scope.phaseScope]
      : (view.scope.phaseScope ?? "Current phase");

  const base = `/subcontractor/project/${view.project.id}`;

  return (
    <div className="sph">
      <div className="sph-ph">
        <div>
          <div className="sph-bc">
            <Link href="/subcontractor/today">Today Board</Link>
            <span className="sph-sep">›</span>
            <span>{view.project.name}</span>
          </div>
          <h1 className="sph-pt">{view.project.name}</h1>
          <p className="sph-pst">
            {view.context.organization.name} · Scope:{" "}
            {view.scope.workScope ?? "Assigned"}{" "}
            {view.scope.phaseScope ? `· ${view.scope.phaseScope}` : ""}
          </p>
        </div>
      </div>

      <div className="sph-kpis">
        <KpiCard
          label="Your scope"
          value={view.scope.workScope ?? "Assigned"}
          meta={phaseLabel}
          iconColor="blue"
        />
        <KpiCard
          label="Open RFIs"
          value={openRfiCount.toString()}
          meta={openRfiCount === 0 ? "No open RFIs" : "Need your response"}
          iconColor="purple"
        />
        <KpiCard
          label="Upload requests"
          value={pendingUploads.toString()}
          meta={pendingUploads === 0 ? "All clear" : "From the GC"}
          trendType="warn"
          iconColor="amber"
        />
        <KpiCard
          label="Compliance"
          value={complianceIssues === 0 ? "Current" : complianceIssues.toString()}
          meta={
            complianceIssues === 0
              ? "Documents on file"
              : "Needs your attention"
          }
          iconColor={complianceIssues === 0 ? "green" : "red"}
          alert={complianceIssues > 0}
        />
        <KpiCard
          label="Next milestone"
          value={
            nextMilestone
              ? nextMilestone.scheduledDate.toISOString().slice(5, 10)
              : "—"
          }
          meta={nextMilestone ? nextMilestone.title : "Nothing scheduled"}
          iconColor="green"
        />
      </div>

      <div className="sph-dash">
        <div className="sph-main">
          <Card
            title="Upload requests"
            subtitle="Pending files the GC needs from your team"
            headerRight={
              <Link className="sph-link" href={`${base}/upload-requests`}>
                View all →
              </Link>
            }
          >
            {view.pendingUploadRequests.length === 0 ? (
              <EmptyState
                title="Nothing pending"
                description="No outstanding upload requests from the GC."
              />
            ) : (
              <PendingUploadRequestsList
                projectId={view.project.id}
                requests={view.pendingUploadRequests}
              />
            )}
          </Card>

          <Card
            title="RFIs assigned to your team"
            subtitle="Questions awaiting your response"
            headerRight={
              <Link className="sph-link" href={`${base}/rfis`}>
                View all →
              </Link>
            }
          >
            {view.assignedRfis.length === 0 ? (
              <EmptyState
                title="No RFIs"
                description="Nothing is waiting on your team right now."
              />
            ) : (
              <SubRfisList rfis={view.assignedRfis} />
            )}
          </Card>

          <Card title="My schedule" subtitle="Milestones assigned to your team">
            {view.myMilestones.length === 0 ? (
              <EmptyState
                title="No scheduled milestones"
                description="Your team has no milestones on this project yet."
              />
            ) : (
              <ul className="sph-ml-rows">
                {view.myMilestones.slice(0, 5).map((m) => (
                  <li key={m.id} className="sph-ml-row">
                    <div className="sph-ml-date">
                      {m.scheduledDate.toISOString().slice(5, 10)}
                    </div>
                    <div className="sph-ml-body">
                      <h5>{m.title}</h5>
                      <p>{m.milestoneStatus.replace(/_/g, " ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="sph-rail">
          <Card
            title="Compliance"
            subtitle="Required for continued project access"
            alert={complianceIssues > 0}
          >
            {view.complianceRecords.length === 0 ? (
              <EmptyState
                title="No records"
                description="No compliance documents on file for this project."
              />
            ) : (
              <SubComplianceList
                projectId={view.project.id}
                records={view.complianceRecords}
              />
            )}
          </Card>

          <Card title="Change orders">
            {view.assignedChangeOrders.length === 0 ? (
              <EmptyState
                title="No change orders"
                description="Nothing pending for your scope."
              />
            ) : (
              <ul className="sph-co-rows">
                {view.assignedChangeOrders.map((c) => (
                  <li key={c.id} className="sph-co-row">
                    <span className="sph-co-title">{c.title}</span>
                    <Pill color="blue">{c.changeOrderStatus.replace(/_/g, " ")}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Quick links">
            <ul className="sph-ql">
              <li><Link href={`${base}/messages`}>Messages</Link></li>
              <li><Link href={`${base}/documents`}>Documents</Link></li>
              <li><Link href={`${base}/schedule`}>Schedule</Link></li>
              <li><Link href={`${base}/financials`}>Financials</Link></li>
            </ul>
          </Card>
        </div>
      </div>

      <style>{`
        .sph{display:flex;flex-direction:column;gap:20px}
        .sph-ph{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
        .sph-bc{display:flex;align-items:center;gap:6px;font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t3);margin-bottom:6px}
        .sph-bc a{color:var(--t3);text-decoration:none}
        .sph-bc a:hover{color:var(--t1)}
        .sph-sep{color:var(--s4)}
        .sph-pt{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
        .sph-pst{margin:6px 0 0;font-family:var(--fb);font-size:14px;font-weight:520;color:var(--t2);max-width:720px}
        .sph-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
        .sph-dash{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
        .sph-main{display:flex;flex-direction:column;gap:16px;min-width:0}
        .sph-rail{display:flex;flex-direction:column;gap:16px;min-width:0}
        .sph-link{font-family:var(--fd);font-size:12px;font-weight:680;color:var(--ac-t);text-decoration:none}
        .sph-link:hover{text-decoration:underline}
        .sph-ml-rows{list-style:none;margin:0;padding:0}
        .sph-ml-row{display:flex;gap:14px;align-items:flex-start;padding:10px 0}
        .sph-ml-row+.sph-ml-row{border-top:1px solid var(--s3)}
        .sph-ml-date{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1);min-width:44px}
        .sph-ml-body h5{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);margin:0}
        .sph-ml-body p{font-family:var(--fb);font-size:12px;color:var(--t2);margin:2px 0 0;text-transform:capitalize}
        .sph-co-rows{list-style:none;margin:0;padding:0}
        .sph-co-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0}
        .sph-co-row+.sph-co-row{border-top:1px solid var(--s3)}
        .sph-co-title{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);text-transform:capitalize}
        .sph-ql{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
        .sph-ql li{padding:8px 0;border-bottom:1px solid var(--s3);font-family:var(--fd);font-size:13px;font-weight:620}
        .sph-ql li:last-child{border-bottom:none}
        .sph-ql a{color:var(--t1);text-decoration:none}
        .sph-ql a:hover{color:var(--ac-t)}
        @media(max-width:1280px){.sph-kpis{grid-template-columns:repeat(3,1fr)}.sph-dash{grid-template-columns:1fr}}
        @media(max-width:720px){.sph-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </div>
  );
}
