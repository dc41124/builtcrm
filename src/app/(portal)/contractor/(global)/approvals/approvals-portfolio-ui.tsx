"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type {
  ContractorCrossProjectApprovalsView,
  CrossProjectApprovalRow,
  DerivedPriority,
} from "@/domain/loaders/cross-project";

// Portfolio-wide pending approvals (Step 37 / 4D #37). Complements the
// per-project approvals workspace — same data shape, same pills, wider
// lens. Row click deep-links into the project's approvals page with
// ?open=<approvalId> so the per-project workspace auto-selects.

// --------------------------------------------------------------------------
// Reusable tokens + formatting
// --------------------------------------------------------------------------

const CATEGORY_LABEL: Record<string, string> = {
  change_order: "Change Order",
  procurement: "Procurement",
  design: "Design",
  general: "General",
  other: "Other",
};

const CATEGORY_CLASS: Record<string, string> = {
  change_order: "co",
  procurement: "procurement",
  design: "design",
  general: "general",
  other: "general",
};

const CATEGORY_FILTER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "change_order", label: "Change Order" },
  { id: "procurement", label: "Procurement" },
  { id: "design", label: "Design" },
  { id: "general", label: "General" },
  { id: "other", label: "Other" },
];

type AgeFilter = "all" | "fresh" | "due_soon" | "overdue";
type PriorityFilter = "all" | DerivedPriority;

const AGE_OPTIONS: Array<{ id: AgeFilter; label: string }> = [
  { id: "all", label: "Any age" },
  { id: "fresh", label: "Fresh (< 2d)" },
  { id: "due_soon", label: "Due soon (2–3d)" },
  { id: "overdue", label: "Overdue (> 3d)" },
];

