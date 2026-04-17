"use client";

import { useState } from "react";
import Link from "next/link";

type PillType = "red" | "orange" | "blue" | "green" | "steel";

export type WorkspaceListItem = {
  id: string;
  title: string;
  description: string;
  pillLabel: string;
  pillType: PillType;
  time?: string | null;
  hot?: boolean;
  href?: string;
};

export type WorkspaceActivityEvent = {
  id: string;
  title: string;
  body: string | null;
  actorName: string | null;
  createdAt: string;
};

export type WorkspaceComplianceRow = {
  id: string;
  label: string;
  detail: string;
  statusLabel: string;
  statusColor: "red" | "amber" | "green" | "gray";
};

export type WorkspaceDocRow = {
  id: string;
  title: string;
  documentType: string;
  uploaderLabel: string;
  href: string;
};

export type WorkspaceConversationRow = {
  id: string;
  title: string;
  preview: string;
  unread: boolean;
  href: string;
};

export type WorkspaceMilestoneRow = {
  id: string;
  title: string;
  status: string;
  scheduledLabel: string;
};

export type ProjectHomeWorkspaceProps = {
  projectName: string;
  scopeLabel: string;
  activeTasks: WorkspaceListItem[];
  gcRequests: WorkspaceListItem[];
  activityEvents: WorkspaceActivityEvent[];
  rfiItems: WorkspaceListItem[];
  uploadItems: WorkspaceListItem[];
  complianceRows: WorkspaceComplianceRow[];
  documents: WorkspaceDocRow[];
  conversations: WorkspaceConversationRow[];
  milestones: WorkspaceMilestoneRow[];
  tabCounts: {
    rfis: number;
    uploads: number;
    compliance: number;
    docs: number;
    messages: number;
    schedule: number;
  };
};

export function SubProjectHomeWorkspace({
  projectName,
  scopeLabel,
  activeTasks,
  gcRequests,
  activityEvents,
  rfiItems,
  uploadItems,
  complianceRows,
  documents,
  conversations,
  milestones,
  tabCounts,
  nowMs: now,
}: ProjectHomeWorkspaceProps & { nowMs: number }) {
  const [tab, setTab] = useState("work");

  const tabs: Array<{
    id: string;
    label: string;
    badge?: number;
    badgeType?: "danger";
  }> = [
    { id: "work", label: "My Work" },
    { id: "rfis", label: "RFIs", badge: tabCounts.rfis || undefined },
    { id: "uploads", label: "Upload Responses", badge: tabCounts.uploads || undefined },
    {
      id: "compliance",
      label: "Compliance",
      badge: tabCounts.compliance || undefined,
      badgeType: tabCounts.compliance > 0 ? "danger" : undefined,
    },
    { id: "docs", label: "Documents", badge: tabCounts.docs || undefined },
    { id: "messages", label: "Messages", badge: tabCounts.messages || undefined },
    { id: "schedule", label: "Schedule", badge: tabCounts.schedule || undefined },
  ];

  return (
    <div className="stb-card">
      <div className="stb-cd-h">
        <div>
          <h3>Your workspace</h3>
          <div className="stb-cd-sub">
            Tasks, requests, and workflows scoped to your work on this project.
          </div>
        </div>
        <div className="stb-cd-badge">{projectName}</div>
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
                className={`stb-tb-b${t.badgeType === "danger" ? " danger" : ""}`}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="stb-ws-note">
        Everything here is scoped to your {scopeLabel.toLowerCase()} work on this project.
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
              <h4>Active tasks</h4>
              <ListRows items={activeTasks} emptyLabel="Nothing pending on your scope." />
            </div>
            <div className="stb-sfb">
              <h4>Recent movement on this project</h4>
              {activityEvents.length === 0 ? (
                <EmptyBlock text="No activity yet on this project." />
              ) : (
                <div className="stb-lst">
                  {activityEvents.map((a) => (
                    <div key={a.id} className="stb-lr">
                      <div className="stb-lr-main">
                        <h5>{a.title}</h5>
                        <p>
                          {a.body ??
                            (a.actorName ? `${a.actorName} updated this item.` : "")}
                        </p>
                      </div>
                      <div className="stb-lr-side">
                        <span className="stb-tm">{formatAgo(a.createdAt, now)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="stb-stk">
            <div className="stb-sfb stb-alrt">
              <h4>GC requests waiting on you</h4>
              <ListRows
                items={gcRequests}
                emptyLabel="No open GC requests on your scope."
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
      return (
        <div className="stb-sfb">
          <h4>Open RFIs for your team</h4>
          <ListRows items={rfiItems} emptyLabel="No open RFIs waiting on your team." />
        </div>
      );
    }

    if (current === "uploads") {
      return (
        <div className="stb-sfb">
          <h4>GC upload requests</h4>
          <ListRows
            items={uploadItems}
            emptyLabel="No outstanding upload requests."
          />
        </div>
      );
    }

    if (current === "compliance") {
      if (complianceRows.length === 0) {
        return (
          <div className="stb-sfb">
            <h4>Compliance</h4>
            <EmptyBlock text="No compliance records on this project yet." />
          </div>
        );
      }
      return (
        <div className="stb-sfb">
          <h4>Compliance records</h4>
          <div className="stb-lst">
            {complianceRows.map((c) => (
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
      if (documents.length === 0) {
        return (
          <div className="stb-sfb">
            <h4>Documents</h4>
            <EmptyBlock text="No documents have been shared with you yet." />
          </div>
        );
      }
      return (
        <div className="stb-sfb">
          <h4>Project documents</h4>
          <div className="stb-lst">
            {documents.map((d) => (
              <Link key={d.id} href={d.href} className="stb-lr">
                <div className="stb-lr-main">
                  <h5>{d.title}</h5>
                  <p>{d.uploaderLabel}</p>
                </div>
                <div className="stb-lr-side">
                  <span className="stb-pl steel">{d.documentType}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      );
    }

    if (current === "messages") {
      if (conversations.length === 0) {
        return (
          <div className="stb-sfb">
            <h4>Messages</h4>
            <EmptyBlock text="No conversations yet on this project." />
          </div>
        );
      }
      return (
        <div className="stb-sfb">
          <h4>Project conversations</h4>
          <div className="stb-lst">
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className={`stb-lr${c.unread ? " hot" : ""}`}
              >
                <div className="stb-lr-main">
                  <h5>{c.title}</h5>
                  <p>{c.preview}</p>
                </div>
                <div className="stb-lr-side">
                  {c.unread ? (
                    <span className="stb-pl blue">Unread</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      );
    }

    if (current === "schedule") {
      if (milestones.length === 0) {
        return (
          <div className="stb-sfb">
            <h4>Schedule</h4>
            <EmptyBlock text="No milestones assigned to your team yet." />
          </div>
        );
      }
      return (
        <div className="stb-sfb">
          <h4>Your milestones</h4>
          <div className="stb-lst">
            {milestones.map((m) => (
              <div key={m.id} className="stb-lr">
                <div className="stb-lr-main">
                  <h5>{m.title}</h5>
                  <p>{m.status}</p>
                </div>
                <div className="stb-lr-side">
                  <span className="stb-tm">{m.scheduledLabel}</span>
                </div>
              </div>
            ))}
          </div>
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
  items: WorkspaceListItem[];
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

function formatAgo(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
