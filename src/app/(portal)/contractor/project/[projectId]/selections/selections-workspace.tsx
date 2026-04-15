"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Modal } from "@/components/modal";
import { Pill, type PillColor } from "@/components/pill";
import type {
  SelectionCategoryRow,
  SelectionItemRow,
  SelectionOptionRow,
} from "@/domain/loaders/project-home";

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

function formatCents(c: number): string {
  if (c === 0) return "$0";
  return `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "Not set";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(item: SelectionItemRow): boolean {
  if (!item.decisionDeadline) return false;
  if (
    item.selectionItemStatus === "confirmed" ||
    item.selectionItemStatus === "locked"
  )
    return false;
  return item.decisionDeadline.getTime() < Date.now();
}

function isDecided(item: SelectionItemRow): boolean {
  return (
    item.selectionItemStatus === "confirmed" ||
    item.selectionItemStatus === "locked"
  );
}

type StatusLabel = { label: string; color: PillColor };

function statusPill(item: SelectionItemRow): StatusLabel {
  if (!item.isPublished) return { label: "Draft", color: "gray" };
  if (item.selectionItemStatus === "revision_open")
    return { label: "Revision", color: "red" };
  if (isDecided(item)) return { label: "Confirmed", color: "green" };
  if (isOverdue(item)) return { label: "Overdue", color: "amber" };
  if (item.selectionItemStatus === "exploring")
    return { label: "Exploring", color: "blue" };
  return { label: "Published", color: "blue" };
}

const TABS: { id: TabId; label: string; match: (i: SelectionItemRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "draft", label: "Draft", match: (i) => !i.isPublished },
  {
    id: "published",
    label: "Published",
    match: (i) =>
      i.isPublished &&
      i.selectionItemStatus !== "revision_open" &&
      !isDecided(i),
  },
  { id: "decided", label: "Decided", match: (i) => isDecided(i) },
  {
    id: "revision",
    label: "Revision",
    match: (i) => i.selectionItemStatus === "revision_open",
  },
];

type FlatItem = SelectionItemRow & { categoryName: string; categoryId: string };

export function ContractorSelectionsWorkspace({
  projectId,
  projectName,
  categories,
  totals,
}: {
  projectId: string;
  projectName: string;
  categories: SelectionCategoryRow[];
  totals: Totals;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);

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

  const [selectedId, setSelectedId] = useState<string | null>(
    allItems[0]?.id ?? null,
  );

  const selected =
    filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

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

  return (
    <div className="sel">
      <header className="sel-head">
        <div className="sel-head-main">
          <div className="sel-crumbs">{projectName} · Selections</div>
          <h1 className="sel-title">Selections Management</h1>
          <p className="sel-desc">
            Create and curate finish options for your client. Publish items when
            ready — homeowners cannot see drafts.
          </p>
        </div>
        <div className="sel-head-actions">
          <Button
            variant="secondary"
            onClick={() => setCreateCategoryOpen(true)}
          >
            New category
          </Button>
          <Button
            variant="primary"
            onClick={() => setCreateItemOpen(true)}
            disabled={categories.length === 0}
          >
            New selection item
          </Button>
        </div>
      </header>

      <div className="sel-kpis">
        <KpiCard
          label="Total items"
          value={totals.totalItems.toString()}
          meta={`${totals.published + totals.revisionOpen} published · ${totals.drafts} draft`}
          iconColor="purple"
        />
        <KpiCard
          label="Awaiting decision"
          value={totals.awaitingDecision.toString()}
          meta={
            totals.awaitingDecision === 0
              ? "All clear"
              : "Published, no confirmation"
          }
          iconColor="blue"
          alert={totals.awaitingDecision > 0}
        />
        <KpiCard
          label="Overdue"
          value={totals.overdue.toString()}
          meta={totals.overdue === 0 ? "None" : "Past deadline"}
          iconColor="red"
          alert={totals.overdue > 0}
        />
        <KpiCard
          label="Upgrade impact"
          value={`+${formatCents(totals.confirmedUpgradeCents)}`}
          meta={`${totals.decided} confirmed`}
          iconColor="green"
        />
        <KpiCard
          label="Total allowances"
          value={formatCents(totals.totalAllowanceCents)}
          meta="All categories"
          iconColor="amber"
        />
      </div>

      <div className="sel-grid">
        <Card
          tabs={TABS.map((t) => ({
            id: t.id,
            label: `${t.label} (${tabCounts[t.id]})`,
          }))}
          activeTabId={activeTab}
          onTabChange={(id) => {
            setActiveTab(id as TabId);
            setSelectedId(null);
          }}
          title="Selection items"
          subtitle="Grouped by category. Draft → published → confirmed."
          padded={false}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No items in this view"
                description={
                  categories.length === 0
                    ? "Create a category first, then add items to it."
                    : "Nothing matches the current filter."
                }
              />
            </div>
          ) : (
            <div className="sel-split">
              <div className="sel-queue">
                {Array.from(grouped.entries()).map(([cat, its]) => (
                  <div key={cat} className="sel-queue-group">
                    <div className="sel-queue-cat">
                      <span>{cat}</span>
                      <span className="sel-queue-cat-n">{its.length}</span>
                    </div>
                    {its.map((i) => {
                      const pill = statusPill(i);
                      return (
                        <button
                          key={i.id}
                          type="button"
                          className={`sel-row ${selected?.id === i.id ? "sel-row-sel" : ""}`}
                          onClick={() => setSelectedId(i.id)}
                        >
                          <div className="sel-row-top">
                            <div className="sel-row-title">{i.title}</div>
                            <Pill color={pill.color}>{pill.label}</Pill>
                          </div>
                          <div className="sel-row-foot">
                            <span>
                              {i.options.length} opt
                              {i.options.length !== 1 ? "s" : ""}
                            </span>
                            <span>· Allow. {formatCents(i.allowanceCents)}</span>
                            {i.decisionDeadline && (
                              <span>· Due {formatDate(i.decisionDeadline)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="sel-detail">
                {selected ? (
                  <SelectionItemDetail key={selected.id} item={selected} />
                ) : (
                  <EmptyState
                    title="Select an item"
                    description="Pick one from the queue to see details."
                  />
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="sel-rail">
          <Card title="Categories" subtitle="Project category tree">
            {categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create one to start organizing selections."
              />
            ) : (
              <div className="sel-cats">
                {categories.map((c) => (
                  <div key={c.id} className="sel-cat-row">
                    <div className="sel-cat-name">{c.name}</div>
                    <div className="sel-cat-count">
                      {c.items.length} item
                      {c.items.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Overdue items" alert={totals.overdue > 0}>
            {totals.overdue === 0 ? (
              <EmptyState
                title="Nothing overdue"
                description="All items within deadline."
              />
            ) : (
              <div className="sel-mini">
                {allItems
                  .filter((i) => isOverdue(i))
                  .map((i) => (
                    <div key={i.id} className="sel-mini-row">
                      <div className="sel-mini-t">{i.title}</div>
                      <div className="sel-mini-d">
                        Due {formatDate(i.decisionDeadline)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <CreateCategoryModal
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        projectId={projectId}
      />
      <CreateItemModal
        open={createItemOpen}
        onClose={() => setCreateItemOpen(false)}
        projectId={projectId}
        categories={categories}
      />

      <style>{`
        .sel{display:flex;flex-direction:column;gap:20px}
        .sel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .sel-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .sel-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .sel-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .sel-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .sel-head-actions{display:flex;gap:8px;flex-shrink:0}
        .sel-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
        @media(max-width:1200px){.sel-kpis{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:720px){.sel-kpis{grid-template-columns:repeat(2,1fr)}}
        .sel-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.sel-grid{grid-template-columns:1fr}}
        .sel-split{display:grid;grid-template-columns:360px minmax(0,1fr)}
        @media(max-width:900px){.sel-split{grid-template-columns:1fr}}
        .sel-queue{border-right:1px solid var(--s3);max-height:720px;overflow-y:auto}
        .sel-queue-group{border-bottom:1px solid var(--s2)}
        .sel-queue-cat{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;background:var(--sh);font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .sel-queue-cat-n{background:var(--s2);padding:2px 7px;border-radius:999px;font-size:10.5px;font-weight:700;color:var(--t2)}
        .sel-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s2);padding:12px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px;width:100%}
        .sel-row:last-child{border-bottom:none}
        .sel-row:hover{background:var(--sh)}
        .sel-row-sel{background:var(--ac-s)}
        .sel-row-sel:hover{background:var(--ac-s)}
        .sel-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .sel-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sel-row-foot{display:flex;gap:4px;flex-wrap:wrap;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .sel-detail{padding:22px 24px;min-width:0}
        .sel-rail{display:flex;flex-direction:column;gap:14px}
        .sel-cats{display:flex;flex-direction:column;gap:2px}
        .sel-cat-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--s2)}
        .sel-cat-row:last-child{border-bottom:none}
        .sel-cat-name{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
        .sel-cat-count{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .sel-mini{display:flex;flex-direction:column;gap:10px}
        .sel-mini-row{padding-bottom:10px;border-bottom:1px solid var(--s2)}
        .sel-mini-row:last-child{border-bottom:none;padding-bottom:0}
        .sel-mini-t{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
        .sel-mini-d{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--dg-t)}
      `}</style>
    </div>
  );
}

function SelectionItemDetail({ item }: { item: SelectionItemRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [addOptionOpen, setAddOptionOpen] = useState(false);

  const pill = statusPill(item);
  const canPublish = !item.isPublished && item.options.length >= 2;
  const decided = isDecided(item);
  const chosen = item.currentDecision
    ? item.options.find((o) => o.id === item.currentDecision!.selectedOptionId)
    : null;

  async function publish() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/selections/items/${item.id}/publish`, {
      method: "POST",
    });
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
    <div className="sid">
      <div className="sid-head">
        <div className="sid-head-main">
          <div className="sid-cat">Selection item</div>
          <h2 className="sid-title">{item.title}</h2>
          {item.description && <p className="sid-desc">{item.description}</p>}
        </div>
        <div className="sid-pills">
          <Pill color={pill.color}>{pill.label}</Pill>
        </div>
      </div>

      <div className="sid-grid">
        <Field label="Allowance" value={formatCents(item.allowanceCents)} />
        <Field
          label="Decision deadline"
          value={formatDate(item.decisionDeadline)}
          tone={isOverdue(item) ? "warn" : undefined}
        />
        <Field
          label="Schedule impact"
          value={item.affectsSchedule ? "Yes — affects install" : "No direct impact"}
          meta={item.scheduleImpactNote ?? undefined}
        />
        <Field
          label="Revision window"
          value={`${item.revisionWindowHours}h`}
          meta="After confirmation"
        />
      </div>

      {decided && chosen && (
        <div className="sid-section">
          <h3>Client's choice</h3>
          <div className="sid-chosen">
            <div className="sid-chosen-name">{chosen.name}</div>
            <div className="sid-chosen-meta">
              {chosen.optionTier === "included"
                ? "Included"
                : `Upgrade · +${formatCents(
                    Math.max(0, item.currentDecision!.priceDeltaCents),
                  )}`}
            </div>
          </div>
        </div>
      )}

      <div className="sid-section">
        <div className="sid-section-head">
          <h3>Curated options ({item.options.length})</h3>
          {!decided && (
            <Button variant="secondary" onClick={() => setAddOptionOpen(true)}>
              Add option
            </Button>
          )}
        </div>
        {item.options.length === 0 ? (
          <EmptyState
            title="No options yet"
            description="Add at least two options before publishing to client."
          />
        ) : (
          <div className="sid-opts">
            {item.options.map((o) => (
              <OptionRow
                key={o.id}
                option={o}
                isChosen={chosen?.id === o.id}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sid-actions">
        {canPublish && (
          <Button variant="primary" onClick={publish} loading={pending}>
            Publish to client
          </Button>
        )}
        {!item.isPublished && item.options.length < 2 && (
          <div className="sid-meta">
            Add at least {2 - item.options.length} more option
            {2 - item.options.length === 1 ? "" : "s"} to publish.
          </div>
        )}
        {decided && (
          <Button variant="secondary" onClick={() => setReopenOpen(true)}>
            Reopen for revision
          </Button>
        )}
      </div>
      {error && <p className="sid-err">Error: {error}</p>}

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        title="Reopen for revision"
        subtitle="The client will be asked to re-select. Provide a reason."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReopenOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={reopen} loading={pending}>
              Reopen
            </Button>
          </>
        }
      >
        <label className="sid-lbl">
          <span>Reason</span>
          <textarea
            className="sid-inp sid-ta"
            rows={3}
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Supplier notified us that the original selection is unavailable…"
          />
        </label>
      </Modal>

      <AddOptionModal
        open={addOptionOpen}
        onClose={() => setAddOptionOpen(false)}
        selectionItemId={item.id}
      />

      <style>{`
        .sid{display:flex;flex-direction:column;gap:18px}
        .sid-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .sid-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .sid-cat{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .sid-title{font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.02em;color:var(--t1);margin:0}
        .sid-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .sid-pills{display:flex;gap:6px;flex-shrink:0}
        .sid-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .sid-section h3{font-family:var(--fd);font-size:14px;font-weight:740;color:var(--t1);margin:0 0 10px;letter-spacing:-.01em}
        .sid-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}
        .sid-section-head h3{margin:0}
        .sid-chosen{background:var(--ac-s);border:1px solid var(--ac-s);border-radius:var(--r-m);padding:12px 14px;display:flex;justify-content:space-between;gap:12px;align-items:center}
        .sid-chosen-name{font-family:var(--fd);font-size:14px;font-weight:740;color:var(--ac-t)}
        .sid-chosen-meta{font-family:var(--fb);font-size:12px;font-weight:600;color:var(--ac-t)}
        .sid-opts{display:flex;flex-direction:column;gap:8px}
        .sid-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .sid-meta{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .sid-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
        .sid-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
        .sid-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
        .sid-inp:focus{outline:none;border-color:var(--ac)}
        .sid-ta{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
      `}</style>
    </div>
  );
}

function OptionRow({
  option,
  isChosen,
}: {
  option: SelectionOptionRow;
  isChosen: boolean;
}) {
  const tierLabel =
    option.optionTier === "included"
      ? "Included"
      : option.optionTier === "upgrade"
        ? "Upgrade"
        : "Premium";
  const tierColor: PillColor =
    option.optionTier === "included"
      ? "gray"
      : option.optionTier === "upgrade"
        ? "amber"
        : "purple";
  return (
    <div className={`opt-row ${isChosen ? "opt-row-sel" : ""}`}>
      <div
        className="opt-sw"
        style={{
          background: option.swatchColor ?? "var(--s2)",
        }}
      />
      <div className="opt-body">
        <div className="opt-top">
          <div className="opt-name">{option.name}</div>
          <Pill color={tierColor}>{tierLabel}</Pill>
        </div>
        {option.description && <div className="opt-desc">{option.description}</div>}
        <div className="opt-foot">
          <span>{formatCents(option.priceCents)}</span>
          {option.leadTimeDays != null && <span>· {option.leadTimeDays}d lead</span>}
          {option.supplierName && <span className="opt-mono">· {option.supplierName}</span>}
          {option.productSku && <span className="opt-mono">· {option.productSku}</span>}
          {!option.isAvailable && <span className="opt-bad">· unavailable</span>}
        </div>
      </div>
      <style>{`
        .opt-row{display:flex;gap:12px;padding:12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1)}
        .opt-row-sel{border-color:var(--ac);background:var(--ac-s)}
        .opt-sw{width:44px;height:44px;border-radius:var(--r-s);flex-shrink:0;border:1px solid var(--s3)}
        .opt-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
        .opt-top{display:flex;justify-content:space-between;gap:8px;align-items:center}
        .opt-name{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1)}
        .opt-desc{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.5}
        .opt-foot{display:flex;gap:4px;flex-wrap:wrap;font-family:var(--fb);font-size:11.5px;font-weight:580;color:var(--t3)}
        .opt-mono{font-family:var(--fm)}
        .opt-bad{color:var(--dg-t)}
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "warn" | "good";
}) {
  return (
    <div className="sid-field">
      <div className="sid-k">{label}</div>
      <div
        className="sid-v"
        style={{
          ...(tone === "warn" ? { color: "var(--wr-t)" } : {}),
          ...(tone === "good" ? { color: "var(--ok-t)" } : {}),
        }}
      >
        {value}
      </div>
      {meta && <div className="sid-m">{meta}</div>}
      <style>{`
        .sid-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .sid-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .sid-v{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);letter-spacing:-.005em}
        .sid-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
  );
}

function CreateCategoryModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/selections/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setName("");
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New category"
      subtitle="Group selection items by room or area."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="sel-cat-form"
            loading={pending}
          >
            Create category
          </Button>
        </>
      }
    >
      <form id="sel-cat-form" onSubmit={onSubmit} className="sof">
        <label className="sof-lbl">
          <span>Name</span>
          <input
            className="sof-inp"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Kitchen"
          />
        </label>
        {error && <p className="sof-err">Error: {error}</p>}
        <style>{`
          .sof{display:flex;flex-direction:column;gap:12px}
          .sof-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
          .sof-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
          .sof-inp:focus{outline:none;border-color:var(--ac)}
          .sof-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
        `}</style>
      </form>
    </Modal>
  );
}

