"use client";

import { useState } from "react";
import { Card } from "@/components/card";
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
    <Card
      title="Today's priorities"
      subtitle="Work that needs action now across all projects"
      tabs={TABS}
      activeTabId={active}
      onTabChange={(id) => setActive(id as TabId)}
      headerRight={<button className="cd-viewall" type="button">View all</button>}
    >
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
    </Card>
  );
}
