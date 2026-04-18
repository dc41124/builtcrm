"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import type { PortalType } from "@/lib/portal-colors";

// Global command palette. Listens for ⌘K / Ctrl+K everywhere (and `/`
// when no editable element is focused). Debounced fetches against
// /api/search with AbortController race safety.
//
// Group ordering convention: Projects → RFIs → Change Orders →
// Documents → Messages → People. Projects first because "take me to
// X" is the dominant cmd+K usage pattern. Residential substitutes
// "Scope Changes" for the CO group header and link.
//
// Keyboard: ArrowDown/ArrowUp navigate the flat result list (skipping
// group headers), Home/End jump to first/last, Enter navigates, Esc
// closes. PageUp/PageDown are intentionally NOT captured — the browser
// scrolls the panel.

type SearchPortal = "contractor" | "subcontractor" | "commercial" | "residential";

type ApiResponse = {
  q: string;
  results: {
    projects: Array<{
      id: string;
      name: string;
      phase: string | null;
      href: string;
    }>;
    rfis: Array<{
      id: string;
      number: number;
      subject: string;
      projectName: string;
      projectId: string;
      href: string;
    }>;
    changeOrders: Array<{
      id: string;
      number: number;
      title: string;
      projectName: string;
      projectId: string;
      href: string;
    }>;
    documents: Array<{
      id: string;
      title: string;
      documentType: string;
      projectName: string;
      projectId: string;
      href: string;
    }>;
    messages: Array<{
      id: string;
      title: string;
      preview: string | null;
      projectName: string;
      projectId: string;
      href: string;
    }>;
    people: Array<{
      id: string;
      name: string;
      email: string;
      title: string | null;
      orgName: string | null;
    }>;
  };
};

type FlatRow = {
  key: string;
  groupId: string;
  href: string | null;
  icon: ReactNode;
  title: string;
  subtitle: string | null;
};

export type CommandPaletteHandle = {
  open: () => void;
};

const DEBOUNCE_MS = 140;
const MIN_LENGTH = 2;

// Inline SVGs match the existing AppShell style (CLAUDE.md "no emojis").
const Icons = {
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  ),
  rfi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  co: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  person: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
};

function groupLabelFor(groupId: string, portalType: SearchPortal): string {
  if (groupId === "changeOrders") {
    return portalType === "residential" ? "Scope Changes" : "Change Orders";
  }
  const map: Record<string, string> = {
    projects: "Projects",
    rfis: "RFIs",
    documents: "Documents",
    messages: "Messages",
    people: "People",
  };
  return map[groupId] ?? groupId;
}

function flatten(
  res: ApiResponse["results"],
  portalType: SearchPortal,
): { flat: FlatRow[]; groupsWithCounts: Array<{ id: string; count: number }> } {
  const flat: FlatRow[] = [];
  const counts: Array<{ id: string; count: number }> = [];

  // Fixed group order per the spec: Projects → RFIs → COs →
  // Documents → Messages → People. Unrolled rather than looping
  // over keyof-union because each group's row shape is distinct and
  // TS can't narrow inside a `for` over a heterogeneous union.
  if (res.projects.length > 0) {
    counts.push({ id: "projects", count: res.projects.length });
    for (const r of res.projects) {
      flat.push({
        key: `projects:${r.id}`,
        groupId: "projects",
        href: r.href,
        icon: Icons.folder,
        title: r.name,
        subtitle: r.phase,
      });
    }
  }
  if (res.rfis.length > 0) {
    counts.push({ id: "rfis", count: res.rfis.length });
    for (const r of res.rfis) {
      flat.push({
        key: `rfis:${r.id}`,
        groupId: "rfis",
        href: r.href,
        icon: Icons.rfi,
        title: `RFI-${String(r.number).padStart(3, "0")} · ${r.subject}`,
        subtitle: r.projectName,
      });
    }
  }
  if (res.changeOrders.length > 0) {
    counts.push({ id: "changeOrders", count: res.changeOrders.length });
    for (const r of res.changeOrders) {
      flat.push({
        key: `co:${r.id}`,
        groupId: "changeOrders",
        href: r.href,
        icon: Icons.co,
        title: `${portalType === "residential" ? "Scope Change" : "Change Order"} #${r.number} · ${r.title}`,
        subtitle: r.projectName,
      });
    }
  }
  if (res.documents.length > 0) {
    counts.push({ id: "documents", count: res.documents.length });
    for (const r of res.documents) {
      flat.push({
        key: `doc:${r.id}`,
        groupId: "documents",
        href: r.href,
        icon: Icons.doc,
        title: r.title,
        subtitle: `${r.projectName} · ${r.documentType.replace(/_/g, " ")}`,
      });
    }
  }
  if (res.messages.length > 0) {
    counts.push({ id: "messages", count: res.messages.length });
    for (const r of res.messages) {
      flat.push({
        key: `msg:${r.id}`,
        groupId: "messages",
        href: r.href,
        icon: Icons.message,
        title: r.title,
        subtitle: r.preview
          ? `${r.projectName} · ${r.preview.slice(0, 90)}`
          : r.projectName,
      });
    }
  }
  if (res.people.length > 0) {
    counts.push({ id: "people", count: res.people.length });
    for (const r of res.people) {
      flat.push({
        key: `p:${r.id}`,
        groupId: "people",
        href: null, // People rows are informational for V1 (no profile page yet).
        icon: Icons.person,
        title: r.name,
        subtitle:
          [r.title, r.orgName].filter(Boolean).join(" · ") || r.email,
      });
    }
  }
  return { flat, groupsWithCounts: counts };
}

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const ce = (el as HTMLElement).isContentEditable;
  return Boolean(ce);
}

