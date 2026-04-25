"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  TransmittalActivityRow,
  TransmittalListRow,
  TransmittalStatus,
} from "@/domain/loaders/transmittals";

import {
  Icon,
  STATUS_LABEL,
  formatBytes,
  formatDateTime,
  initials,
  plural,
  relativeTime,
} from "../../../../transmittals-shared";
import { CreateTransmittalModal } from "./create-modal";

export type ProjectDocPick = {
  id: string;
  title: string;
  category: string;
  sizeBytes: number;
};

type StatusFilter = "all" | "draft" | "sent";

export function TransmittalsWorkspace({
  projectId,
  projectName,
  rows,
  activity,
  projectDocs,
}: {
  projectId: string;
  projectName: string;
  rows: TransmittalListRow[];
  activity: TransmittalActivityRow[];
  projectDocs: ProjectDocPick[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const portalBase = `/contractor/project/${projectId}`;

  const kpiTotal = rows.length;
  const kpiSent = rows.filter((r) => r.status === "sent").length;
  const kpiDraft = rows.filter((r) => r.status === "draft").length;
  const kpiPending = rows.reduce((s, r) => s + r.pendingCount, 0);
  const kpiDownloads = rows.reduce((s, r) => s + r.totalDownloads, 0);

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !r.numberLabel.toLowerCase().includes(q) &&
            !r.subject.toLowerCase().includes(q) &&
            !r.message.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      }),
    [rows, statusFilter, search],
  );

  return (
    <>
      <div className="tm-page-hdr">
        <div>
          <h1 className="tm-page-title">Transmittals</h1>
          <div className="tm-page-sub">
            {projectName ? `${projectName} · ` : ""}Formal cover-letter sends
            with document bundles.{" "}
            {kpiPending > 0 ? (
              <>
                <span style={{ color: "var(--wr)", fontWeight: 640 }}>
                  {plural(
                    kpiPending,
                    "recipient hasn't",
                    "recipients haven't",
                  )}{" "}
                  downloaded yet
                </span>{" "}
                across sent transmittals.
              </>
            ) : kpiSent > 0 ? (
              <>All recipients have downloaded their bundles.</>
            ) : (
              <>No transmittals sent on this project yet.</>
            )}
          </div>
        </div>
        <button
          type="button"
          className="tm-btn primary"
          onClick={() => setCreateOpen(true)}
        >
          {Icon.plus} New transmittal
        </button>
      </div>

      <div className="tm-kpi-strip">
        <div className="tm-kpi">
          <div className="tm-kpi-label">Total</div>
          <div className="tm-kpi-value">{kpiTotal}</div>
          <div className="tm-kpi-sub">on this project</div>
        </div>
        <div className="tm-kpi">
          <div className="tm-kpi-label">Sent</div>
          <div className="tm-kpi-value">{kpiSent}</div>
          <div className="tm-kpi-sub">formally issued</div>
        </div>
        <div className="tm-kpi">
          <div className="tm-kpi-label">Pending downloads</div>
          <div className={`tm-kpi-value${kpiPending > 0 ? " warn" : ""}`}>
            {kpiPending}
          </div>
          <div className="tm-kpi-sub">recipients haven&apos;t opened</div>
        </div>
        <div className="tm-kpi">
          <div className="tm-kpi-label">Total downloads</div>
          <div className="tm-kpi-value">{kpiDownloads}</div>
          <div className="tm-kpi-sub">access events logged</div>
        </div>
        <div className="tm-kpi">
          <div className="tm-kpi-label">Drafts</div>
          <div className="tm-kpi-value muted">{kpiDraft}</div>
          <div className="tm-kpi-sub">awaiting send</div>
        </div>
      </div>

      <div className="tm-filter-bar">
        <div className="tm-search">
          {Icon.search}
          <input
            type="text"
            placeholder="Search by number, subject, or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tm-filter-tabs">
          {(
            [
              ["all", "All", kpiTotal],
              ["sent", "Sent", kpiSent],
              ["draft", "Drafts", kpiDraft],
            ] as Array<[StatusFilter, string, number]>
          ).map(([k, label, count]) => (
            <button
              key={k}
              type="button"
              className={`tm-filter-tab${statusFilter === k ? " active" : ""}`}
              onClick={() => setStatusFilter(k)}
            >
              {label}
              <span className="tm-filter-tab-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tm-workspace-grid">
        <div className="tm-list">
          {visible.length === 0 ? (
            <div className="tm-empty">
              <div className="tm-empty-icon">{Icon.mail}</div>
              <div className="tm-empty-title">No transmittals match</div>
              <div className="tm-empty-sub">
                Try clearing the search or switching the status filter.
              </div>
            </div>
          ) : (
            visible.map((t) => (
              <TransmittalRow
                key={t.id}
                t={t}
                href={
                  t.status === "draft"
                    ? `${portalBase}/transmittals/${t.id}/draft`
                    : `${portalBase}/transmittals/${t.id}`
                }
              />
            ))
          )}
        </div>

        <aside className="tm-rail">
          <div className="tm-rail-hdr">
            <h3>Recent activity</h3>
          </div>
          <div className="tm-rail-body">
            {activity.length === 0 ? (
              <div
                style={{
                  padding: "20px 14px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12,
                }}
              >
                No activity yet.
              </div>
            ) : (
              activity.map((a, idx) => (
                <ActivityItem
                  key={idx}
                  row={a}
                  href={
                    a.relatedTransmittalId
                      ? `${portalBase}/transmittals/${a.relatedTransmittalId}`
                      : null
                  }
                />
              ))
            )}
          </div>
        </aside>
      </div>

      <CreateTransmittalModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        projectDocs={projectDocs}
        onCreated={(transmittalId, sent) => {
          setCreateOpen(false);
          if (sent) {
            router.push(`${portalBase}/transmittals/${transmittalId}`);
          } else {
            router.push(`${portalBase}/transmittals/${transmittalId}/draft`);
          }
          router.refresh();
        }}
      />
    </>
  );
}

function TransmittalRow({
  t,
  href,
}: {
  t: TransmittalListRow;
  href: string;
}) {
  const showSentMeta = t.status === "sent";
  return (
    <Link href={href} className={`tm-row${t.status === "draft" ? " draft" : ""}`}>
      <div className="tm-row-num">
        <span className={`tm-status-pill ${t.status}`}>
          {t.status === "sent" ? Icon.check : Icon.edit}
          {STATUS_LABEL[t.status as TransmittalStatus]}
        </span>
        <span className="tm-row-num-code">{t.numberLabel}</span>
      </div>
      <div className="tm-row-body">
        <div className="tm-row-subject">
          {t.subject || (
            <em style={{ opacity: 0.5 }}>No subject</em>
          )}
        </div>
        <div className="tm-row-meta">
          <span>
            {Icon.doc} {plural(t.docCount, "doc", "docs")}
            {t.totalSizeBytes > 0 ? <> · {formatBytes(t.totalSizeBytes)}</> : null}
          </span>
          <span>
            {Icon.user}{" "}
            {plural(t.recipientCount, "recipient", "recipients")}
          </span>
          {showSentMeta ? (
            <span>
              {Icon.download}{" "}
              {plural(t.totalDownloads, "download", "downloads")}
            </span>
          ) : null}
          {t.sentAt ? (
            <span>
              {Icon.clock} Sent {formatDateTime(t.sentAt)}
            </span>
          ) : (
            <span style={{ color: "var(--text-tertiary)" }}>Not yet sent</span>
          )}
        </div>
      </div>
      <div className="tm-row-right">
        {t.status === "sent" ? (
          <div className="tm-download-bar">
            <div className="tm-download-bar-label">
              {t.downloadedCount}/{t.recipientCount} downloaded
            </div>
            <div className="tm-download-bar-track">
              <div
                className={`tm-download-bar-fill${t.pendingCount === 0 ? " complete" : ""}`}
                style={{
                  width:
                    t.recipientCount === 0
                      ? "0%"
                      : `${(t.downloadedCount / t.recipientCount) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <span className="tm-row-draft-chip">Resume editing</span>
        )}
        <span className="tm-row-arrow">{Icon.chevR}</span>
      </div>
    </Link>
  );
}

function ActivityItem({
  row,
  href,
}: {
  row: TransmittalActivityRow;
  href: string | null;
}) {
  const isSystem = !row.actorName;
  // Pick a color hint from the title text — this drives the avatar
  // accent so the rail visually parses (downloads green, sends blue,
  // revokes red). Cheap heuristic; deterministic enough for the rail.
  const lowered = row.title.toLowerCase();
  const kind = lowered.includes("download")
    ? "download"
    : lowered.includes("revok")
      ? "revoke"
      : lowered.includes("sent") || lowered.includes("send")
        ? "send"
        : "send";
  const avatar = (
    <div className={`tm-rail-avatar${isSystem ? " sys" : ""} ${kind}`}>
      {isSystem ? Icon.shield : initials(row.actorName ?? "?")}
    </div>
  );
  const body = (
    <div className="tm-rail-item-body">
      <div className="tm-rail-item-text">
        <strong>{row.actorName ?? "System"}</strong> {row.title}
      </div>
      {row.body ? (
        <div className="tm-rail-item-target">{row.body}</div>
      ) : null}
      <div className="tm-rail-item-when">{relativeTime(row.createdAt)}</div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="tm-rail-item">
        {avatar}
        {body}
      </Link>
    );
  }
  return (
    <div className="tm-rail-item">
      {avatar}
      {body}
    </div>
  );
}
