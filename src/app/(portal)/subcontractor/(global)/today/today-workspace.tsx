"use client";

import { useState } from "react";
import Link from "next/link";

import type {
  SubTodayAttention,
  SubTodayCompliance,
  SubTodayConversation,
  SubTodayDocument,
  SubTodayProject,
} from "@/domain/loaders/subcontractor-today";

type PillType = "red" | "orange" | "blue" | "green" | "steel";

type ListItem = {
  id: string;
  title: string;
  description: string;
  pillLabel: string;
  pillType: PillType;
  time?: string | null;
  hot?: boolean;
  href?: string;
};

type Tab = {
  id: string;
  label: string;
  badge?: number;
  badgeType?: "default" | "warn" | "danger";
};

export type TodayWorkspaceProps = {
  attention: SubTodayAttention[];
  projectList: SubTodayProject[];
  compliance: SubTodayCompliance[];
  recentDocuments: SubTodayDocument[];
  recentConversations: SubTodayConversation[];
  tabCounts: {
    rfis: number;
    uploads: number;
    compliance: number;
    messages: number;
    documents: number;
  };
};

function mapPillColor(color: SubTodayAttention["pillColor"]): PillType {
  switch (color) {
    case "red":
      return "red";
    case "amber":
      return "orange";
    case "blue":
      return "blue";
    case "green":
      return "green";
    default:
      return "steel";
  }
}

function attentionToItem(a: SubTodayAttention): ListItem {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    pillLabel: a.pillLabel,
    pillType: mapPillColor(a.pillColor),
    hot: a.urgent,
    href: a.href,
  };
}

