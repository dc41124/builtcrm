"use client";

import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";

export type WorkspaceTab = {
  id: string;
  label: string;
  href: string;
  badge?: number;
  badgeType?: "default" | "warn" | "danger";
};

export type WorkspaceCardProps = {
  tabs: WorkspaceTab[];
  todayContent: ReactNode;
};

export function WorkspaceCard({ tabs, todayContent }: WorkspaceCardProps) {
  const [active, setActive] = useState<string>("today");
  const activeTab = tabs.find((t) => t.id === active);

  return (
    <div className="cph-ws">
      <div className="cph-ws-head">
        <div>
          <h3>Project workspace</h3>
          <div className="sub">
            Primary entry points into this project&rsquo;s live operating surface.
          </div>
        </div>
        <div className="cph-ws-badge">Live workspace</div>
      </div>

      <div className="cph-ws-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`cph-ws-tab ${active === t.id ? "on" : ""}`}
            onClick={() => setActive(t.id)}
            type="button"
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                className={`cph-tb-b ${t.badgeType && t.badgeType !== "default" ? t.badgeType : ""}`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="cph-ws-note">
        Switch between current action, workflows, and project records without leaving this surface.
      </div>

      <div className="cph-ws-body">
        {active === "today" ? (
          todayContent
        ) : (
          <EmptyState
            title={`${activeTab?.label ?? "Workflow"} overview`}
            description={`Full ${activeTab?.label ?? "workflow"} list lives on the dedicated page.`}
            cta={
              activeTab ? (
                <a className="cph-btn" href={activeTab.href}>
                  Open {activeTab.label} →
                </a>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
