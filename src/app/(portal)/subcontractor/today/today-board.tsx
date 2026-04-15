"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/card";
import { Pill } from "@/components/pill";
import { EmptyState } from "@/components/empty-state";
import type {
  SubTodayAttention,
  SubTodayProject,
} from "@/domain/loaders/subcontractor-today";

export type TodayAttentionListProps = {
  attention: SubTodayAttention[];
  projects: SubTodayProject[];
};

export function TodayAttentionList({ attention, projects }: TodayAttentionListProps) {
  const [tab, setTab] = useState<string>("all");
  const tabs = useMemo(
    () => [
      { id: "all", label: "All" },
      ...projects.map((p) => ({ id: p.id, label: shortName(p.name) })),
    ],
    [projects],
  );
  const filtered = tab === "all" ? attention : attention.filter((a) => a.projectId === tab);

  return (
    <Card
      title="What needs your attention"
      subtitle="GC requests, RFIs, and compliance across your projects"
      tabs={tabs}
      activeTabId={tab}
      onTabChange={setTab}
    >
      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing pressing"
          description="No open requests from any GC right now."
        />
      ) : (
        <ul className="stb-rows">
          {filtered.map((item) => (
            <li key={item.id} className={`stb-row ${item.urgent ? "stb-row-urgent" : ""}`}>
              <Link href={item.href} className="stb-row-body">
                <h5>{item.title}</h5>
                <p>{item.description}</p>
              </Link>
              <div className="stb-row-meta">
                <span className="stb-proj-tag">{shortName(item.projectName)}</span>
                <Pill color={item.pillColor}>{item.pillLabel}</Pill>
              </div>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .stb-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
        .stb-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 4px}
        .stb-row+.stb-row{border-top:1px solid var(--s3)}
        .stb-row-urgent{border-left:3px solid var(--dg);padding-left:13px}
        .stb-row-body{min-width:0;flex:1;text-decoration:none;color:inherit}
        .stb-row-body h5{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.01em;line-height:1.3;margin:0}
        .stb-row-body p{font-family:var(--fb);font-size:12.5px;font-weight:520;color:var(--t2);margin:2px 0 0;line-height:1.4}
        .stb-row-meta{display:flex;align-items:center;gap:8px;flex-shrink:0;padding-top:1px}
        .stb-proj-tag{font-family:var(--fd);font-size:10.5px;font-weight:680;color:var(--ac-t);background:var(--ac-s);padding:3px 7px;border-radius:4px;white-space:nowrap}
      `}</style>
    </Card>
  );
}

function shortName(name: string): string {
  const first = name.split(/[·\-—]/)[0]?.trim() ?? name;
  const words = first.split(/\s+/);
  return words.slice(0, 2).join(" ");
}