const PRIORITY_OPTIONS: Array<{ id: PriorityFilter; label: string }> = [
  { id: "all", label: "Any priority" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const PRIORITY_PILL: Record<DerivedPriority, PillColor> = {
  high: "red",
  medium: "amber",
  low: "gray",
};

function formatCents(cents: number): string {
  if (cents === 0) return "—";
  const sign = cents < 0 ? "-" : "+";
  const abs = Math.abs(cents);
  return `${sign}${(abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })}`;
}

function ageLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "Today";
  return `${days}d`;
}

function ageBucket(days: number | null): AgeFilter {
  if (days == null) return "fresh";
  if (days > 3) return "overdue";
  if (days > 1) return "due_soon";
  return "fresh";
}

// --------------------------------------------------------------------------
// Root workspace
// --------------------------------------------------------------------------

export function CrossProjectApprovalsWorkspace({
  view,
}: {
  view: ContractorCrossProjectApprovalsView;
}) {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    return view.rows.filter((r) => {
      if (selectedProjects.size > 0 && !selectedProjects.has(r.projectId))
        return false;
      if (selectedCategories.size > 0 && !selectedCategories.has(r.category))
        return false;
      if (ageFilter !== "all" && ageBucket(r.ageDays) !== ageFilter)
        return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter)
        return false;
      return true;
    });
  }, [
    view.rows,
    selectedProjects,
    selectedCategories,
    ageFilter,
    priorityFilter,
  ]);

  const activeFilterCount =
    selectedProjects.size +
    selectedCategories.size +
    (ageFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0);

  const toggleProject = (id: string) => {
    const next = new Set(selectedProjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProjects(next);
  };
  const toggleCategory = (id: string) => {
    const next = new Set(selectedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCategories(next);
  };
  const clearFilters = () => {
    setSelectedProjects(new Set());
    setSelectedCategories(new Set());
    setAgeFilter("all");
    setPriorityFilter("all");
  };

  const { totals, projectOptions } = view;

  return (
    <div className="apw">
      <header className="apw-head">
        <div className="apw-head-main">
          <h1 className="apw-title">Approvals</h1>
          <p className="apw-desc">
            Every pending approval across every project your team runs.
            Filter by project, type, age, or priority — click a row to jump
            into the project&rsquo;s full approval workspace.
          </p>
        </div>
      </header>

      <div className="apw-kpis">
        <KpiCard
          label="Pending"
          value={totals.totalPending.toString()}
          meta={
            totals.totalPending === 0
              ? "Queue clear"
              : totals.totalPending === 1
                ? "1 item awaiting decision"
                : `${totals.totalPending} items awaiting decisions`
          }
          iconColor="purple"
          alert={totals.totalPending > 0}
        />
        <KpiCard
          label="Overdue"
          value={totals.overdue.toString()}
          meta={
            totals.overdue === 0 ? "None past deadline" : "Past review deadline"
          }
          iconColor="red"
          alert={totals.overdue > 0}
        />
        <KpiCard
          label="Oldest pending"
          value={
            totals.oldestAgeDays == null
              ? "—"
              : `${totals.oldestAgeDays}d`
          }
          meta={
            totals.oldestAgeDays == null
              ? "Nothing waiting"
              : "Since submission"
          }
          iconColor="amber"
        />
        <KpiCard
          label="High priority"
          value={totals.byPriority.high.toString()}
          meta={
            totals.byPriority.high === 0
              ? "None flagged"
              : "Overdue or high-impact"
          }
          iconColor="red"
          alert={totals.byPriority.high > 0}
        />
      </div>

      {totals.totalPending > 0 && (
        <ByTypeStrip byCategory={totals.byCategory} />
      )}

      <section style={workspaceCardStyle}>
        <div style={filterBarStyle}>
          <ProjectMultiSelect
            options={projectOptions}
            selected={selectedProjects}
            onToggle={toggleProject}
            isOpen={projectPanelOpen}
            setOpen={setProjectPanelOpen}
            onClearAll={() => setSelectedProjects(new Set())}
          />
          <ChipGroup
            label="Type"
            options={CATEGORY_FILTER_OPTIONS}
            isActive={(id) => selectedCategories.has(id)}
            onToggle={toggleCategory}
            multi
          />
          <SingleChipGroup
            label="Age"
            options={AGE_OPTIONS}
            activeId={ageFilter}
            onSelect={setAgeFilter}
          />
          <SingleChipGroup
            label="Priority"
            options={PRIORITY_OPTIONS}
            activeId={priorityFilter}
            onSelect={setPriorityFilter}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              style={clearLinkStyle}
            >
              Clear {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filter" : "filters"}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState
              title={
                view.rows.length === 0
                  ? "No pending approvals"
                  : "No approvals match the current filters"
              }
              description={
                view.rows.length === 0
                  ? "Every approval in your portfolio has a decision. Great cadence."
                  : "Clear a filter or broaden the age range to see more."
              }
            />
          </div>
        ) : (
          <ApprovalsTable rows={filtered} />
        )}
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function ByTypeStrip({
  byCategory,
}: {
  byCategory: Record<string, number>;
}) {
  const entries = CATEGORY_FILTER_OPTIONS.filter(
    (c) => (byCategory[c.id] ?? 0) > 0,
  );
  if (entries.length === 0) return null;
  return (
    <div style={byTypeStripStyle}>
      <span style={byTypeLabelStyle}>By type</span>
      {entries.map((c) => (
        <span
          key={c.id}
          className={`apw-type apw-type-${CATEGORY_CLASS[c.id] ?? "general"}`}
        >
          {c.label} · {byCategory[c.id]}
        </span>
      ))}
    </div>
  );
}

function ProjectMultiSelect({
  options,
  selected,
  onToggle,
  isOpen,
  setOpen,
  onClearAll,
}: {
  options: Array<{ id: string; name: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onClearAll: () => void;
}) {
  const buttonLabel =
    selected.size === 0
      ? "All projects"
      : selected.size === 1
        ? `1 project`
        : `${selected.size} projects`;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        style={chipButtonStyle(selected.size > 0)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        Project: {buttonLabel}
        <span style={{ marginLeft: 6, opacity: 0.7 }}>{isOpen ? "▴" : "▾"}</span>
      </button>
      {isOpen && (
        <div style={projectPanelStyle} role="listbox">
          {options.length === 0 ? (
            <div
              style={{
                padding: 12,
                fontSize: 12,
                color: "var(--t3)",
                fontFamily: "var(--fb)",
              }}
            >
              No projects have pending approvals.
            </div>
          ) : (
            <>
              {options.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <label
                    key={p.id}
                    style={projectPanelRowStyle(isSelected)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(p.id)}
                      style={visuallyHiddenCheckboxStyle}
                    />
                    <CustomCheckbox checked={isSelected} />
                    <span style={{ flex: 1, minWidth: 0 }}>{p.name}</span>
                  </label>
                );
              })}
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  style={{
                    ...clearLinkStyle,
                    width: "100%",
                    padding: "8px 12px",
                    borderTop: "1px solid var(--s3)",
                    textAlign: "left",
                  }}
                >
                  Clear project filter
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// White box always; accent-colored check appears when selected. Ensures the
// box is visible on the dark dropdown panel even when nothing is picked.
function CustomCheckbox({ checked }: { checked: boolean }) {
  return (
    <span style={customCheckboxStyle} aria-hidden>
      {checked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="var(--ac)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 5.2L4.2 7.4 8.2 2.8" />
        </svg>
      )}
    </span>
  );
}

function ChipGroup({
  label,
  options,
  isActive,
  onToggle,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  isActive: (id: string) => boolean;
  onToggle: (id: string) => void;
  multi?: boolean;
}) {
  return (
    <div style={chipGroupStyle}>
      <span style={chipGroupLabelStyle}>{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onToggle(o.id)}
          style={chipButtonStyle(isActive(o.id))}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SingleChipGroup<T extends string>({
  label,
  options,
  activeId,
  onSelect,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  activeId: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div style={chipGroupStyle}>
      <span style={chipGroupLabelStyle}>{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          style={chipButtonStyle(o.id === activeId)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ApprovalsTable({ rows }: { rows: CrossProjectApprovalRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Project</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Title</th>
            <th style={thStyle}>Submitted by</th>
            <th style={thStyle}>Age</th>
            <th style={thStyle}>Impact</th>
            <th style={thStyle}>Priority</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = `/contractor/project/${r.projectId}/approvals?open=${r.id}`;
            return (
              <tr key={r.id} style={rowStyle}>
                <td style={tdStyle}>
                  <span style={projectCellStyle}>{r.projectName}</span>
                </td>
                <td style={tdStyle}>
                  <span
                    className={`apw-type apw-type-${CATEGORY_CLASS[r.category] ?? "general"}`}
                  >
                    {CATEGORY_LABEL[r.category] ?? "Other"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontFamily: "var(--fm)" }}>
                  #{r.approvalNumber.toString().padStart(3, "0")}
                </td>
                <td style={tdStyle}>
                  <Link href={href} style={titleLinkStyle}>
                    {r.title}
                  </Link>
                  {r.description && (
                    <div style={descStyle}>{r.description}</div>
                  )}
                </td>
                <td style={tdStyle}>{r.requestedByName ?? "—"}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {ageLabel(r.ageDays)}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    whiteSpace: "nowrap",
                    fontFamily: "var(--fm)",
                  }}
                >
                  {formatCents(r.impactCostCents)}
                  {r.impactScheduleDays > 0 && (
                    <div style={descStyle}>+{r.impactScheduleDays}d</div>
                  )}
                </td>
                <td style={tdStyle}>
                  <Pill color={PRIORITY_PILL[r.priority]}>
                    {r.priority[0].toUpperCase() + r.priority.slice(1)}
                  </Pill>
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <Link href={href} style={{ textDecoration: "none" }}>
                    <Button variant="secondary">View</Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------
// Inline styles — portfolio-specific layout. Shared visual language comes
// from the workspaces.css apw-* classes and the shared components.
// --------------------------------------------------------------------------

const workspaceCardStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-xl)",
  boxShadow: "var(--shsm)",
  overflow: "hidden",
};

const filterBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 16,
  padding: "14px 20px",
  borderBottom: "1px solid var(--s3)",
  fontFamily: "var(--fb)",
};

const chipGroupStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const chipGroupLabelStyle: CSSProperties = {
  fontFamily: "var(--fb)",
  fontSize: 11,
  fontWeight: 620,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginRight: 2,
};

function chipButtonStyle(active: boolean): CSSProperties {
  return {
    height: 28,
    padding: "0 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "color-mix(in srgb,var(--ac) 35%,var(--s3))" : "var(--s3)"}`,
    background: active ? "var(--ac-s)" : "var(--s1)",
    color: active ? "var(--ac-t)" : "var(--t2)",
    fontFamily: "var(--fb)",
    fontSize: 12,
    fontWeight: 620,
    cursor: "pointer",
    transition: "all var(--df) var(--e)",
    display: "inline-flex",
    alignItems: "center",
  };
}

const clearLinkStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--ac-t)",
  fontFamily: "var(--fb)",
  fontSize: 12,
  fontWeight: 620,
  cursor: "pointer",
  padding: "4px 8px",
};

const visuallyHiddenCheckboxStyle: CSSProperties = {
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
  width: 0,
  height: 0,
};

const customCheckboxStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 14,
  height: 14,
  borderRadius: 3,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  marginRight: 8,
  flexShrink: 0,
};

const projectPanelStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  minWidth: 240,
  maxHeight: 320,
  overflowY: "auto",
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-md)",
  boxShadow: "var(--shmd)",
  zIndex: 10,
};

function projectPanelRowStyle(selected: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    fontFamily: "var(--fb)",
    fontSize: 12.5,
    fontWeight: 540,
    color: "var(--t1)",
    cursor: "pointer",
    background: selected ? "var(--ac-s)" : "transparent",
  };
}

const byTypeStripStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  padding: "10px 4px 0",
};

const byTypeLabelStyle: CSSProperties = {
  fontFamily: "var(--fb)",
  fontSize: 11,
  fontWeight: 620,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginRight: 4,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: "var(--fb)",
  fontSize: 13,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontFamily: "var(--fb)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--s3)",
  background: "var(--s0)",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--s2)",
  color: "var(--t1)",
  fontWeight: 540,
  verticalAlign: "top",
};

const rowStyle: CSSProperties = {
  transition: "background var(--df) var(--e)",
};

const projectCellStyle: CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 12,
  fontWeight: 620,
  color: "var(--t2)",
  display: "block",
};

const titleLinkStyle: CSSProperties = {
  color: "var(--t1)",
  textDecoration: "none",
  fontWeight: 620,
};

const descStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 520,
  color: "var(--t3)",
  marginTop: 2,
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};
