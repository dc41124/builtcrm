"use client";

import type { CSSProperties } from "react";

// Filter-bar primitives shared across the contractor portfolio surfaces
// (approvals, payment tracking, etc.). Extracted from Step 37's
// approvals-portfolio-ui.tsx so Step 38+ pages can reuse without
// duplication.

// --------------------------------------------------------------------------
// CustomCheckbox — white-box default; accent check when selected
// --------------------------------------------------------------------------

export function CustomCheckbox({ checked }: { checked: boolean }) {
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

export const visuallyHiddenCheckboxStyle: CSSProperties = {
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

// --------------------------------------------------------------------------
// ProjectMultiSelect — dropdown panel with checkbox rows
// --------------------------------------------------------------------------

export type ProjectOption = {
  id: string;
  name: string;
};

export function ProjectMultiSelect({
  options,
  selected,
  onToggle,
  isOpen,
  setOpen,
  onClearAll,
  label = "Project",
}: {
  options: ProjectOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  onClearAll: () => void;
  label?: string;
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
        {label}: {buttonLabel}
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
              No projects match this view.
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

// --------------------------------------------------------------------------
// ChipGroup — multi-select chip filter (caller owns the Set)
// --------------------------------------------------------------------------

export function ChipGroup({
  label,
  options,
  isActive,
  onToggle,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  isActive: (id: string) => boolean;
  onToggle: (id: string) => void;
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

// --------------------------------------------------------------------------
// SingleChipGroup — single-select chip filter
// --------------------------------------------------------------------------

export function SingleChipGroup<T extends string>({
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

// --------------------------------------------------------------------------
// Layout primitives + shared styles
// --------------------------------------------------------------------------

export const workspaceCardStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-xl)",
  boxShadow: "var(--shsm)",
  overflow: "hidden",
};

export const filterBarStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 16,
  padding: "14px 20px",
  borderBottom: "1px solid var(--s3)",
  fontFamily: "var(--fb)",
};

export const clearLinkStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--ac-t)",
  fontFamily: "var(--fb)",
  fontSize: 12,
  fontWeight: 620,
  cursor: "pointer",
  padding: "4px 8px",
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

export function chipButtonStyle(active: boolean): CSSProperties {
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