function CreateItemModal({
  open,
  onClose,
  projectId,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  categories: SelectionCategoryRow[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowance, setAllowance] = useState("");
  const [deadline, setDeadline] = useState("");
  const [affectsSchedule, setAffectsSchedule] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || !title.trim()) return;
    setPending(true);
    setError(null);
    const cents = allowance
      ? Math.round(Number.parseFloat(allowance) * 100)
      : 0;
    const res = await fetch("/api/selections/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        categoryId,
        title,
        description: description || undefined,
        allowanceCents: cents,
        decisionDeadline: deadline
          ? new Date(deadline).toISOString()
          : undefined,
        affectsSchedule,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setTitle("");
    setDescription("");
    setAllowance("");
    setDeadline("");
    setAffectsSchedule(false);
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New selection item"
      subtitle="Items stay draft until published."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="sel-item-form"
            loading={pending}
          >
            Create draft
          </Button>
        </>
      }
    >
      <form id="sel-item-form" onSubmit={onSubmit} className="sif">
        <div className="sif-row">
          <label className="sif-lbl">
            <span>Category</span>
            <select
              className="sif-inp"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sif-lbl">
            <span>Title</span>
            <input
              className="sif-inp"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Flooring finish"
            />
          </label>
        </div>
        <label className="sif-lbl">
          <span>Description</span>
          <textarea
            className="sif-inp sif-ta"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown to the homeowner for context."
          />
        </label>
        <div className="sif-row">
          <label className="sif-lbl">
            <span>Allowance (USD)</span>
            <input
              className="sif-inp"
              type="number"
              step="0.01"
              min="0"
              value={allowance}
              onChange={(e) => setAllowance(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="sif-lbl">
            <span>Decision deadline</span>
            <input
              className="sif-inp"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        </div>
        <label className="sif-check">
          <input
            type="checkbox"
            checked={affectsSchedule}
            onChange={(e) => setAffectsSchedule(e.target.checked)}
          />
          <span>Affects project schedule</span>
        </label>
        {error && <p className="sif-err">Error: {error}</p>}
        <style>{`
          .sif{display:flex;flex-direction:column;gap:12px}
          .sif-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .sif-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
          .sif-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
          .sif-inp:focus{outline:none;border-color:var(--ac)}
          .sif-ta{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
          .sif-check{display:flex;align-items:center;gap:8px;font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t2)}
          .sif-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
        `}</style>
      </form>
    </Modal>
  );
}

function AddOptionModal({
  open,
  onClose,
  selectionItemId,
}: {
  open: boolean;
  onClose: () => void;
  selectionItemId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [tier, setTier] = useState<"included" | "upgrade" | "premium_upgrade">(
    "included",
  );
  const [leadTime, setLeadTime] = useState("");
  const [supplier, setSupplier] = useState("");
  const [sku, setSku] = useState("");
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
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "create_failed");
      return;
    }
    setName("");
    setDescription("");
    setPrice("");
    setTier("included");
    setLeadTime("");
    setSupplier("");
    setSku("");
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add option"
      subtitle="Options are what the client chooses between."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="sel-opt-form"
            loading={pending}
          >
            Add option
          </Button>
        </>
      }
    >
      <form id="sel-opt-form" onSubmit={onSubmit} className="sif">
        <div className="sif-row">
          <label className="sif-lbl">
            <span>Name</span>
            <input
              className="sif-inp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="White Oak Natural"
            />
          </label>
          <label className="sif-lbl">
            <span>Tier</span>
            <select
              className="sif-inp"
              value={tier}
              onChange={(e) =>
                setTier(
                  e.target.value as "included" | "upgrade" | "premium_upgrade",
                )
              }
            >
              <option value="included">Included</option>
              <option value="upgrade">Upgrade</option>
              <option value="premium_upgrade">Premium upgrade</option>
            </select>
          </label>
        </div>
        <label className="sif-lbl">
          <span>Description</span>
          <textarea
            className="sif-inp sif-ta"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="7&quot; wide plank, matte finish, FSC certified"
          />
        </label>
        <div className="sif-row">
          <label className="sif-lbl">
            <span>Price (USD)</span>
            <input
              className="sif-inp"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2640.00"
            />
          </label>
          <label className="sif-lbl">
            <span>Lead time (days)</span>
            <input
              className="sif-inp"
              type="number"
              min="0"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
              placeholder="5"
            />
          </label>
        </div>
        <div className="sif-row">
          <label className="sif-lbl">
            <span>Supplier</span>
            <input
              className="sif-inp"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Heritage Hardwoods"
            />
          </label>
          <label className="sif-lbl">
            <span>SKU</span>
            <input
              className="sif-inp"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="WO-NAT-7M"
            />
          </label>
        </div>
        {error && <p className="sif-err">Error: {error}</p>}
      </form>
    </Modal>
  );
}
