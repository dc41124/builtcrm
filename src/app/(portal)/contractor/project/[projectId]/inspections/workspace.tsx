"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  InspectionListRow,
  InspectionTemplateRow,
} from "@/domain/loaders/inspections";
import {
  Icon,
  PassRatePill,
  StatusPill,
  TradeBadge,
  formatDateShort,
  tradeAppearance,
} from "../../../../inspections-shared";

type Props = {
  projectId: string;
  projectName: string;
  rows: InspectionListRow[];
  templates: InspectionTemplateRow[];
  subOrgs: Array<{ id: string; name: string }>;
};

type StatusFilter = "all" | "scheduled" | "in_progress" | "completed";

export function InspectionsWorkspace({
  projectId,
  projectName,
  rows,
  templates,
  subOrgs,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const portalBase = `/contractor/project/${projectId}`;

  // KPI strip
  const kpiScheduled = rows.filter((r) => r.status === "scheduled").length;
  const kpiInProgress = rows.filter((r) => r.status === "in_progress").length;
  const completedRows = rows.filter((r) => r.status === "completed");
  const kpiPassRate = useMemo(() => {
    if (completedRows.length === 0) return 0;
    const rates = completedRows
      .map((r) => r.passRate)
      .filter((v): v is number => v != null);
    if (rates.length === 0) return 0;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }, [completedRows]);
  const kpiPunchTotal = rows.reduce((s, r) => s + r.punchCount, 0);

  // Trade summary strip
  const trades = useMemo(() => {
    const byTrade = new Map<
      string,
      { scheduled: number; inProgress: number; completed: number; rates: number[] }
    >();
    for (const r of rows) {
      const bucket = byTrade.get(r.templateTradeCategory) ?? {
        scheduled: 0,
        inProgress: 0,
        completed: 0,
        rates: [],
      };
      if (r.status === "scheduled") bucket.scheduled += 1;
      if (r.status === "in_progress") bucket.inProgress += 1;
      if (r.status === "completed") {
        bucket.completed += 1;
        if (r.passRate != null) bucket.rates.push(r.passRate);
      }
      byTrade.set(r.templateTradeCategory, bucket);
    }
    return Array.from(byTrade.entries()).map(([trade, b]) => ({
      trade,
      scheduled: b.scheduled,
      inProgress: b.inProgress,
      completed: b.completed,
      passRate:
        b.rates.length > 0
          ? Math.round(b.rates.reduce((a, c) => a + c, 0) / b.rates.length)
          : null,
    }));
  }, [rows]);

  // Visible rows
  const visibleRows = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (tradeFilter !== "all" && r.templateTradeCategory !== tradeFilter)
      return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay =
        `${r.numberLabel} ${r.templateName} ${r.zone} ${r.assignedOrgName ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="in-content">
      <div className="in-page-hdr">
        <div>
          <h1 className="in-page-title">Inspections</h1>
          <div className="in-page-sub">
            QA/QC checklists{projectName ? ` · ${projectName}` : ""}
          </div>
        </div>
        <div className="in-page-actions">
          <Link
            href="/contractor/settings/inspection-templates"
            className="in-btn"
          >
            {Icon.copy} Templates
          </Link>
          <button
            className="in-btn primary"
            onClick={() => setShowCreate(true)}
            type="button"
            disabled={templates.length === 0 || subOrgs.length === 0}
          >
            {Icon.plus} New inspection
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="in-kpi-strip">
        <div className="in-kpi">
          <div className="in-kpi-label">Scheduled</div>
          <div className="in-kpi-val">{kpiScheduled}</div>
          <div className="in-kpi-meta">Across all trades</div>
        </div>
        <div className="in-kpi">
          <div className="in-kpi-label">In progress</div>
          <div className="in-kpi-val wr">{kpiInProgress}</div>
          <div className="in-kpi-meta">Subs actively completing</div>
        </div>
        <div className="in-kpi">
          <div className="in-kpi-label">Overall pass rate</div>
          <div className="in-kpi-val ok">{kpiPassRate}%</div>
          <div className="in-kpi-meta">
            Across {completedRows.length} completed
          </div>
        </div>
        <div className="in-kpi">
          <div className="in-kpi-label">Punch items generated</div>
          <div className="in-kpi-val er">{kpiPunchTotal}</div>
          <div className="in-kpi-meta">Auto from fail / conditional</div>
        </div>
      </div>

      {/* Trade strip */}
      {trades.length > 0 && (
        <div className="in-trade-strip">
          <div className="in-trade-strip-hdr">
            <h4>By trade category</h4>
            <button
              className={`in-btn xs${tradeFilter === "all" ? " primary" : " ghost"}`}
              type="button"
              onClick={() => setTradeFilter("all")}
            >
              {tradeFilter === "all" ? "All trades" : "Clear filter"}
            </button>
          </div>
          <div className="in-trade-grid">
            {trades.map((t) => (
              <div
                key={t.trade}
                className={`in-trade-card${tradeFilter === t.trade ? " active" : ""}`}
                onClick={() =>
                  setTradeFilter(tradeFilter === t.trade ? "all" : t.trade)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTradeFilter(
                      tradeFilter === t.trade ? "all" : t.trade,
                    );
                  }
                }}
              >
                <div className="in-trade-card-top">
                  <TradeBadge trade={t.trade} />
                  <PassRatePill rate={t.passRate} size="sm" />
                </div>
                <div className="in-trade-card-nums">
                  <span style={{ color: "var(--text-tertiary)" }}>
                    S {t.scheduled}
                  </span>
                  <span style={{ color: "var(--warning)" }}>
                    P {t.inProgress}
                  </span>
                  <span style={{ color: "var(--success)" }}>
                    C {t.completed}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="in-workspace">
        <div>
          <div className="in-filter-row">
            <div className="in-search">
              {Icon.search}
              <input
                placeholder="Search by number, template, zone, sub…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="in-tabs">
              {(
                [
                  ["all", rows.length, "All"],
                  ["scheduled", kpiScheduled, "Scheduled"],
                  ["in_progress", kpiInProgress, "In progress"],
                  ["completed", completedRows.length, "Completed"],
                ] as Array<[StatusFilter, number, string]>
              ).map(([key, count, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`in-tab${statusFilter === key ? " active" : ""}`}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                  <span className="in-tab-count">{count}</span>
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="in-btn sm ghost"
              disabled
              title="More filters coming soon"
            >
              {Icon.filter} More filters
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="in-empty">
              <h3>No inspections scheduled yet</h3>
              <p>
                Create the first inspection from a template. Pass-rate and
                auto-punch metrics will fill in as subs complete the checklist.
              </p>
            </div>
          ) : (
            <div className="in-list">
              <div className="in-list-hdr">
                <div>Number</div>
                <div>Inspection</div>
                <div>Trade</div>
                <div>Assignee</div>
                <div>Scheduled</div>
                <div>Status</div>
                <div>Punch</div>
              </div>
              {visibleRows.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 13,
                  }}
                >
                  No inspections match the current filter.
                </div>
              ) : (
                visibleRows.map((r) => (
                  <Link
                    key={r.id}
                    href={`${portalBase}/inspections/${r.id}`}
                    className="in-row"
                  >
                    <div className="in-row-num">{r.numberLabel}</div>
                    <div className="in-row-title">
                      <div className="in-row-title-top">
                        <span className="in-row-title-name">
                          {r.templateName}
                        </span>
                      </div>
                      <span className="in-row-title-zone">{r.zone}</span>
                    </div>
                    <div>
                      <TradeBadge trade={r.templateTradeCategory} />
                    </div>
                    <div className="in-row-assignee">
                      <span className="in-row-assignee-org">
                        {r.assignedOrgName ?? "—"}
                      </span>
                      <span className="in-row-assignee-user">
                        {r.assignedUserName ?? ""}
                      </span>
                    </div>
                    <div className="in-row-date">
                      {formatDateShort(r.scheduledDate)}
                    </div>
                    <div>
                      <StatusPill
                        status={r.status}
                        passRate={r.passRate}
                        progressCount={r.recordedCount}
                        itemCount={r.itemCount}
                      />
                    </div>
                    <div>
                      <span
                        className={`in-row-punch${r.punchCount === 0 ? " zero" : ""}`}
                      >
                        {r.punchCount > 0 ? (
                          <>
                            {Icon.link}
                            {r.punchCount}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <aside className="in-rail">
          <div className="in-rail-card">
            <div className="in-rail-hdr">
              <h4>{Icon.clock} Summary</h4>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {rows.length === 0 ? (
                <>No inspections yet — use <strong>New inspection</strong> to create one from the template library.</>
              ) : (
                <>
                  <strong style={{ color: "var(--text-primary)" }}>
                    {completedRows.length}
                  </strong>{" "}
                  completed, <strong style={{ color: "var(--text-primary)" }}>{kpiInProgress}</strong> in progress, <strong style={{ color: "var(--text-primary)" }}>{kpiScheduled}</strong> scheduled.{" "}
                  {kpiPunchTotal > 0 ? (
                    <>
                      Auto-generated{" "}
                      <strong style={{ color: "var(--danger)" }}>
                        {kpiPunchTotal} punch item{kpiPunchTotal === 1 ? "" : "s"}
                      </strong>{" "}
                      from fail / conditional outcomes.
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
          {trades.length > 0 && (
            <div className="in-rail-card">
              <div className="in-rail-hdr">
                <h4>Recent pass rates</h4>
              </div>
              {trades
                .filter((t) => t.passRate != null)
                .sort((a, b) => (b.passRate ?? 0) - (a.passRate ?? 0))
                .map((t) => (
                  <div
                    key={t.trade}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderTop: "1px solid var(--border)",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: tradeAppearance(t.trade).solid,
                        }}
                      />
                      {tradeAppearance(t.trade).label}
                    </span>
                    <PassRatePill rate={t.passRate} size="sm" />
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>

      {showCreate && (
        <CreateInspectionModal
          projectId={projectId}
          templates={templates}
          subOrgs={subOrgs}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function CreateInspectionModal({
  projectId,
  templates,
  subOrgs,
  onClose,
}: {
  projectId: string;
  templates: InspectionTemplateRow[];
  subOrgs: Array<{ id: string; name: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(
    templates[0]?.id ?? "",
  );
  const [zone, setZone] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [assignedOrgId, setAssignedOrgId] = useState(
    subOrgs[0]?.id ?? "",
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!templateId || !zone.trim() || !assignedOrgId) {
      setError("Template, zone, and assignee are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          templateId,
          zone: zone.trim(),
          assignedOrgId,
          scheduledDate: scheduledDate || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "Failed to create inspection");
        setSaving(false);
        return;
      }
      const body = (await res.json()) as { id: string };
      onClose();
      router.refresh();
      router.push(
        `/contractor/project/${projectId}/inspections/${body.id}`,
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div
      className="in-modal-veil"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="in-modal" onClick={(e) => e.stopPropagation()}>
        <div className="in-modal-hdr">
          <h3>New inspection</h3>
          <button
            type="button"
            className="in-btn xs ghost icon"
            onClick={onClose}
            aria-label="Close"
          >
            {Icon.x}
          </button>
        </div>
        <div className="in-modal-body">
          <div className="in-modal-field">
            <label>Template</label>
            <div className="in-modal-tpl-pick">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`in-modal-tpl-opt${templateId === t.id ? " active" : ""}`}
                  onClick={() => setTemplateId(t.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTemplateId(t.id);
                    }
                  }}
                >
                  <div className="in-modal-tpl-opt-name">{t.name}</div>
                  <div className="in-modal-tpl-opt-meta">
                    {t.itemCount} items ·{" "}
                    {tradeAppearance(t.tradeCategory).label} · {t.phase}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="in-modal-field">
            <label>Zone / location</label>
            <input
              placeholder="e.g. Floor 2 West"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              maxLength={80}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div className="in-modal-field">
              <label>Scheduled date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="in-modal-field">
              <label>Assign to sub</label>
              <select
                value={assignedOrgId}
                onChange={(e) => setAssignedOrgId(e.target.value)}
              >
                {subOrgs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="in-modal-field">
            <label>Notes for sub (optional)</label>
            <textarea
              placeholder="Access info, specific concerns, prerequisites…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={4000}
            />
          </div>

          {error && (
            <div className="in-err" style={{ padding: 10, fontSize: 12.5 }}>
              {error}
            </div>
          )}
        </div>
        <div className="in-modal-ftr">
          <button
            type="button"
            className="in-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="in-btn primary"
            onClick={submit}
            disabled={saving || !templateId || !zone.trim() || !assignedOrgId}
          >
            {saving ? "Creating…" : "Create & assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
