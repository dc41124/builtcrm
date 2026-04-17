"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  SelectionCategoryRow,
  SelectionItemRow,
} from "@/domain/loaders/project-home";

// ─── Types ──────────────────────────────────────────────────────

type TabId = "all" | "draft" | "published" | "decided" | "revision";

type Totals = {
  totalItems: number;
  drafts: number;
  published: number;
  decided: number;
  revisionOpen: number;
  awaitingDecision: number;
  overdue: number;
  totalAllowanceCents: number;
  confirmedUpgradeCents: number;
};

type FlatItem = SelectionItemRow & { categoryName: string; categoryId: string };

type ViewMode = "workspace" | "create";

// ─── Helpers ────────────────────────────────────────────────────

function formatCents(c: number): string {
  if (c === 0) return "$0";
  const abs = Math.abs(c);
  const s = `$${(abs / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return c < 0 ? `-${s}` : s;
}

function formatDate(d: Date | null): string {
  if (!d) return "Not set";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatShortDate(d: Date | null): string {
  if (!d) return "—";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function isOverdue(item: SelectionItemRow, now: number): boolean {
  if (!item.decisionDeadline) return false;
  if (item.selectionItemStatus === "confirmed" || item.selectionItemStatus === "locked") return false;
  return item.decisionDeadline.getTime() < now;
}

function isDecided(item: SelectionItemRow): boolean {
  return item.selectionItemStatus === "confirmed" || item.selectionItemStatus === "locked";
}

function overdueDays(item: SelectionItemRow, now: number): number {
  if (!item.decisionDeadline) return 0;
  return Math.max(0, Math.ceil((now - item.decisionDeadline.getTime()) / (24 * 60 * 60 * 1000)));
}

function statusPillInfo(item: SelectionItemRow, now: number): { label: string; cls: string } {
  if (!item.isPublished) return { label: "Draft", cls: "" };
  if (item.selectionItemStatus === "revision_open") return { label: "Revision", cls: "red" };
  if (isDecided(item)) return { label: "Confirmed", cls: "green" };
  if (isOverdue(item, now)) return { label: "Overdue", cls: "orange" };
  if (item.selectionItemStatus === "exploring") return { label: "Exploring", cls: "teal" };
  return { label: "Published", cls: "blue" };
}

function decisionProgress(item: SelectionItemRow): number {
  if (!item.isPublished) return 0;
  const d = item.currentDecision;
  if (d?.isLocked || item.selectionItemStatus === "locked") return 100;
  if (d?.isConfirmed || item.selectionItemStatus === "confirmed") return 80;
  if (d?.isProvisional || item.selectionItemStatus === "provisional") return 60;
  if (item.selectionItemStatus === "revision_open") return 50;
  if (item.selectionItemStatus === "exploring") return 40;
  return 20;
}

type TimelineStep = { label: string; desc: string; done: boolean; current: boolean };

function buildTimeline(item: SelectionItemRow): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const status = item.selectionItemStatus;
  const d = item.currentDecision;

  if (status === "revision_open") {
    steps.push({ label: "Published", desc: item.publishedAt ? `Originally ${formatShortDate(item.publishedAt)}` : "Published", done: true, current: false });
    steps.push({ label: "Client Confirmed", desc: d?.confirmedAt ? `${formatShortDate(d.confirmedAt)}` : "Previously confirmed", done: true, current: false });
    steps.push({ label: "Reopened for Revision", desc: d?.revisionNote ?? "Reopened", done: false, current: true });
    steps.push({ label: "Client Re-selects", desc: "Waiting for new choice", done: false, current: false });
    steps.push({ label: "Re-confirmed", desc: "Lock after revision", done: false, current: false });
    return steps;
  }

  // Published step
  steps.push({
    label: "Published",
    desc: item.publishedAt ? `You published \u00B7 ${formatShortDate(item.publishedAt)}` : "Not yet published",
    done: item.isPublished,
    current: item.isPublished && !d && status !== "exploring",
  });

  // Exploring
  const exploringDone = !!d || status === "provisional" || status === "confirmed" || status === "locked";
  steps.push({
    label: "Exploring Options",
    desc: exploringDone ? "Client browsed options" : status === "exploring" ? "Client is browsing" : "Waiting for client",
    done: exploringDone,
    current: status === "exploring" && !d,
  });

  // Provisional
  const provisionalDone = (d?.isConfirmed ?? false) || status === "confirmed" || status === "locked";
  steps.push({
    label: "Provisional Selection",
    desc: provisionalDone || (d?.isProvisional ?? false) ? "Choice made" : "Waiting for choice",
    done: provisionalDone,
    current: (d?.isProvisional ?? false) && !(d?.isConfirmed ?? false),
  });

  // Confirmed
  const confirmedDone = (d?.isConfirmed ?? false) || status === "confirmed" || status === "locked";
  steps.push({
    label: "Confirmed",
    desc: d?.confirmedAt ? formatShortDate(d.confirmedAt) : confirmedDone ? "Confirmed" : "Lock after revision window",
    done: confirmedDone,
    current: confirmedDone && !(d?.isLocked ?? false) && status !== "locked",
  });

  // Locked
  const lockedDone = (d?.isLocked ?? false) || status === "locked";
  steps.push({
    label: "Locked",
    desc: d?.lockedAt ? `Revision closed \u00B7 ${formatShortDate(d.lockedAt)}` : "Revision window closes",
    done: lockedDone,
    current: false,
  });

  return steps;
}

type ActivityEntry = { color: string; text: string; date: string };

function buildActivity(item: SelectionItemRow): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  const d = item.currentDecision;

  if (d?.isLocked && d.lockedAt) {
    entries.push({ color: "green", text: "System locked \u2014 revision window expired", date: formatShortDate(d.lockedAt) });
  }
  if (d?.isConfirmed && d.confirmedAt) {
    const chosenOpt = item.options.find(o => o.id === d.selectedOptionId);
    entries.push({ color: "teal", text: `Client confirmed${chosenOpt ? ` ${chosenOpt.name}` : ""}`, date: formatShortDate(d.confirmedAt) });
  }
  if (d?.isProvisional && d.createdAt) {
    entries.push({ color: "teal", text: "Client provisionally selected", date: formatShortDate(d.createdAt) });
  }
  if (item.selectionItemStatus === "revision_open" && d?.revisionNote) {
    entries.push({ color: "orange", text: `Reopened \u2014 ${d.revisionNote}`, date: formatShortDate(d.createdAt) });
  }
  if (item.isPublished && item.publishedAt) {
    entries.push({ color: "purple", text: `Published with ${item.options.length} options`, date: formatShortDate(item.publishedAt) });
  }
  entries.push({ color: "purple", text: "Item created", date: "—" });
  return entries;
}

// ─── Tab definitions ────────────────────────────────────────────

const TABS: { id: TabId; label: string; match: (i: SelectionItemRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "draft", label: "Draft", match: (i) => !i.isPublished },
  { id: "published", label: "Published", match: (i) => i.isPublished && i.selectionItemStatus !== "revision_open" && !isDecided(i) },
  { id: "decided", label: "Decided", match: (i) => isDecided(i) },
  { id: "revision", label: "Revision", match: (i) => i.selectionItemStatus === "revision_open" },
];

// ─── Inline SVG Icon Components ─────────────────────────────────

const PlusIcon = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const DupIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
);
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
);
const NudgeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17H2a3 3 0 003-3V9a7 7 0 0114 0v5a3 3 0 003 3zm-8.27 4a2 2 0 01-3.46 0" /></svg>
);
const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
);
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
);
const WarnIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

// ─── Swatch Mini Grid ───────────────────────────────────────────

function SwatchMini({ colors }: { colors: (string | null)[] }) {
  const hasAny = colors.some(c => c);
  if (!hasAny) {
    return (
      <div className="sm-q-swatch sm-q-swatch-empty">
        <PlusIcon s={14} />
      </div>
    );
  }
  return (
    <div className="sm-q-swatch">
      <div className="sm-q-swatch-grid">
        {colors.slice(0, 4).map((c, i) => (
          <span key={i} style={{ display: "block", background: c || "var(--s2)" }} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ContractorSelectionsWorkspace({
  projectId,
  projectName,
  categories,
  totals,
  nowMs: now,
}: {
  projectId: string;
  projectName: string;
  categories: SelectionCategoryRow[];
  totals: Totals;
  nowMs: number;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [view, setView] = useState<ViewMode>("workspace");

  // ── Create form state ──
  const [createCategoryId, setCreateCategoryId] = useState(categories[0]?.id ?? "");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createAllowance, setCreateAllowance] = useState("");
  const [createDeadline, setCreateDeadline] = useState("");
  const [createAffects, setCreateAffects] = useState(false);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── New category inline state ──
  const [newCatName, setNewCatName] = useState("");
  const [newCatPending, setNewCatPending] = useState(false);
  const [newCatError, setNewCatError] = useState<string | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);

  // ── Flatten items ──
  const allItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    for (const c of categories) {
      for (const i of c.items) {
        out.push({ ...i, categoryName: c.name, categoryId: c.id });
      }
    }
    return out;
  }, [categories]);

  const filtered = useMemo(() => {
    const match = TABS.find((t) => t.id === activeTab)!.match;
    return allItems.filter(match);
  }, [allItems, activeTab]);

  const [selectedId, setSelectedId] = useState<string | null>(allItems[0]?.id ?? null);

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

  const tabCounts: Record<TabId, number> = {
    all: allItems.length,
    draft: allItems.filter(TABS[1].match).length,
    published: allItems.filter(TABS[2].match).length,
    decided: allItems.filter(TABS[3].match).length,
    revision: allItems.filter(TABS[4].match).length,
  };

  const grouped = useMemo(() => {
    const out = new Map<string, FlatItem[]>();
    for (const i of filtered) {
      const arr = out.get(i.categoryName) ?? [];
      arr.push(i);
      out.set(i.categoryName, arr);
    }
    return out;
  }, [filtered]);

  function handleTab(tab: TabId) {
    setActiveTab(tab);
    setSelectedId(null);
  }

  // ── API: Create category ──
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setNewCatPending(true);
    setNewCatError(null);
    const res = await fetch("/api/selections/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name: newCatName }),
    });
    setNewCatPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setNewCatError(b.error ?? "create_failed");
      return;
    }
    setNewCatName("");
    setShowNewCat(false);
    router.refresh();
  }

  // ── API: Create item ──
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!createCategoryId || !createTitle.trim()) return;
    setCreatePending(true);
    setCreateError(null);
    const cents = createAllowance ? Math.round(Number.parseFloat(createAllowance) * 100) : 0;
    const res = await fetch("/api/selections/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        categoryId: createCategoryId,
        title: createTitle,
        description: createDescription || undefined,
        allowanceCents: cents,
        decisionDeadline: createDeadline ? new Date(createDeadline).toISOString() : undefined,
        affectsSchedule: createAffects,
      }),
    });
    setCreatePending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setCreateError(b.error ?? "create_failed");
      return;
    }
    setCreateTitle("");
    setCreateDescription("");
    setCreateAllowance("");
    setCreateDeadline("");
    setCreateAffects(false);
    setView("workspace");
    router.refresh();
  }

  // ── Checklist for create form ──
  const checklist = [
    { label: "Title and description", ok: createTitle.trim().length > 0 },
    { label: "Allowance amount set", ok: createAllowance.length > 0 && Number(createAllowance) > 0 },
    { label: "Category selected", ok: createCategoryId.length > 0 },
    { label: "Decision deadline set", ok: createDeadline.length > 0 },
  ];

  return (
    <div className="sw">
      

      {view === "create" ? (
        /* ════ CREATE VIEW ════ */
        <div className="sw-create">
          <div className="sw-cr-back">
            <button className="sw-btn ghost" onClick={() => setView("workspace")} type="button">
              <BackIcon /> Back
            </button>
            <h2 className="sw-cr-title">New Selection Item</h2>
          </div>
          <form onSubmit={handleCreateItem}>
            <div className="sw-d2">
              <div className="sw-dm">
                {/* Item Details Card */}
                <div className="sw-card sw-cr-card">
                  <h4>Item Details</h4>
                  <div className="sw-cr-row">
                    <div className="sw-cr-field">
                      <label className="sw-cr-label">Category</label>
                      <select
                        className="sw-cr-input"
                        value={createCategoryId}
                        onChange={(e) => setCreateCategoryId(e.target.value)}
                        required
                      >
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sw-cr-field">
                      <label className="sw-cr-label">Item Title</label>
                      <input
                        className="sw-cr-input"
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        placeholder="e.g., Backsplash Tile"
                        required
                      />
                    </div>
                  </div>
                  <div className="sw-cr-field">
                    <label className="sw-cr-label">Description</label>
                    <textarea
                      className="sw-cr-ta"
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Explain what this selection is for..."
                    />
                    <span className="sw-cr-hint">Shown to the homeowner for context.</span>
                  </div>
                  <label className="sw-cr-check" style={{ marginTop: 12 }}>
                    <input
                      type="checkbox"
                      checked={createAffects}
                      onChange={(e) => setCreateAffects(e.target.checked)}
                    />
                    <span>Affects project schedule</span>
                  </label>
                </div>
                {/* Budget & Timing Card */}
                <div className="sw-card sw-cr-card">
                  <h4>Budget & Timing</h4>
                  <div className="sw-cr-row">
                    <div className="sw-cr-field">
                      <label className="sw-cr-label">Allowance ($)</label>
                      <input
                        className="sw-cr-input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={createAllowance}
                        onChange={(e) => setCreateAllowance(e.target.value)}
                        placeholder="0.00"
                      />
                      <span className="sw-cr-hint">At or below = &quot;Included&quot; for client.</span>
                    </div>
                    <div className="sw-cr-field">
                      <label className="sw-cr-label">Decision Deadline</label>
                      <input
                        className="sw-cr-input"
                        type="date"
                        value={createDeadline}
                        onChange={(e) => setCreateDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="sw-dr">
                {/* Publish Settings */}
                <div className="sw-card sw-cr-card">
                  <h4>Publish Settings</h4>
                  <p style={{ fontFamily: "var(--fb)", fontSize: 12, color: "var(--t2)", marginBottom: 14, fontWeight: 520 }}>
                    Items stay draft until published. Homeowner cannot see drafts.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button className="sw-btn lg primary" type="submit" disabled={createPending || categories.length === 0} style={{ width: "100%" }}>
                      <SendIcon /> {createPending ? "Saving..." : "Save as Draft"}
                    </button>
                  </div>
                  {createError && <p className="sw-cr-err">Error: {createError}</p>}
                </div>
                {/* Publish Checklist */}
                <div className="sw-card sw-cr-card">
                  <h4>Publish Checklist</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {checklist.map((c, i) => (
                      <div key={i} className="sw-chk-item">
                        <div className={`sw-chk-box${c.ok ? " done" : ""}`}>
                          {c.ok && <CheckIcon />}
                        </div>
                        <span>{c.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* New Category */}
                {showNewCat ? (
                  <div className="sw-card sw-cr-card">
                    <h4>New Category</h4>
                    <form onSubmit={handleCreateCategory} className="sw-nc-form">
                      <input
                        className="sw-nc-inp"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="e.g., Kitchen"
                        required
                      />
                      <button className="sw-btn primary" type="submit" disabled={newCatPending}>
                        {newCatPending ? "..." : "Create"}
                      </button>
                      <button className="sw-btn ghost" type="button" onClick={() => setShowNewCat(false)}>
                        Cancel
                      </button>
                    </form>
                    {newCatError && <p className="sw-cr-err">Error: {newCatError}</p>}
                  </div>
                ) : (
                  <button className="sw-btn ghost" type="button" onClick={() => setShowNewCat(true)} style={{ alignSelf: "flex-start" }}>
                    <PlusIcon s={14} /> New Category
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* ════ WORKSPACE VIEW ════ */
        <>
          {/* Page header */}
          <div className="sw-hdr sw-anim" style={{ marginBottom: 16 }}>
            <h2>Selections Management</h2>
            <p>Create and curate finish options for your clients. Publish when ready — items are invisible to the homeowner until published.</p>
          </div>

          {/* Summary strip */}
          <div className="sw-sum sw-anim" style={{ animationDelay: "60ms" }}>
            <div className="sw-sc purple">
              <div className="sw-sc-label">Total Items</div>
              <div className="sw-sc-value">{totals.totalItems}</div>
              <div className="sw-sc-meta">{totals.published + totals.revisionOpen} published &middot; {totals.drafts} draft</div>
            </div>
            <div className="sw-sc amber">
              <div className="sw-sc-label">Awaiting Decision</div>
              <div className="sw-sc-value">{totals.awaitingDecision}</div>
              <div className="sw-sc-meta">{totals.awaitingDecision === 0 ? "All clear" : "Published, no confirmation"}</div>
            </div>
            <div className="sw-sc red">
              <div className="sw-sc-label">Overdue</div>
              <div className="sw-sc-value">{totals.overdue}</div>
              <div className="sw-sc-meta">{totals.overdue === 0 ? "None" : "Past deadline"}</div>
            </div>
            <div className="sw-sc green">
              <div className="sw-sc-label">Upgrade Impact</div>
              <div className="sw-sc-value">+{formatCents(totals.confirmedUpgradeCents)}</div>
              <div className="sw-sc-meta">{totals.decided} confirmed</div>
            </div>
            <div className="sw-sc blue">
              <div className="sw-sc-label">Total Allowances</div>
              <div className="sw-sc-value">{formatCents(totals.totalAllowanceCents)}</div>
              <div className="sw-sc-meta">All categories</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="sw-tabs sw-anim" style={{ animationDelay: "120ms" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`sw-tab${activeTab === t.id ? " active" : ""}`}
                onClick={() => handleTab(t.id)}
              >
                {t.label} <span className="sw-tab-ct">{tabCounts[t.id]}</span>
              </button>
            ))}
          </div>

          {/* Master-Detail */}
          {filtered.length === 0 ? (
            <div className="sw-empty">
              <h3>No items in this view</h3>
              <p>
                {categories.length === 0
                  ? "Create a category first, then add items to it."
                  : "Items will appear here when they match this filter."}
              </p>
              {categories.length === 0 && (
                <button className="sw-btn primary lg" type="button" onClick={() => { setView("create"); setShowNewCat(true); }} style={{ marginTop: 16 }}>
                  <PlusIcon s={14} /> New Category
                </button>
              )}
            </div>
          ) : (
            <div className="sw-ws sw-anim" style={{ animationDelay: "180ms" }}>
              {/* Queue Panel */}
              <div className="sw-qp">
                <div className="sw-qh">
                  <h3>Selection Items</h3>
                  <span>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="sw-ql">
                  {Array.from(grouped.entries()).map(([cat, its]) => (
                    <div key={cat} style={{ borderBottom: "1px solid var(--s2)" }}>
                      <div className="sw-qcl">
                        {cat}
                        <span className="sw-qcc">{its.length}</span>
                      </div>
                      {its.map((i) => {
                        const pill = statusPillInfo(i, now);
                        const swatchColors = i.options.slice(0, 4).map(o => o.swatchColor);
                        while (swatchColors.length < 4) swatchColors.push(null);
                        const isActive = selected?.id === i.id;
                        return (
                          <button
                            key={i.id}
                            type="button"
                            className={`sw-qi${isActive ? " active" : ""}`}
                            onClick={() => setSelectedId(i.id)}
                          >
                            <SwatchMini colors={swatchColors} />
                            <div className="sw-qb">
                              <h4>{i.title}</h4>
                              <p>{i.options.length} opt{i.options.length !== 1 ? "s" : ""} &middot; Allow. {formatCents(i.allowanceCents)}</p>
                            </div>
                            <div className="sw-qr">
                              <span className={`sw-pill ${pill.cls}`}>{pill.label}</span>
                              <span className="sw-qr-date">
                                {!i.isPublished ? "" : isDecided(i) ? "Locked" : i.selectionItemStatus === "revision_open" ? "Reopened" : "Published"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail Pane */}
              {selected ? (
                <SelectionItemDetail
                  key={selected.id}
                  item={selected}
                  now={now}
                />
              ) : (
                <div className="sw-empty">
                  <h3>Select an item</h3>
                  <p>Pick one from the queue to see details.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DETAIL PANE
// ═══════════════════════════════════════════════════════════════

function SelectionItemDetail({
  item,
  now,
}: {
  item: FlatItem;
  now: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [addOptionOpen, setAddOptionOpen] = useState(false);

  const canPublish = !item.isPublished && item.options.length >= 2;
  const decided = isDecided(item);
  const chosen = item.currentDecision
    ? item.options.find((o) => o.id === item.currentDecision!.selectedOptionId)
    : null;
  const timeline = item.isPublished ? buildTimeline(item) : null;
  const progress = decisionProgress(item);
  const activity = buildActivity(item);
  const od = isOverdue(item, now);
  const odDays = overdueDays(item, now);

  async function publish() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/selections/items/${item.id}/publish`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "publish_failed");
      return;
    }
    router.refresh();
  }

  async function reopen() {
    if (!reopenReason.trim()) {
      setError("reason_required");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/selections/items/${item.id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reopenReason }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "reopen_failed");
      return;
    }
    setReopenReason("");
    setReopenOpen(false);
    router.refresh();
  }

  return (
    <div className="sw-d2">
      <div className="sw-dm">
        {/* Revision banner */}
        {item.selectionItemStatus === "revision_open" && (
          <div className="sw-rev">
            <WarnIcon />
            <div>
              <h4>Reopened for Revision</h4>
              <p>
                {item.currentDecision?.revisionNote ?? "Item reopened for revision."}
                {item.currentDecision?.previousOptionId && chosen && (
                  <> Previous choice: <strong>{chosen.name}</strong></>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Item Header Card */}
        <div className="sw-card">
          <div className="sw-dh">
            <div>
              <div className="sw-dh-cat">{item.categoryName}</div>
              <h2 className="sw-dh-title">{item.title}</h2>
              {item.description && <div className="sw-dh-desc">{item.description}</div>}
              <div className="sw-dh-pills">
                {!item.isPublished && <span className="sw-pill">Draft &mdash; not visible to client</span>}
                {item.selectionItemStatus === "revision_open" && (
                  <>
                    <span className="sw-pill red">Revision &mdash; reopened</span>
                    <span className="sw-pill accent">Published</span>
                    <span className="sw-pill">{item.options.length} options</span>
                  </>
                )}
                {decided && (
                  <>
                    <span className="sw-pill green">Confirmed</span>
                    {item.selectionItemStatus === "locked" && <span className="sw-pill dark">Locked</span>}
                  </>
                )}
                {item.isPublished && !decided && item.selectionItemStatus !== "revision_open" && !od && (
                  <>
                    <span className="sw-pill accent">Published</span>
                    <span className="sw-pill">{item.options.length} options</span>
                  </>
                )}
                {item.isPublished && !decided && item.selectionItemStatus !== "revision_open" && od && (
                  <>
                    <span className="sw-pill orange">Overdue &mdash; {odDays}d past deadline</span>
                    <span className="sw-pill accent">Published</span>
                    <span className="sw-pill">{item.options.length} options</span>
                  </>
                )}
              </div>
            </div>
            <div className="sw-dh-actions">
              {!item.isPublished && (
                <>
                  <button className="sw-btn ghost" type="button"><EditIcon /> Edit</button>
                  {canPublish && (
                    <button className="sw-btn success" type="button" onClick={publish} disabled={pending}>
                      <SendIcon /> {pending ? "..." : "Publish"}
                    </button>
                  )}
                  <button className="sw-btn ghost" type="button"><DupIcon /> Duplicate</button>
                </>
              )}
              {decided && (
                <button className="sw-btn warn-outline" type="button" onClick={() => setReopenOpen(true)}>
                  <UndoIcon /> Reopen for Revision
                </button>
              )}
              {item.selectionItemStatus === "revision_open" && (
                <button className="sw-btn ghost" type="button"><EditIcon /> Edit</button>
              )}
              {item.isPublished && !decided && item.selectionItemStatus !== "revision_open" && (
                <>
                  <button className="sw-btn ghost" type="button"><EditIcon /> Edit</button>
                  {od && (
                    <button className="sw-btn warn-outline" type="button"><NudgeIcon /> Nudge Client</button>
                  )}
                  <button className="sw-btn ghost" type="button"><DupIcon /> Duplicate</button>
                </>
              )}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="sw-meta">
            <div className="sw-mc">
              <div className="sw-mc-k">Allowance</div>
              <div className="sw-mc-v">{formatCents(item.allowanceCents)}</div>
              <div className="sw-mc-m">{item.allowanceCents > 0 ? 'At or below = "Included"' : "All included"}</div>
            </div>
            {decided ? (
              <>
                <div className="sw-mc">
                  <div className="sw-mc-k">Client&apos;s Choice</div>
                  <div className="sw-mc-v" style={{ color: "var(--ac-t)" }}>{chosen?.name ?? "—"}</div>
                  <div className="sw-mc-m">
                    {item.currentDecision && item.currentDecision.priceDeltaCents > 0
                      ? `Upgrade \u00B7 +${formatCents(item.currentDecision.priceDeltaCents)}`
                      : "Included"}
                  </div>
                </div>
                <div className="sw-mc">
                  <div className="sw-mc-k">Confirmed</div>
                  <div className="sw-mc-v">{formatDate(item.currentDecision?.confirmedAt ?? null)}</div>
                  <div className="sw-mc-m">Locked {formatDate(item.currentDecision?.lockedAt ?? null)}</div>
                </div>
                <div className="sw-mc">
                  <div className="sw-mc-k">Lead Time</div>
                  <div className="sw-mc-v">{chosen?.leadTimeDays != null ? `${chosen.leadTimeDays}d` : "—"}</div>
                  <div className="sw-mc-m">Order placed</div>
                </div>
              </>
            ) : (
              <>
                <div className="sw-mc">
                  <div className="sw-mc-k">Decision Deadline</div>
                  <div className="sw-mc-v" style={od ? { color: "var(--dg)" } : {}}>
                    {formatDate(item.decisionDeadline)}
                  </div>
                  <div className="sw-mc-m">{od ? `${odDays}d overdue` : ""}</div>
                </div>
                <div className="sw-mc">
                  <div className="sw-mc-k">Schedule Impact</div>
                  <div className="sw-mc-v">{item.affectsSchedule ? "Yes \u2014 affects install" : "No direct impact"}</div>
                  <div className="sw-mc-m">{item.scheduleImpactNote ?? "\u2014"}</div>
                </div>
                <div className="sw-mc">
                  <div className="sw-mc-k">Revision Window</div>
                  <div className="sw-mc-v">{item.revisionWindowHours}h</div>
                  <div className="sw-mc-m">After confirmation</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Options Table */}
        <div className="sw-card">
          <div className="sw-oh">
            <h3>{decided ? "Options (Decided)" : "Curated Options"}</h3>
            <div className="sw-oh-r">
              <span className="sw-oh-ct">{item.options.length} option{item.options.length !== 1 ? "s" : ""}</span>
              {!decided && (
                <button className="sw-btn primary" type="button" onClick={() => setAddOptionOpen(true)}>
                  <PlusIcon s={12} /> Add
                </button>
              )}
            </div>
          </div>
          {item.options.length === 0 ? (
            <div style={{ padding: 16 }}>
              <div className="sw-draft-ph">
                <h4>No options yet</h4>
                <p>Add at least 2 curated options before publishing.</p>
                <button className="sw-btn primary" type="button" onClick={() => setAddOptionOpen(true)}>
                  <PlusIcon s={14} /> Add First Option
                </button>
              </div>
            </div>
          ) : (
            <table className="sw-ot">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Tier</th>
                  <th>Price</th>
                  <th>Lead Time</th>
                  <th>Supplier / SKU</th>
                  <th>Avail.</th>
                  <th>{decided || item.selectionItemStatus === "revision_open" ? "Status" : "Tags"}</th>
                </tr>
              </thead>
              <tbody>
                {item.options.map((o) => {
                  const isChosen = chosen?.id === o.id;
                  const isRec = o.id === item.recommendedOptionId;
                  const showStatus = decided || item.selectionItemStatus === "revision_open";
                  const rowCls = isChosen ? "sel" : isRec ? "rec" : "";
                  const tierCls = o.optionTier === "included" ? "green" : o.optionTier === "upgrade" ? "orange" : "";
                  const tierLabel = o.optionTier === "included" ? "Included" : o.optionTier === "upgrade" ? "Upgrade" : "Premium";
                  const priceCls = o.optionTier === "included" ? "inc" : o.optionTier === "upgrade" ? "upg" : "prem";
                  const longLead = (o.leadTimeDays ?? 0) > 10;

                  return (
                    <tr key={o.id} className={rowCls}>
                      <td>
                        <div className="sw-on">
                          <div className="sw-os" style={{ background: o.swatchColor ? `linear-gradient(135deg,${o.swatchColor},${adjustColor(o.swatchColor)})` : "var(--s2)" }} />
                          <div className="sw-ont">
                            <h5>{o.name}</h5>
                            {o.description && <p>{o.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {o.optionTier === "premium_upgrade" ? (
                          <span className="sw-pill" style={{ background: "#fef0e6", borderColor: "#f5c9a0", color: "#a04d1a" }}>Premium</span>
                        ) : (
                          <span className={`sw-pill ${tierCls}`}>{tierLabel}</span>
                        )}
                      </td>
                      <td><span className={`sw-op ${priceCls}`}>{formatCents(o.priceCents)}</span></td>
                      <td>
                        {o.leadTimeDays != null ? (
                          <span className={`sw-ol${longLead ? " w" : ""}`}>{o.leadTimeDays}d</span>
                        ) : (
                          <span style={{ color: "var(--t3)" }}>&mdash;</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{o.supplierName ?? "\u2014"}</div>
                          {o.productSku && <div className="sw-sku">{o.productSku}</div>}
                        </div>
                      </td>
                      <td>
                        <span className={`sw-oa ${o.isAvailable ? "ok" : "una"}`}>
                          {o.isAvailable ? "In Stock" : "Unavailable"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {showStatus && isChosen ? (
                          <span className="sw-pill green">Selected</span>
                        ) : showStatus ? (
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>&mdash;</span>
                        ) : isRec ? (
                          <span className="sw-pill accent">Recommended</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--t3)" }}>&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Publish prompt for drafts with insufficient options */}
        {!item.isPublished && item.options.length < 2 && item.options.length > 0 && (
          <div style={{ fontFamily: "var(--fb)", fontSize: 12.5, fontWeight: 540, color: "var(--t2)" }}>
            Add at least {2 - item.options.length} more option{2 - item.options.length === 1 ? "" : "s"} to publish.
          </div>
        )}
        {error && <p style={{ fontFamily: "var(--fb)", fontSize: 12.5, color: "var(--dg-t)", margin: 0 }}>Error: {error}</p>}
      </div>

      {/* Right Rail */}
      <div className="sw-dr">
        {/* Client Decision */}
        <div className="sw-card">
          <div className="sw-rh">
            <h3>Client Decision</h3>
            {!item.isPublished ? (
              <span className="sw-pill">Draft</span>
            ) : decided ? (
              <span className="sw-pill green">Locked</span>
            ) : item.selectionItemStatus === "revision_open" ? (
              <span className="sw-pill orange">Revision</span>
            ) : od ? (
              <span className="sw-pill orange">Awaiting</span>
            ) : (
              <span className="sw-pill blue">In Progress</span>
            )}
          </div>
          {timeline ? (
            <div className="sw-cs-body">
              <div className="sw-cs-bar-wrap">
                <div className="sw-cs-bar">
                  <div className="sw-cs-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="sw-cs-pct">{progress}%</span>
              </div>
              <div>
                {timeline.map((s, i) => (
                  <div key={i} className={`sw-cs-step${s.done ? " done" : ""}${s.current ? " cur" : ""}`}>
                    <div className="sw-cs-dot">{s.done && <CheckIcon />}</div>
                    <div className="sw-cs-st">
                      <h5>{s.label}</h5>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px 20px" }}>
              <div className="sw-draft-ph">
                <p style={{ margin: 0 }}>Publish this item to track client decisions.</p>
              </div>
            </div>
          )}
        </div>

        {/* Financial Impact (decided only) */}
        {decided && chosen && (
          <div className="sw-card" style={{ padding: "16px 20px" }}>
            <h4 style={{ fontFamily: "var(--fd)", fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--t1)" }}>Financial Impact</h4>
            <div className="sw-br"><span className="bk">Allowance</span><span className="bv">{formatCents(item.allowanceCents)}</span></div>
            <div className="sw-br"><span className="bk">Selected price</span><span className="bv">{formatCents(chosen.priceCents)}</span></div>
            <div className="sw-br total">
              <span className="bk">Upgrade cost</span>
              <span className="bv" style={{ color: item.currentDecision && item.currentDecision.priceDeltaCents > 0 ? "var(--wr-t)" : "var(--ok-t)" }}>
                {item.currentDecision && item.currentDecision.priceDeltaCents > 0 ? `+${formatCents(item.currentDecision.priceDeltaCents)}` : "$0"}
              </span>
            </div>
            <div className="sw-br"><span className="bk">Order status</span><span className="bv" style={{ color: "var(--ok-t)" }}>Placed</span></div>
          </div>
        )}

        {/* Activity */}
        <div className="sw-card">
          <div className="sw-rh"><h3>Activity</h3></div>
          <div className="sw-al">
            {activity.map((a, i) => (
              <div key={i} className="sw-ai">
                <div className={`sw-ad ${a.color}`} />
                <div className="sw-at">{a.text}</div>
                <div className="sw-atime">{a.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reopen Modal */}
      {reopenOpen && (
        <div className="sw-modal-bg" onClick={() => setReopenOpen(false)}>
          <div className="sw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sw-modal-head">
              <h3>Reopen for Revision</h3>
              <p>The client will be asked to re-select. Provide a reason.</p>
            </div>
            <div className="sw-modal-body">
              <label className="sw-ao-lbl">
                <span>Reason</span>
                <textarea
                  className="sw-ao-inp sw-ao-ta"
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Supplier notified us that the original selection is unavailable..."
                />
              </label>
              {error && <p style={{ fontFamily: "var(--fb)", fontSize: 12.5, color: "var(--dg-t)", margin: "8px 0 0" }}>Error: {error}</p>}
            </div>
            <div className="sw-modal-foot">
              <button className="sw-btn ghost" type="button" onClick={() => setReopenOpen(false)}>Cancel</button>
              <button className="sw-btn primary" type="button" onClick={reopen} disabled={pending}>
                {pending ? "Reopening..." : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Option Modal */}
      {addOptionOpen && (
        <AddOptionModal
          selectionItemId={item.id}
          onClose={() => setAddOptionOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Color helper for swatch gradients ──────────────────────────

function adjustColor(hex: string): string {
  // Darken a hex color slightly for gradient effect
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - 30);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Add Option Modal ───────────────────────────────────────────

function AddOptionModal({
  selectionItemId,
  onClose,
}: {
  selectionItemId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [tier, setTier] = useState<"included" | "upgrade" | "premium_upgrade">("included");
  const [leadTime, setLeadTime] = useState("");
  const [supplier, setSupplier] = useState("");
  const [sku, setSku] = useState("");
  const [swatchColor, setSwatchColor] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const cents = price ? Math.round(Number.parseFloat(price) * 100) : 0;
    const res = await fetch("/api/selections/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionItemId,
        name,
        description: description || undefined,
        optionTier: tier,
        priceCents: cents,
        leadTimeDays: leadTime ? Number.parseInt(leadTime, 10) : undefined,
        supplierName: supplier || undefined,
        productSku: sku || undefined,
        swatchColor: swatchColor || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="sw-modal-bg" onClick={onClose}>
      <div className="sw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sw-modal-head">
          <h3>Add Option</h3>
          <p>Options are what the client chooses between.</p>
        </div>
        <form onSubmit={onSubmit}>
          <div className="sw-modal-body">
            <div className="sw-ao-row">
              <label className="sw-ao-lbl">
                <span>Name</span>
                <input
                  className="sw-ao-inp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="White Oak Natural"
                />
              </label>
              <label className="sw-ao-lbl">
                <span>Tier</span>
                <select
                  className="sw-ao-inp"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as "included" | "upgrade" | "premium_upgrade")}
                >
                  <option value="included">Included</option>
                  <option value="upgrade">Upgrade</option>
                  <option value="premium_upgrade">Premium upgrade</option>
                </select>
              </label>
            </div>
            <label className="sw-ao-lbl" style={{ marginBottom: 12 }}>
              <span>Description</span>
              <textarea
                className="sw-ao-inp sw-ao-ta"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder='7" wide plank, matte finish, FSC certified'
              />
            </label>
            <div className="sw-ao-row">
              <label className="sw-ao-lbl">
                <span>Price (USD)</span>
                <input
                  className="sw-ao-inp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="2640.00"
                />
              </label>
              <label className="sw-ao-lbl">
                <span>Lead time (days)</span>
                <input
                  className="sw-ao-inp"
                  type="number"
                  min="0"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="5"
                />
              </label>
            </div>
            <div className="sw-ao-row">
              <label className="sw-ao-lbl">
                <span>Supplier</span>
                <input
                  className="sw-ao-inp"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Heritage Hardwoods"
                />
              </label>
              <label className="sw-ao-lbl">
                <span>SKU</span>
                <input
                  className="sw-ao-inp"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="WO-NAT-7M"
                />
              </label>
            </div>
            <label className="sw-ao-lbl">
              <span>Swatch Color (hex)</span>
              <input
                className="sw-ao-inp"
                value={swatchColor}
                onChange={(e) => setSwatchColor(e.target.value)}
                placeholder="#c2a87a"
              />
            </label>
            {error && <p style={{ fontFamily: "var(--fb)", fontSize: 12.5, color: "var(--dg-t)", margin: "8px 0 0" }}>Error: {error}</p>}
          </div>
          <div className="sw-modal-foot">
            <button className="sw-btn ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="sw-btn primary" type="submit" disabled={pending}>
              {pending ? "Adding..." : "Add option"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