export function SubcontractorTodayWorkspace({
  attention,
  projectList,
  compliance,
  recentDocuments,
  recentConversations,
  tabCounts,
}: TodayWorkspaceProps) {
  const [tab, setTab] = useState("work");

  const tabs: Tab[] = [
    { id: "work", label: "My Work" },
    { id: "rfis", label: "RFIs", badge: tabCounts.rfis },
    { id: "uploads", label: "Upload Responses", badge: tabCounts.uploads },
    {
      id: "compliance",
      label: "Compliance",
      badge: tabCounts.compliance || undefined,
      badgeType: tabCounts.compliance > 0 ? "danger" : undefined,
    },
    { id: "docs", label: "Documents", badge: tabCounts.documents || undefined },
    { id: "messages", label: "Messages", badge: tabCounts.messages || undefined },
    { id: "payments", label: "Payments" },
  ];

  const attentionItems = attention.map(attentionToItem);
  const gcRequestItems = attention
    .filter((a) => a.kind === "upload" || a.kind === "compliance")
    .map(attentionToItem);

  const acrossItems: ListItem[] = projectList.map((p) => ({
    id: `proj-${p.id}`,
    title: p.name,
    description: p.description,
    pillLabel: p.pillLabel,
    pillType:
      p.pillColor === "green"
        ? "green"
        : p.pillColor === "red"
          ? "red"
          : p.pillColor === "amber"
            ? "orange"
            : "steel",
    href: `/subcontractor/project/${p.id}`,
  }));

  return (
    <div className="stb-card">
      <div className="stb-cd-h">
        <div>
          <h3>Execution workspace</h3>
          <div className="stb-cd-sub">
            Work and response surface across your assigned projects.
          </div>
        </div>
        <div className="stb-cd-badge">Cross-project</div>
      </div>

      <div className="stb-wt-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`stb-wt${tab === t.id ? " on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge ? (
              <span
                className={`stb-tb-b${
                  t.badgeType === "danger"
                    ? " danger"
                    : t.badgeType === "warn"
                      ? " warn"
                      : ""
                }`}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="stb-ws-note">
        Switch between assigned work, response workflows, compliance, scoped
        files, and payment visibility.
      </div>

      <div className="stb-cd-body">{renderTabBody(tab)}</div>
    </div>
  );

  function renderTabBody(current: string) {
    if (current === "work") {
      return (
        <div className="stb-ml">
          <div className="stb-stk">
            <div className="stb-sfb stb-dom">
              <h4>What needs attention now</h4>
              <ListRows items={attentionItems} emptyLabel="Nothing pressing right now." />
            </div>
            <div className="stb-sfb">
              <h4>Today across projects</h4>
              <ListRows
                items={acrossItems}
                emptyLabel="No active project assignments."
              />
            </div>
          </div>
          <div className="stb-stk">
            <div className="stb-sfb stb-alrt">
              <h4>GC requests waiting on you</h4>
              <ListRows
                items={gcRequestItems}
                emptyLabel="No open GC requests."
              />
            </div>
            <div className="stb-sfb">
              <h4>Payment status</h4>
              <EmptyBlock text="Draw and PO status will appear here when the GC issues them." />
            </div>
          </div>
        </div>
      );
    }

    if (current === "rfis") {
      const items = attention.filter((a) => a.kind === "rfi").map(attentionToItem);
      return (
        <div className="stb-sfb">
          <h4>Open RFIs across projects</h4>
          <ListRows items={items} emptyLabel="No open RFIs waiting on your team." />
        </div>
      );
    }

    if (current === "uploads") {
      const items = attention.filter((a) => a.kind === "upload").map(attentionToItem);
      return (
        <div className="stb-sfb">
          <h4>GC upload requests</h4>
          <ListRows items={items} emptyLabel="No outstanding upload requests." />
        </div>
      );
    }

    if (current === "compliance") {
      if (compliance.length === 0) {
        return (
          <div className="stb-sfb">
            <h4>Compliance</h4>
            <EmptyBlock text="No compliance records on file yet." />
          </div>
        );
      }
      return (
        <div className="stb-sfb">
          <h4>Compliance records</h4>
          <div className="stb-lst">
            {compliance.map((c) => (
              <div
                key={c.id}
                className={`stb-lr${c.statusColor === "red" ? " hot" : ""}`}
              >
                <div className="stb-lr-main">
                  <h5>{c.label}</h5>
                  <p>{c.detail}</p>
                </div>
                <div className="stb-lr-side">
                  <span
                    className={`stb-pl ${
                      c.statusColor === "red"
                        ? "red"
                        : c.statusColor === "amber"
                          ? "orange"
                          : c.statusColor === "green"
                            ? "green"
                            : "steel"
                    }`}
                  >
                    {c.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (current === "docs") {
      return (
        <div className="stb-sfb">
          <h4>Recent documents across projects</h4>
          {recentDocuments.length === 0 ? (
            <EmptyBlock text="No documents available yet." />
          ) : (
            <div className="stb-lst">
              {recentDocuments.map((d) => (
                <Link key={d.id} href={`/subcontractor/project/${d.projectId}/documents`} className="stb-lr">
                  <div className="stb-lr-main">
                    <h5>{d.title}</h5>
                    <p>{d.projectName} · {d.documentType}{d.uploaderName ? ` · ${d.uploaderName}` : ""}</p>
                  </div>
                  <div className="stb-lr-side">
                    <span className="stb-pl steel">{d.documentType.toUpperCase().slice(0, 4)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (current === "messages") {
      return (
        <div className="stb-sfb">
          <h4>Conversations across projects</h4>
          {recentConversations.length === 0 ? (
            <EmptyBlock text="No conversations yet." />
          ) : (
            <div className="stb-lst">
              {recentConversations.map((c) => (
                <Link key={c.id} href={`/subcontractor/project/${c.projectId}/messages`} className={`stb-lr${c.unreadCount > 0 ? " hot" : ""}`}>
                  <div className="stb-lr-main">
                    <h5>{c.title ?? "General"}</h5>
                    <p>{c.projectName}{c.lastMessagePreview ? ` · ${c.lastMessagePreview.slice(0, 80)}` : ""}</p>
                  </div>
                  <div className="stb-lr-side">
                    {c.unreadCount > 0 ? (
                      <span className="stb-pl red">Unread</span>
                    ) : (
                      <span className="stb-pl green">Read</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (current === "payments") {
      return (
        <div className="stb-sfb">
          <h4>Payment status across projects</h4>
          {projectList.length === 0 ? (
            <EmptyBlock text="No project assignments yet." />
          ) : (
            <div className="stb-lst">
              {projectList.map((p) => (
                <Link key={p.id} href={`/subcontractor/project/${p.id}/payments`} className="stb-lr">
                  <div className="stb-lr-main">
                    <h5>{p.name}</h5>
                    <p>{p.phaseLabel} · Payment tracking</p>
                  </div>
                  <div className="stb-lr-side">
                    <span className="stb-pl steel">View</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  }
}

function ListRows({
  items,
  emptyLabel,
}: {
  items: ListItem[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <EmptyBlock text={emptyLabel} />;
  }
  return (
    <div className="stb-lst">
      {items.map((r) => {
        const body = (
          <>
            <div className="stb-lr-main">
              <h5>{r.title}</h5>
              <p>{r.description}</p>
            </div>
            <div className="stb-lr-side">
              <span className={`stb-pl ${r.pillType}`}>{r.pillLabel}</span>
              {r.time ? <span className="stb-tm">{r.time}</span> : null}
            </div>
          </>
        );
        if (r.href) {
          return (
            <Link
              key={r.id}
              href={r.href}
              className={`stb-lr${r.hot ? " hot" : ""}`}
            >
              {body}
            </Link>
          );
        }
        return (
          <div key={r.id} className={`stb-lr${r.hot ? " hot" : ""}`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="stb-empty">{text}</div>;
}
