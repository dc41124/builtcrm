"use client";

import { useState } from "react";
import { Pill } from "@/components/pill";
import { EmptyState } from "@/components/empty-state";
import type { ContractorDashboardPriority } from "@/domain/loaders/contractor-dashboard";

type TabId = "priorities" | "approvals" | "projects" | "financials";

export type PrioritiesCardProps = {
  priorities: ContractorDashboardPriority[];
  approvals: ContractorDashboardPriority[];
  projectsTab: ContractorDashboardPriority[];
  financials: ContractorDashboardPriority[];
};

const TABS: { id: TabId; label: string }[] = [
  { id: "priorities", label: "Priorities" },
  { id: "approvals", label: "Approvals" },
  { id: "projects", label: "Projects" },
  { id: "financials", label: "Financials" },
];

const css = `
.pri-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);min-width:0}
.pri-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px 0}
.pri-head h3{font-family:var(--fd);font-size:15px;font-weight:740;letter-spacing:-.01em;margin:0;color:var(--t1)}
.pri-head .pri-sub{font-family:var(--fb);font-size:12px;color:var(--t2);margin-top:4px;font-weight:520}
.pri-badge{height:26px;padding:0 10px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-family:var(--fd);font-size:11px;font-weight:720;display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}
.pri-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:14px 20px 0;background:var(--s2);border-radius:var(--r-l);padding:4px}
.pri-tab{height:34px;padding:0 14px;border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:640;color:var(--t2);display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;background:none;border:none;cursor:pointer}
.pri-tab:hover{color:var(--t1);background:var(--sh)}
.pri-tab.on{background:var(--s1);color:var(--t1);font-weight:680;box-shadow:var(--shsm)}
.pri-note{padding:0 20px;margin-top:6px;font-family:var(--fb);font-size:12px;color:var(--t3);font-weight:520}
.pri-body{padding:16px 20px 20px}
`;

export function PrioritiesCard({
  priorities,
  approvals,
  projectsTab,
  financials,
}: PrioritiesCardProps) {
  const [active, setActive] = useState<TabId>("priorities");
  const rows =
    active === "priorities"
      ? priorities
      : active === "approvals"
        ? approvals
        : active === "projects"
          ? projectsTab
          : financials;

  return (
    <div className="pri-card">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="pri-head">
        <div>
          <h3>Today&rsquo;s priorities</h3>
          <div className="pri-sub">Work that needs action now across all projects</div>
        </div>
        <div className="pri-badge">Cross-project</div>
      </div>

      <div className="pri-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pri-tab${active === t.id ? " on" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pri-note">
        Triage urgent items, review pending approvals, and check project financials.
      </div>

      <div className="pri-body">
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing pressing"
            description="No items to review in this view right now."
          />
        ) : (
          <ul className="cd-rows">
            {rows.map((p) => (
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
      </div>
    </div>
  );
}