export const CommandPalette = forwardRef<
  CommandPaletteHandle,
  { portalType: PortalType }
>(function CommandPalette({ portalType }, ref) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiResponse["results"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

  // Global keybinds. Mount once, active regardless of palette state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const metaK =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (metaK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      // `/` opens only when no editable element is focused — keeps
      // it out of the way in message composers and other inputs.
      if (e.key === "/" && !open && !isEditableTarget(document.activeElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On open: focus input, reset state.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setFocusedIdx(0);
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  // Debounced fetch with AbortController race safety — if the user
  // types faster than the network responds, only the latest in-flight
  // request wins.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
    }
    if (query.trim().length < MIN_LENGTH) {
      setResults(null);
      setLoading(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      const url = `/api/search?q=${encodeURIComponent(query)}&portalType=${portalType}`;
      fetch(url, { signal: ac.signal, cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as ApiResponse;
          if (data.q !== query) return; // echo guard vs. late stragglers
          setResults(data.results);
          setFocusedIdx(0);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          // Silent — palette stays in last-known state.
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS) as unknown as number;
    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [open, query, portalType]);

  const { flat, groupsWithCounts } = useMemo(
    () => (results ? flatten(results, portalType as SearchPortal) : { flat: [], groupsWithCounts: [] }),
    [results, portalType],
  );

  // Keep focused row visible when arrow-navigating long lists.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${focusedIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, focusedIdx]);

  const navigateTo = useCallback(
    (idx: number) => {
      const row = flat[idx];
      if (!row || !row.href) return;
      setOpen(false);
      router.push(row.href);
    },
    [flat, router],
  );

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIdx(flat.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigateTo(focusedIdx);
    }
  }

  // Overlay click → close (clicks inside the panel bubble up from
  // nested handlers and don't reach here).
  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) setOpen(false);
  }

  if (!open) return null;

  const showEmpty = query.trim().length >= MIN_LENGTH && !loading && flat.length === 0;
  const showHint = query.trim().length < MIN_LENGTH;

  return (
    <div
      className="b-cmd-overlay"
      onMouseDown={onOverlayClick}
      role="presentation"
    >
      <div
        className="b-cmd-panel"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
      >
        <div className="b-cmd-input-wrap">
          <span className="b-cmd-input-ico" aria-hidden>
            {Icons.search}
          </span>
          <input
            ref={inputRef}
            className="b-cmd-input"
            role="combobox"
            aria-expanded
            aria-controls="b-cmd-listbox"
            aria-activedescendant={
              flat[focusedIdx] ? `b-cmd-row-${focusedIdx}` : undefined
            }
            placeholder="Search projects, RFIs, people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <kbd className="b-cmd-kbd">Esc</kbd>
        </div>

        <div
          className="b-cmd-list"
          ref={listRef}
          id="b-cmd-listbox"
          role="listbox"
        >
          {showHint && (
            <div className="b-cmd-hint">
              Type at least {MIN_LENGTH} characters to search — projects, RFIs,
              change orders, documents, messages, and people.
            </div>
          )}
          {showEmpty && (
            <div className="b-cmd-hint">
              No matches for &ldquo;{query}&rdquo;.
            </div>
          )}
          {loading && flat.length === 0 && (
            <div className="b-cmd-hint">Searching…</div>
          )}
          {flat.length > 0 && (
            <GroupedList
              flat={flat}
              groups={groupsWithCounts}
              portalType={portalType as SearchPortal}
              focusedIdx={focusedIdx}
              onHover={setFocusedIdx}
              onSelect={navigateTo}
            />
          )}
        </div>

        <div className="b-cmd-foot">
          <span>
            <kbd className="b-cmd-kbd sm">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="b-cmd-kbd sm">↵</kbd> open
          </span>
          <span>
            <kbd className="b-cmd-kbd sm">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
});

function GroupedList({
  flat,
  groups,
  portalType,
  focusedIdx,
  onHover,
  onSelect,
}: {
  flat: FlatRow[];
  groups: Array<{ id: string; count: number }>;
  portalType: SearchPortal;
  focusedIdx: number;
  onHover: (i: number) => void;
  onSelect: (i: number) => void;
}) {
  // Walk groups in the same order and pull rows from flat by index.
  let cursor = 0;
  return (
    <>
      {groups.map((g) => {
        const rows = flat.slice(cursor, cursor + g.count);
        const startIdx = cursor;
        cursor += g.count;
        return (
          <div key={g.id}>
            <div className="b-cmd-group">{groupLabelFor(g.id, portalType)}</div>
            {rows.map((r, localIdx) => {
              const idx = startIdx + localIdx;
              const isFocused = idx === focusedIdx;
              const disabled = !r.href;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="option"
                  id={`b-cmd-row-${idx}`}
                  data-idx={idx}
                  aria-selected={isFocused}
                  className={`b-cmd-row${isFocused ? " kbd" : ""}${disabled ? " disabled" : ""}`}
                  onMouseEnter={() => onHover(idx)}
                  onClick={() => !disabled && onSelect(idx)}
                  tabIndex={-1}
                >
                  <span className="b-cmd-ic">{r.icon}</span>
                  <span className="b-cmd-body">
                    <span className="b-cmd-title">{r.title}</span>
                    {r.subtitle && (
                      <span className="b-cmd-sub">{r.subtitle}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
