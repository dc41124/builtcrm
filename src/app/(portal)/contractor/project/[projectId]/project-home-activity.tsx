"use client";

import { useState } from "react";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";

export type ActivityRow = {
  id: string;
  type: "rfi" | "co" | "billing" | "compliance";
  title: string;
  description: string;
  pillLabel: string;
  pillColor: PillColor;
  time: string;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "rfi", label: "RFIs" },
  { id: "co", label: "Change Orders" },
  { id: "billing", label: "Billing" },
  { id: "compliance", label: "Compliance" },
];

export function ProjectHomeActivity({ items }: { items: ActivityRow[] }) {
  const [tab, setTab] = useState("all");
  const filtered = tab === "all" ? items : items.filter((i) => i.type === tab);

  return (
    <Card
      title="Recent workflow activity"
      subtitle="Latest changes across every project workflow"
      tabs={TABS}
      activeTabId={tab}
      onTabChange={setTab}
    >
      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing recent"
          description="Activity for this filter will appear here as work progresses."
        />
      ) : (
        <ul className="cph-act">
          {filtered.map((r) => (
            <li key={r.id} className="cph-act-row">
              <div className="cph-act-body">
                <h5>{r.title}</h5>
                <p>{r.description}</p>
              </div>
              <div className="cph-act-meta">
                <Pill color={r.pillColor}>{r.pillLabel}</Pill>
                <span className="cph-act-time">{r.time}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .cph-act{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
        .cph-act-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px;border-radius:var(--r-m);transition:background var(--df) var(--e)}
        .cph-act-row:hover{background:var(--sh)}
        .cph-act-body{min-width:0;flex:1}
        .cph-act-body h5{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.01em;margin:0 0 3px}
        .cph-act-body p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.45}
        .cph-act-meta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
        .cph-act-time{font-family:var(--fb);font-size:11.5px;font-weight:560;color:var(--t3)}
      `}</style>
    </Card>
  );
}
