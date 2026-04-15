import Link from "next/link";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill } from "@/components/pill";
import { getSubcontractorTodayData } from "@/domain/loaders/subcontractor-today";
import { loadPortalShell } from "@/lib/portal-shell";

import { TodayAttentionList } from "./today-board";

export default async function SubcontractorTodayPage() {
  const shell = await loadPortalShell("subcontractor");
  const data = await getSubcontractorTodayData({ subOrganizationId: shell.orgId });
  const k = data.kpis;

  return (
    <div className="stb">
      <div className="stb-ph">
        <div>
          <h1 className="stb-pt">Today Board</h1>
          <p className="stb-pst">
            What the GC needs from you, what&apos;s due, and where things stand across your
            projects.
          </p>
        </div>
      </div>

      <div className="stb-kpis">
        <KpiCard
          label="Active projects"
          value={k.activeProjects.toString()}
          meta={k.activeProjects === 0 ? "Awaiting assignment" : "Your assigned work"}
          iconColor="blue"
        />
        <KpiCard
          label="GC upload requests"
          value={k.openUploadRequests.toString()}
          meta={
            k.uploadRequestsDueToday > 0
              ? `${k.uploadRequestsDueToday} due today`
              : k.openUploadRequests === 0
                ? "All clear"
                : "Open"
          }
          trendType="warn"
          iconColor="amber"
        />
        <KpiCard
          label="RFIs needing reply"
          value={k.openRfis.toString()}
          meta={k.overdueRfis === 0 ? "On pace" : undefined}
          trend={k.overdueRfis > 0 ? `${k.overdueRfis} overdue` : undefined}
          trendType="down"
          iconColor="purple"
        />
        <KpiCard label="Payments pending" value="—" meta="Paid through GC" iconColor="green" />
        <KpiCard
          label="Compliance"
          value={k.complianceIssues.toString()}
          trend={k.complianceLabel ?? undefined}
          trendType="warn"
          iconColor="red"
          alert={k.complianceIssues > 0}
        />
      </div>

      <div className="stb-dash">
        <div className="stb-main">
          <TodayAttentionList attention={data.attention} projects={data.projectList} />

          <Card title="Your projects" subtitle="Status across your active assignments">
            {data.projectList.length === 0 ? (
              <EmptyState
                title="No active projects"
                description="When a GC adds your company to a project, it will appear here."
              />
            ) : (
              <ul className="stb-proj-rows">
                {data.projectList.map((p) => (
                  <li key={p.id} className="stb-proj-row">
                    <Link href={`/subcontractor/project/${p.id}`} className="stb-proj-body">
                      <h5>{p.name}</h5>
                      <p>{p.description}</p>
                    </Link>
                    <div className="stb-proj-meta">
                      <Pill color={p.pillColor}>{p.pillLabel}</Pill>
                      <span className="stb-proj-phase">{p.phaseLabel}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="stb-rail">
          <Card
            title="Compliance"
            subtitle="Required for continued project access"
            alert={k.complianceIssues > 0}
          >
            {data.compliance.length === 0 ? (
              <EmptyState
                title="No compliance records"
                description="Your company has no documents on file yet."
              />
            ) : (
              <ul className="stb-comp-rows">
                {data.compliance.map((c) => (
                  <li key={c.id} className="stb-comp-row">
                    <div className="stb-comp-info">
                      <h5>{c.label}</h5>
                      <p>{c.detail}</p>
                    </div>
                    <Pill color={c.statusColor}>{c.statusLabel}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Payment status" subtitle="Tracked per project">
            <EmptyState
              title="No payments yet"
              description="Draw and PO status will appear here when the GC issues them."
            />
          </Card>

          <Card title="Your GC contacts" subtitle="Project managers across your assignments">
            {data.projectList.length === 0 ? (
              <EmptyState
                title="No contacts yet"
                description="GC PMs appear here once you&apos;re added to a project."
              />
            ) : (
              <ul className="stb-gc-rows">
                {data.projectList.map((p) => (
                  <li key={p.id} className="stb-gc-row">
                    <div className="stb-gc-name">{p.name}</div>
                    <Link
                      href={`/subcontractor/project/${p.id}/messages`}
                      className="stb-gc-link"
                    >
                      Message team →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <style>{`
        .stb{display:flex;flex-direction:column;gap:20px}
        .stb-ph{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
        .stb-pt{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
        .stb-pst{margin:6px 0 0;font-family:var(--fb);font-size:14px;font-weight:520;color:var(--t2);max-width:640px}
        .stb-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
        .stb-dash{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
        .stb-main{display:flex;flex-direction:column;gap:16px;min-width:0}
        .stb-rail{display:flex;flex-direction:column;gap:16px;min-width:0}
        .stb-proj-rows{list-style:none;margin:0;padding:0}
        .stb-proj-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 4px}
        .stb-proj-row+.stb-proj-row{border-top:1px solid var(--s3)}
        .stb-proj-body{min-width:0;flex:1;text-decoration:none;color:inherit}
        .stb-proj-body h5{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.01em;line-height:1.3;margin:0}
        .stb-proj-body p{font-family:var(--fb);font-size:12.5px;font-weight:520;color:var(--t2);margin:2px 0 0}
        .stb-proj-meta{display:flex;align-items:center;gap:8px;flex-shrink:0}
        .stb-proj-phase{font-family:var(--fd);font-size:11px;font-weight:680;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .stb-comp-rows{list-style:none;margin:0;padding:0}
        .stb-comp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}
        .stb-comp-row+.stb-comp-row{border-top:1px solid var(--s3)}
        .stb-comp-info h5{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);margin:0}
        .stb-comp-info p{font-family:var(--fb);font-size:12px;color:var(--t2);margin:2px 0 0}
        .stb-gc-rows{list-style:none;margin:0;padding:0}
        .stb-gc-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0}
        .stb-gc-row+.stb-gc-row{border-top:1px solid var(--s3)}
        .stb-gc-name{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1)}
        .stb-gc-link{font-family:var(--fd);font-size:12px;font-weight:680;color:var(--ac-t);text-decoration:none}
        .stb-gc-link:hover{text-decoration:underline}
        @media(max-width:1280px){.stb-kpis{grid-template-columns:repeat(3,1fr)}.stb-dash{grid-template-columns:1fr}}
        @media(max-width:767px){
          .stb-pt{font-size:22px}
          .stb-pst{font-size:13px}
          .stb-kpis{grid-template-columns:repeat(2,1fr);gap:10px}
          .stb-proj-row{flex-direction:column;align-items:flex-start;gap:8px}
          .stb-proj-meta{flex-wrap:wrap}
        }
        @media(max-width:420px){.stb-kpis{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
