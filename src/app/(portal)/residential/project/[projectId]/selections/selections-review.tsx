"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type {
  SelectionCategoryRow,
  SelectionItemRow,
  SelectionOptionRow,
} from "@/domain/loaders/project-home";
import type { ResidentialSelectionsTotals } from "@/domain/loaders/selections";

function formatCents(c: number): string {
  const abs = Math.abs(c);
  const s = `$${(abs / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return c < 0 ? `-${s}` : s;
}

function formatSignedCents(c: number): string {
  if (c === 0) return "Included";
  return c > 0 ? `+${formatCents(c)}` : formatCents(c);
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type ItemView = "exploring" | "provisional" | "confirmed" | "revision";

function itemView(item: SelectionItemRow): ItemView {
  if (item.selectionItemStatus === "revision_open") return "revision";
  if (
    item.selectionItemStatus === "confirmed" ||
    item.selectionItemStatus === "locked"
  )
    return "confirmed";
  if (item.currentDecision?.isProvisional) return "provisional";
  return "exploring";
}

function itemStatusPill(item: SelectionItemRow): {
  label: string;
  color: PillColor;
} {
  const v = itemView(item);
  if (v === "confirmed") return { label: "Confirmed", color: "green" };
  if (v === "revision") return { label: "Reopened", color: "amber" };
  if (v === "provisional")
    return { label: "Provisional choice", color: "blue" };
  if (item.decisionDeadline) {
    const days = Math.ceil(
      (item.decisionDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    if (days <= 7) return { label: "Decide this week", color: "red" };
  }
  return { label: "Ready to review", color: "blue" };
}

function optionPriceInfo(
  opt: SelectionOptionRow,
  allowanceCents: number,
): { label: string; note: string; upgrade: boolean } {
  const delta = opt.priceCents - allowanceCents;
  if (delta <= 0) {
    return {
      label: "Included",
      note: "Within your allowance",
      upgrade: false,
    };
  }
  return {
    label: `+${formatCents(delta)}`,
    note: "Above your allowance",
    upgrade: true,
  };
}

function tierLabel(tier: SelectionOptionRow["optionTier"]): string {
  if (tier === "included") return "Included";
  if (tier === "upgrade") return "Upgrade";
  return "Premium";
}

const BackArrow = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5m0 0 7 7m-7-7 7-7" />
  </svg>
);
const ClockIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4l3 3" />
  </svg>
);
const CalIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2Z" />
  </svg>
);
const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const LockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);
const WarnIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

type FlatItem = SelectionItemRow & {
  categoryName: string;
  categoryId: string;
};

export function ResidentialSelectionsReview({
  projectName,
  categories,
  totals,
}: {
  projectName: string;
  categories: SelectionCategoryRow[];
  totals: ResidentialSelectionsTotals;
}) {
  const allItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    for (const c of categories) {
      for (const i of c.items) {
        out.push({ ...i, categoryName: c.name, categoryId: c.id });
      }
    }
    return out;
  }, [categories]);

  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = openId ? allItems.find((i) => i.id === openId) ?? null : null;

  if (openItem) {
    return (
      <ItemDetail
        item={openItem}
        projectName={projectName}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="rsel">
      {/* ── State tabs ── */}
      <div className="rsel-state-nav">
        {[
          { k: "overview", label: "Overview", dot: "var(--ac)" },
          { k: "exploring", label: "Exploring", dot: "var(--wr)" },
          { k: "provisional", label: "Provisional", dot: "var(--ac)" },
          { k: "confirmed", label: "Confirmed", dot: "var(--ok)" },
          { k: "revision", label: "Revision", dot: "var(--dg)" },
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            className={`rsel-state-tab${t.k === "overview" ? " active" : ""}`}
          >
            <span className="rsel-tab-dot" style={{ background: t.dot }} />
            {t.label}
          </button>
        ))}
      </div>

      <header className="rsel-head">
        <h1 className="rsel-title">Your Selections</h1>
        <p className="rsel-desc">
          Your builder has prepared finish options for you to review. Take your
          time &mdash; we&apos;ll let you know which ones need attention first.
        </p>
      </header>

      {/* ── Summary strip ── */}
      <div className="rsel-summary">
        <div className="rsel-sc teal">
          <div className="rsel-sc-label">Ready to choose</div>
          <div className="rsel-sc-value">{totals.readyToChoose}</div>
          <div className="rsel-sc-meta">
            {totals.readyToChoose === 0
              ? "Nothing waiting on you"
              : "Options are waiting for you"}
          </div>
        </div>
        <div className="rsel-sc orange">
          <div className="rsel-sc-label">Time-sensitive</div>
          <div className="rsel-sc-value">{totals.timeSensitive}</div>
          <div className="rsel-sc-meta">
            {totals.timeSensitive === 0
              ? "Nothing urgent"
              : "Affects scheduling this week"}
          </div>
        </div>
        <div className="rsel-sc">
          <div className="rsel-sc-label">Confirmed</div>
          <div className="rsel-sc-value">{totals.confirmed}</div>
          <div className="rsel-sc-meta">Locked in and moving forward</div>
        </div>
        <div className="rsel-sc">
          <div className="rsel-sc-label">Upgrade total</div>
          <div className="rsel-sc-value">
            {totals.confirmedUpgradeCents === 0
              ? "$0"
              : `+${formatCents(totals.confirmedUpgradeCents)}`}
          </div>
          <div className="rsel-sc-meta">Based on current choices</div>
        </div>
      </div>

      {allItems.length === 0 ? (
        <EmptyState
          title="No selections yet"
          description="When your builder publishes finish options, they'll show up here for you to review."
        />
      ) : (
        categories
          .filter((c) => c.items.length > 0)
          .map((cat) => (
            <section key={cat.id} className="rsel-cat">
              <div className="rsel-cat-head">
                <h2>{cat.name}</h2>
                <span className="rsel-cat-count">{cat.items.length} items</span>
              </div>
              <div className="rsel-grid">
                {cat.items.map((item) => (
                  <OverviewCard
                    key={item.id}
                    item={item}
                    onOpen={() => setOpenId(item.id)}
                  />
                ))}
              </div>
            </section>
          ))
      )}

      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
    </div>
  );
}

function OverviewCard({
  item,
  onOpen,
}: {
  item: SelectionItemRow;
  onOpen: () => void;
}) {
  const pill = itemStatusPill(item);
  const view = itemView(item);
  const optionCount = item.options.filter((o) => o.isAvailable).length;

  const desc =
    view === "confirmed" && item.currentDecision
      ? `You confirmed ${item.options.find((o) => o.id === item.currentDecision?.selectedOptionId)?.name ?? "this option"}. Procurement is underway.`
      : view === "revision"
        ? "Your original choice is no longer available. New options are ready for your review."
        : view === "provisional"
          ? "You've selected an option. Review the impact and confirm when you're ready."
          : item.description ??
            `${optionCount} option${optionCount === 1 ? "" : "s"} ready for your review.`;

  const swatches = item.options
    .filter((o) => o.isAvailable)
    .slice(0, 3)
    .map((o) => o.swatchColor ?? "#c2a87a");

  const bgColor = swatches[0] ?? "#c2a87a";
  const cardBg = `linear-gradient(135deg, ${bgColor}44, ${bgColor}18)`;

  return (
    <button className="rsel-card" type="button" onClick={onOpen}>
      <div className="rsel-card-visual" style={{ background: cardBg }}>
        <div className="rsel-card-sw-row">
          {swatches.map((c, i) => (
            <span
              key={i}
              className="rsel-sw"
              style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)` }}
            />
          ))}
        </div>
        <div className="rsel-card-pill">
          <Pill color={pill.color}>{pill.label}</Pill>
        </div>
      </div>
      <div className="rsel-card-body">
        <h3>{item.title}</h3>
        <p>{desc}</p>
        <div className="rsel-card-foot">
          {view === "confirmed" ? (
            <Pill color="green">Confirmed</Pill>
          ) : view === "revision" ? (
            <Pill color="amber">Needs attention</Pill>
          ) : view === "provisional" ? (
            <Pill color="blue">Provisional</Pill>
          ) : (
            <Pill color="gray">Not started</Pill>
          )}
          <Pill color="gray">
            {optionCount} option{optionCount === 1 ? "" : "s"}
          </Pill>
          {item.decisionDeadline && view !== "confirmed" && (
            <Pill color="gray">By {formatDate(item.decisionDeadline)}</Pill>
          )}
        </div>
      </div>
    </button>
  );
}

function ItemDetail({
  item,
  projectName,
  onBack,
}: {
  item: SelectionItemRow;
  projectName: string;
  onBack: () => void;
}) {
  const view = itemView(item);
  return (
    <div className="rsel-detail">
      <div className="rsel-detail-crumbs">
        {projectName} · Selections · {item.title}
      </div>
      <button className="rsel-back" type="button" onClick={onBack}>
        <BackArrow /> Back to all selections
      </button>

      {view === "exploring" && <ExploringView item={item} />}
      {view === "provisional" && <ProvisionalView item={item} onBack={onBack} />}
      {view === "confirmed" && <ConfirmedView item={item} />}
      {view === "revision" && <RevisionView item={item} />}

      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
    </div>
  );
}

function ItemHeader({
  item,
  pill,
}: {
  item: SelectionItemRow;
  pill: { label: string; color: PillColor };
}) {
  return (
    <div className="rsel-ih">
      <div className="rsel-ih-top">
        <div>
          <h2 className="rsel-ih-title">{item.title}</h2>
          {item.description && (
            <p className="rsel-ih-desc">{item.description}</p>
          )}
        </div>
        <Pill color={pill.color}>{pill.label}</Pill>
      </div>
      <div className="rsel-meta">
        {item.decisionDeadline && (
          <div className="rsel-chip">
            <CalIcon /> Decide by <strong>{formatDate(item.decisionDeadline)}</strong>
          </div>
        )}
        <div className="rsel-chip">
          <strong>{item.options.filter((o) => o.isAvailable).length}</strong>{" "}
          options
        </div>
        {item.affectsSchedule && (
          <div className="rsel-chip">
            <ClockIcon /> May affect schedule
          </div>
        )}
        <div className="rsel-chip">
          Allowance: <strong>{formatCents(item.allowanceCents)}</strong>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  opt,
  allowanceCents,
  isRecommended,
  selected,
  onClick,
  disabled,
}: {
  opt: SelectionOptionRow;
  allowanceCents: number;
  isRecommended: boolean;
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const price = optionPriceInfo(opt, allowanceCents);
  const swatch = opt.swatchColor ?? "#c2a87a";
  return (
    <button
      type="button"
      className={
        "rsel-opt" +
        (selected ? " selected" : "") +
        (isRecommended ? " recommended" : "") +
        (disabled ? " disabled" : "")
      }
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div
        className="rsel-opt-visual"
        style={{ background: `linear-gradient(135deg,${swatch}55,${swatch}22)` }}
      >
        <div
          className="rsel-opt-swatch"
          style={{ background: `linear-gradient(135deg,${swatch},${swatch}aa)` }}
        />
        <div className="rsel-opt-tags">
          {isRecommended && <span className="rsel-opt-tag rec">Recommended</span>}
          <span
            className={
              "rsel-opt-tag " +
              (opt.optionTier === "included"
                ? "inc"
                : opt.optionTier === "upgrade"
                  ? "upg"
                  : "prem")
            }
          >
            {tierLabel(opt.optionTier)}
          </span>
        </div>
        <div className="rsel-opt-check">
          <CheckIcon />
        </div>
      </div>
      <div className="rsel-opt-body">
        <h4>{opt.name}</h4>
        {opt.description && <p>{opt.description}</p>}
        <div className="rsel-opt-price">
          <span
            className={"rsel-price " + (price.upgrade ? "upg" : "inc")}
          >
            {price.label}
          </span>
          <span className="rsel-price-note">{price.note}</span>
        </div>
        {opt.additionalScheduleDays != null && (
          <div
            className={
              "rsel-opt-timing" +
              (opt.additionalScheduleDays > 0 ? " warn" : "")
            }
          >
            <ClockIcon />{" "}
            {opt.additionalScheduleDays > 0
              ? `+${opt.additionalScheduleDays} days lead time`
              : "No schedule impact"}
          </div>
        )}
      </div>
    </button>
  );
}

function ExploringView({ item }: { item: SelectionItemRow }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const availableOptions = item.options.filter((o) => o.isAvailable);

  async function selectOption(optionId: string) {
    setPending(optionId);
    setError(null);
    const res = await fetch("/api/selections/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionItemId: item.id,
        selectedOptionId: optionId,
      }),
    });
    setPending(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  const recommended = item.options.find((o) => o.id === item.recommendedOptionId);
  const pill = itemStatusPill(item);

  return (
    <div className="rsel-layout">
      <div className="rsel-main">
        <ItemHeader item={item} pill={pill} />
        <div className="rsel-opts-head">
          <h3>Your options</h3>
          {availableOptions.length >= 2 && (
            <Button
              variant="secondary"
              onClick={() => setShowCompare(!showCompare)}
            >
              {showCompare ? "Close comparison" : "Compare side by side"}
            </Button>
          )}
        </div>
        <div className="rsel-opts-grid">
          {availableOptions.map((opt) => (
            <OptionCard
              key={opt.id}
              opt={opt}
              allowanceCents={item.allowanceCents}
              isRecommended={opt.id === item.recommendedOptionId}
              selected={false}
              disabled={pending !== null}
              onClick={() => selectOption(opt.id)}
            />
          ))}
        </div>
        {error && <p className="rsel-err">Error: {error}</p>}

        {showCompare && availableOptions.length >= 2 && (
          <div className="rsel-compare">
            <h3>Side-by-side comparison</h3>
            <CompareTable
              options={availableOptions}
              allowanceCents={item.allowanceCents}
            />
          </div>
        )}
      </div>

      <aside className="rsel-rail">
        {recommended && (
          <div className="rsel-rc teal">
            <h3>What your builder recommends</h3>
            <div className="rsel-rc-sub">
              This is a suggestion &mdash; the choice is yours.
            </div>
            <div className="rsel-rec-row">
              <div
                className="rsel-rec-sw"
                style={{
                  background: `linear-gradient(135deg,${recommended.swatchColor ?? "#c2a87a"},${(recommended.swatchColor ?? "#c2a87a")}aa)`,
                }}
              />
              <div>
                <div className="rsel-rec-name">{recommended.name}</div>
                <div className="rsel-rec-meta">
                  {tierLabel(recommended.optionTier)} &middot;{" "}
                  {recommended.additionalScheduleDays &&
                  recommended.additionalScheduleDays > 0
                    ? `+${recommended.additionalScheduleDays} days`
                    : "No schedule change"}
                </div>
              </div>
            </div>
            {recommended.description && (
              <p className="rsel-rc-body">{recommended.description}</p>
            )}
          </div>
        )}
        {item.urgencyNote && (
          <div className="rsel-rc">
            <h3>Why decide soon</h3>
            <p className="rsel-rc-body">{item.urgencyNote}</p>
          </div>
        )}
        {item.scheduleImpactNote && (
          <div className="rsel-rc">
            <h3>Schedule note</h3>
            <p className="rsel-rc-body">{item.scheduleImpactNote}</p>
          </div>
        )}
        <div className="rsel-rc">
          <h3>Helpful files</h3>
          <div className="rsel-rc-sub">References to help you decide.</div>
          <div className="rsel-rc-body">
            <div className="rsel-file-row">
              <div>
                <h5>Sample photo board</h5>
                <p>All options photographed in similar lighting.</p>
              </div>
              <span className="rsel-file-chip">PDF</span>
            </div>
            <div className="rsel-file-row">
              <div>
                <h5>Care &amp; maintenance guide</h5>
                <p>Cleaning and upkeep recommendations.</p>
              </div>
              <span className="rsel-file-chip">PDF</span>
            </div>
          </div>
        </div>
        <QuestionsCard />
      </aside>
    </div>
  );
}

function CompareTable({
  options,
  allowanceCents,
}: {
  options: SelectionOptionRow[];
  allowanceCents: number;
}) {
  const cols = options.slice(0, 3);
  return (
    <div
      className="rsel-cg"
      style={{
        gridTemplateColumns: `150px repeat(${cols.length}, 1fr)`,
      }}
    >
      <div className="rsel-cg-h"></div>
      {cols.map((o) => (
        <div key={o.id} className="rsel-cg-h">
          {o.name}
        </div>
      ))}

      <div className="rsel-cg-l">Price impact</div>
      {cols.map((o) => {
        const p = optionPriceInfo(o, allowanceCents);
        return (
          <div
            key={o.id}
            className="rsel-cg-c"
            style={{
              color: p.upgrade ? "var(--wr-t)" : "var(--ok-t)",
              fontWeight: 700,
            }}
          >
            {p.label}
          </div>
        );
      })}

      <div className="rsel-cg-l">Schedule</div>
      {cols.map((o) => (
        <div
          key={o.id}
          className="rsel-cg-c"
          style={
            o.additionalScheduleDays && o.additionalScheduleDays > 0
              ? { color: "var(--wr-t)", fontWeight: 700 }
              : undefined
          }
        >
          {o.additionalScheduleDays && o.additionalScheduleDays > 0
            ? `+${o.additionalScheduleDays} days`
            : "No change"}
        </div>
      ))}

      <div className="rsel-cg-l">Tier</div>
      {cols.map((o) => (
        <div key={o.id} className="rsel-cg-c">
          {tierLabel(o.optionTier)}
        </div>
      ))}

      {cols.some((o) => o.supplierName) && (
        <>
          <div className="rsel-cg-l">Supplier</div>
          {cols.map((o) => (
            <div key={o.id} className="rsel-cg-c">
              {o.supplierName ?? "—"}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ProvisionalView({
  item,
  onBack,
}: {
  item: SelectionItemRow;
  onBack: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const decision = item.currentDecision;
  const selectedOption = item.options.find(
    (o) => o.id === decision?.selectedOptionId,
  );

  async function confirm() {
    if (!decision) return;
    setPending(true);
    setError(null);
    const res = await fetch(
      `/api/selections/decisions/${decision.id}/confirm`,
      { method: "POST" },
    );
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  if (!decision || !selectedOption) {
    return <ExploringView item={item} />;
  }

  const price = optionPriceInfo(selectedOption, item.allowanceCents);
  const revisionHours = item.revisionWindowHours;

  return (
    <div className="rsel-layout">
      <div className="rsel-main">
        <ItemHeader
          item={item}
          pill={{ label: "Provisional choice", color: "blue" }}
        />
        <div className="rsel-opts-head">
          <h3>Your provisional selection</h3>
        </div>
        <div
          className="rsel-opts-grid"
          style={{ gridTemplateColumns: "1fr" }}
        >
          <OptionCard
            opt={selectedOption}
            allowanceCents={item.allowanceCents}
            isRecommended={selectedOption.id === item.recommendedOptionId}
            selected
            disabled
          />
        </div>
        {error && <p className="rsel-err">Error: {error}</p>}
      </div>

      <aside className="rsel-rail">
        <div className="rsel-rc teal">
          <h3>Impact summary</h3>
          <div className="rsel-rc-sub">
            What this choice means for your project.
          </div>
          <div className="rsel-imp">
            <div>
              <h5>Budget impact</h5>
              <p>
                {price.upgrade
                  ? `${price.label} above your ${formatCents(item.allowanceCents)} allowance`
                  : `Within your ${formatCents(item.allowanceCents)} allowance`}
              </p>
            </div>
            <span
              className="rsel-imp-v"
              style={{
                color: price.upgrade ? "var(--wr-t)" : "var(--ok-t)",
              }}
            >
              {price.label}
            </span>
          </div>
          <div className="rsel-imp">
            <div>
              <h5>Schedule impact</h5>
              <p>
                {selectedOption.additionalScheduleDays &&
                selectedOption.additionalScheduleDays > 0
                  ? `+${selectedOption.additionalScheduleDays} days added to your timeline`
                  : "No delay to your timeline"}
              </p>
            </div>
            <span
              className="rsel-imp-v"
              style={{
                color:
                  selectedOption.additionalScheduleDays &&
                  selectedOption.additionalScheduleDays > 0
                    ? "var(--wr-t)"
                    : "var(--ok-t)",
              }}
            >
              {selectedOption.additionalScheduleDays &&
              selectedOption.additionalScheduleDays > 0
                ? `+${selectedOption.additionalScheduleDays}d`
                : "None"}
            </span>
          </div>
          <div className="rsel-imp">
            <div>
              <h5>Revision window</h5>
              <p>
                You can change your mind within {revisionHours}h after confirming
              </p>
            </div>
            <span className="rsel-imp-v">{revisionHours}h</span>
          </div>
          <div className="rsel-imp-acts">
            <Button variant="primary" onClick={confirm} loading={pending}>
              Confirm {selectedOption.name}
            </Button>
            <Button variant="secondary" onClick={onBack}>
              Change my mind
            </Button>
          </div>
        </div>
        <QuestionsCard />
      </aside>
    </div>
  );
}

function ConfirmedView({ item }: { item: SelectionItemRow }) {
  const decision = item.currentDecision;
  const chosen = item.options.find((o) => o.id === decision?.selectedOptionId);
  const isLocked =
    item.selectionItemStatus === "locked" || decision?.isLocked;

  return (
    <div className="rsel-layout">
      <div className="rsel-main">
        {isLocked && (
          <div className="rsel-locked">
            <LockIcon />
            <p>
              This selection is <strong>confirmed and locked</strong>. The
              revision window has closed.
            </p>
          </div>
        )}
        <ItemHeader
          item={item}
          pill={{ label: "Confirmed", color: "green" }}
        />
        <div className="rsel-post">
          <h3>
            <CheckIcon /> What happens next
          </h3>
          <div className="rsel-post-step">
            <div className="rsel-post-dot">1</div>
            <div>
              <h5>Order placed</h5>
              <p>
                Your builder will order the material after the revision window
                closes.
              </p>
            </div>
          </div>
          <div className="rsel-post-step">
            <div className="rsel-post-dot">2</div>
            <div>
              <h5>Delivery scheduled</h5>
              <p>Expected to arrive in time for the install phase.</p>
            </div>
          </div>
          <div className="rsel-post-step">
            <div className="rsel-post-dot">3</div>
            <div>
              <h5>Installation</h5>
              <p>
                Installed during the matching phase of your project timeline.
              </p>
            </div>
          </div>
        </div>
      </div>

      <aside className="rsel-rail">
        <div className="rsel-rc">
          <h3>Your choice</h3>
          {chosen && (
            <div className="rsel-rec-row">
              <div
                className="rsel-rec-sw"
                style={{
                  background: `linear-gradient(135deg,${chosen.swatchColor ?? "#c2a87a"},${(chosen.swatchColor ?? "#c2a87a")}aa)`,
                }}
              />
              <div>
                <div className="rsel-rec-name">{chosen.name}</div>
                <div className="rsel-rec-meta">
                  {tierLabel(chosen.optionTier)}
                  {decision?.confirmedAt &&
                    ` · Confirmed ${formatDate(decision.confirmedAt)}`}
                </div>
              </div>
            </div>
          )}
        </div>
        {decision?.revisionExpiresAt && !isLocked && (
          <div className="rsel-rc">
            <h3>Revision window</h3>
            <p className="rsel-rc-body">
              You can still change your mind until{" "}
              <strong>{formatDate(decision.revisionExpiresAt)}</strong>.
            </p>
          </div>
        )}
        <QuestionsCard />
      </aside>
    </div>
  );
}

function RevisionView({ item }: { item: SelectionItemRow }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const availableOptions = item.options.filter((o) => o.isAvailable);
  const unavailableOptions = item.options.filter((o) => !o.isAvailable);
  const previousOption = item.currentDecision
    ? item.options.find((o) => o.id === item.currentDecision?.selectedOptionId)
    : null;

  async function selectOption(optionId: string) {
    setPending(optionId);
    setError(null);
    const res = await fetch("/api/selections/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionItemId: item.id,
        selectedOptionId: optionId,
      }),
    });
    setPending(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rsel-layout">
      <div className="rsel-main">
        <div className="rsel-rev-banner">
          <WarnIcon />
          <div>
            <h4>Your previous choice is no longer available</h4>
            <p>
              {previousOption
                ? `${previousOption.name} is unavailable. Your builder prepared alternatives.`
                : "Your builder prepared alternatives that match your original style and budget."}
            </p>
          </div>
        </div>
        <ItemHeader item={item} pill={{ label: "Reopened", color: "amber" }} />
        <div className="rsel-opts-head">
          <h3>Updated options</h3>
        </div>
        <div
          className="rsel-opts-grid"
          style={{
            gridTemplateColumns:
              availableOptions.length <= 2 ? "repeat(2, 1fr)" : undefined,
          }}
        >
          {availableOptions.map((opt) => (
            <OptionCard
              key={opt.id}
              opt={opt}
              allowanceCents={item.allowanceCents}
              isRecommended={opt.id === item.recommendedOptionId}
              selected={false}
              disabled={pending !== null}
              onClick={() => selectOption(opt.id)}
            />
          ))}
        </div>
        {error && <p className="rsel-err">Error: {error}</p>}

        {unavailableOptions.length > 0 && (
          <div className="rsel-unavail">
            {unavailableOptions.map((o) => (
              <div key={o.id} className="rsel-unavail-row">
                <div>
                  <div className="rsel-unavail-k">
                    Previous choice (unavailable)
                  </div>
                  <div className="rsel-unavail-name">{o.name}</div>
                  {o.unavailableReason && (
                    <div className="rsel-unavail-reason">
                      {o.unavailableReason}
                    </div>
                  )}
                </div>
                <Pill color="gray">Unavailable</Pill>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="rsel-rail">
        <div className="rsel-rc orange">
          <h3>Why this was reopened</h3>
          <p className="rsel-rc-body">
            The original option is no longer available from the supplier. To
            keep your project on schedule, your builder prepared alternatives
            that match the style and budget of your original choice.
          </p>
          <p className="rsel-rc-body" style={{ fontSize: 12, color: "var(--t3)", marginTop: 10 }}>
            If the original becomes available again before install, your team will let you know.
          </p>
        </div>
        <div className="rsel-rc">
          <h3>Impact summary</h3>
          <div className="rsel-rc-sub">What changes with the recommended replacement.</div>
          <div style={{ marginTop: 10 }}>
            <div className="rsel-imp">
              <div>
                <h5>Cost vs original</h5>
                <p>Recommended option matches original price</p>
              </div>
              <span className="rsel-imp-v" style={{ color: "var(--ok-t)" }}>No change</span>
            </div>
            <div className="rsel-imp">
              <div>
                <h5>Schedule vs original</h5>
                <p>No additional delay with recommended</p>
              </div>
              <span className="rsel-imp-v" style={{ color: "var(--ok-t)" }}>On track</span>
            </div>
            <div className="rsel-imp">
              <div>
                <h5>Style match</h5>
                <p>Similar pattern and color family</p>
              </div>
              <span className="rsel-imp-v">Close match</span>
            </div>
          </div>
        </div>
        <QuestionsCard />
      </aside>
    </div>
  );
}

function QuestionsCard() {
  return (
    <div className="rsel-rc">
      <h3>Questions?</h3>
      <div className="rsel-rc-sub">Ask your project team anything.</div>
      <div className="rsel-rc-body">
        <div className="rsel-comment-input">
          <input placeholder="Ask a question…" />
          <button type="button" className="rsel-comment-btn">Send</button>
        </div>
      </div>
    </div>
  );
}

const STYLES = `
.rsel{display:flex;flex-direction:column;gap:18px}

.rsel-state-nav{display:flex;gap:4px;margin-bottom:2px;background:var(--s2);border-radius:14px;padding:4px;width:fit-content}
.rsel-state-tab{height:34px;padding:0 16px;border-radius:10px;font-family:var(--fb);font-size:12px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all 150ms ease;background:none;border:none}
.rsel-state-tab:hover{color:var(--t1)}
.rsel-state-tab.active{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
.rsel-tab-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

.rsel-head{display:flex;flex-direction:column;gap:6px}
.rsel-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
.rsel-desc{font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t2);line-height:1.55;max-width:520px;margin:0}

.rsel-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.rsel-sc{background:var(--s1);border:1px solid var(--s3);border-radius:14px;padding:14px 16px;box-shadow:var(--shsm)}
.rsel-sc.teal{border-color:var(--ac-m);background:linear-gradient(180deg,var(--s1),var(--ac-s))}
.rsel-sc.orange{border-color:#f5d5a0;background:linear-gradient(180deg,var(--s1),var(--wr-s))}
.rsel-sc-label{font-family:var(--fb);font-size:12px;font-weight:560;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.rsel-sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
.rsel-sc-meta{font-family:var(--fb);font-size:12px;color:var(--t3);margin-top:2px;font-weight:520}
@media(max-width:1100px){.rsel-summary{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.rsel-summary{grid-template-columns:1fr}}

.rsel-cat{display:flex;flex-direction:column;gap:10px}
.rsel-cat-head{display:flex;align-items:center;gap:10px}
.rsel-cat-head h2{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);margin:0}
.rsel-cat-count{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);background:var(--s2);padding:2px 8px;border-radius:999px}
.rsel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}

.rsel-card{background:var(--s1);border:1px solid var(--s3);border-radius:18px;overflow:hidden;box-shadow:var(--shsm);cursor:pointer;transition:all .2s ease;text-align:left;padding:0;font-family:inherit;color:inherit;display:block;width:100%}
.rsel-card:hover{box-shadow:var(--shmd);border-color:var(--s4);transform:translateY(-1px)}
.rsel-card-visual{height:100px;padding:10px 14px;position:relative;display:flex;align-items:flex-end;overflow:hidden}
.rsel-card-visual::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.06) 100%)}
.rsel-card-sw-row{display:flex;gap:6px;position:relative;z-index:1}
.rsel-sw{width:38px;height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(0,0,0,.12);display:block}
.rsel-card-pill{position:absolute;top:10px;right:10px;z-index:1}
.rsel-card-body{padding:14px 16px 16px}
.rsel-card-body h3{font-family:var(--fd);font-size:15px;font-weight:700;color:var(--t1);letter-spacing:-.01em;margin:0}
.rsel-card-body p{font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t2);line-height:1.45;margin:4px 0 0}
.rsel-card-foot{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}

.rsel-detail{display:flex;flex-direction:column;gap:14px}
.rsel-detail-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
.rsel-back{display:inline-flex;align-items:center;gap:6px;background:none;border:none;font-family:var(--fb);font-size:13px;font-weight:580;color:var(--t3);cursor:pointer;padding:0;align-self:flex-start}
.rsel-back:hover{color:var(--ac-t)}
.rsel-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
@media(max-width:1100px){.rsel-layout{grid-template-columns:1fr}}
.rsel-main{min-width:0;display:flex;flex-direction:column;gap:14px}

.rsel-ih{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px 22px;box-shadow:var(--shsm)}
.rsel-ih-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.rsel-ih-title{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.02em;color:var(--t1);margin:0}
.rsel-ih-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;max-width:560px;margin:4px 0 0}
.rsel-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.rsel-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2)}
.rsel-chip strong{color:var(--t1);font-weight:680}
.rsel-chip svg{color:var(--t3)}

.rsel-opts-head{display:flex;justify-content:space-between;align-items:center}
.rsel-opts-head h3{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);margin:0}
.rsel-opts-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:900px){.rsel-opts-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.rsel-opts-grid{grid-template-columns:1fr!important}}

.rsel-opt{background:var(--s1);border:2px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shsm);cursor:pointer;transition:all .2s var(--e);padding:0;font-family:inherit;color:inherit;text-align:left;display:flex;flex-direction:column}
.rsel-opt:hover:not(:disabled){border-color:var(--s4);box-shadow:var(--shmd)}
.rsel-opt.recommended{border-color:var(--ac-m,var(--ac))}
.rsel-opt.selected{border-color:var(--ac);box-shadow:var(--shri),var(--shmd)}
.rsel-opt.disabled{cursor:default}
.rsel-opt-visual{height:140px;position:relative;display:flex;align-items:center;justify-content:center}
.rsel-opt-swatch{width:68px;height:68px;border-radius:14px;border:3px solid rgba(255,255,255,.85);box-shadow:0 6px 18px rgba(0,0,0,.15)}
.rsel-opt-tags{position:absolute;top:10px;left:10px;display:flex;gap:5px;flex-wrap:wrap}
.rsel-opt-tag{padding:3px 9px;border-radius:999px;font-family:var(--fd);font-size:10px;font-weight:750;letter-spacing:.02em;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.6);color:var(--t2)}
.rsel-opt-tag.rec{background:var(--ok-s);border-color:var(--ok-s);color:var(--ok-t)}
.rsel-opt-tag.inc{background:var(--ac-s);border-color:var(--ac-s);color:var(--ac-t)}
.rsel-opt-tag.upg{background:var(--wr-s);border-color:var(--wr-s);color:var(--wr-t)}
.rsel-opt-tag.prem{background:var(--in-s);border-color:var(--in-s);color:var(--in-t)}
.rsel-opt-check{position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.7);background:rgba(255,255,255,.5);display:grid;place-items:center}
.rsel-opt-check svg{color:transparent}
.rsel-opt.selected .rsel-opt-check{background:var(--ac);border-color:var(--ac)}
.rsel-opt.selected .rsel-opt-check svg{color:#fff}
.rsel-opt-body{padding:14px 16px 16px}
.rsel-opt-body h4{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);margin:0}
.rsel-opt-body p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.45;margin:4px 0 0}
.rsel-opt-price{margin-top:10px;display:flex;align-items:baseline;gap:6px}
.rsel-price{font-family:var(--fd);font-size:16px;font-weight:750}
.rsel-price.inc{color:var(--ac-t)}
.rsel-price.upg{color:var(--wr-t)}
.rsel-price-note{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3)}
.rsel-opt-timing{margin-top:6px;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);display:flex;align-items:center;gap:4px}
.rsel-opt-timing.warn{color:var(--wr-t)}

.rsel-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
.rsel-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px 18px;box-shadow:var(--shsm)}
.rsel-rc.teal{border-color:var(--ac-s);background:linear-gradient(180deg,var(--ac-s),var(--s1))}
.rsel-rc.orange{border-color:var(--wr-s);background:linear-gradient(180deg,var(--wr-s),var(--s1))}
.rsel-rc h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0}
.rsel-rc-sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin-top:2px}
.rsel-rc-body{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;margin:10px 0 0}
.rsel-rec-row{display:flex;gap:10px;align-items:center;margin-top:10px}
.rsel-rec-sw{width:36px;height:36px;border-radius:10px;border:1px solid var(--s3);flex-shrink:0}
.rsel-rec-name{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1)}
.rsel-rec-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

.rsel-imp{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
.rsel-imp:last-of-type{border-bottom:none}
.rsel-imp h5{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);margin:0}
.rsel-imp p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:1px 0 0}
.rsel-imp-v{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1);white-space:nowrap;flex-shrink:0}
.rsel-imp-acts{display:flex;flex-direction:column;gap:8px;margin-top:12px}

.rsel-compare{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shlg);padding:18px 20px}
.rsel-compare h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0 0 12px}
.rsel-cg{display:grid}
.rsel-cg-h{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3);padding:10px 12px;background:var(--s2);border-bottom:1px solid var(--s3)}
.rsel-cg-l{font-family:var(--fb);font-size:12px;font-weight:680;color:var(--t2);padding:12px;border-bottom:1px solid var(--s2);display:flex;align-items:center}
.rsel-cg-c{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);padding:12px;border-bottom:1px solid var(--s2);display:flex;align-items:center}

.rsel-locked{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px;display:flex;align-items:center;gap:10px}
.rsel-locked svg{color:var(--t2);flex-shrink:0}
.rsel-locked p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0}
.rsel-locked strong{color:var(--t1);font-weight:680}

.rsel-rev-banner{background:var(--wr-s);border:1px solid var(--wr-s);border-radius:var(--r-l);padding:14px 18px;display:flex;align-items:flex-start;gap:12px}
.rsel-rev-banner svg{color:var(--wr-t);flex-shrink:0}
.rsel-rev-banner h4{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--wr-t);margin:0}
.rsel-rev-banner p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:2px 0 0;line-height:1.5}

.rsel-post{background:var(--s1);border:1px solid var(--ac-s);border-radius:var(--r-xl);padding:18px 20px;box-shadow:var(--shsm)}
.rsel-post h3{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--ac-t);display:flex;align-items:center;gap:8px;margin:0 0 6px}
.rsel-post-step{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--s2)}
.rsel-post-step:last-of-type{border-bottom:none}
.rsel-post-dot{width:26px;height:26px;border-radius:50%;background:var(--ac-s);color:var(--ac-t);display:grid;place-items:center;flex-shrink:0;font-family:var(--fd);font-size:12px;font-weight:800}
.rsel-post-step h5{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);margin:0}
.rsel-post-step p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:2px 0 0;line-height:1.5}

.rsel-unavail{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px}
.rsel-unavail-row{display:flex;justify-content:space-between;align-items:center;gap:12px}
.rsel-unavail-k{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.rsel-unavail-name{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin-top:4px}
.rsel-unavail-reason{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

.rsel-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}

.rsel-file-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
.rsel-file-row:last-child{border-bottom:none}
.rsel-file-row h5{font-family:var(--fd);font-size:13px;font-weight:600;color:var(--t1);margin:0}
.rsel-file-row p{font-family:var(--fb);font-size:12px;font-weight:520;color:var(--t2);margin:1px 0 0}
.rsel-file-chip{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:6px;background:var(--s2);white-space:nowrap;flex-shrink:0}

.rsel-comment-input{display:flex;gap:8px;margin-top:4px}
.rsel-comment-input input{flex:1;height:36px;border-radius:10px;border:1px solid var(--s3);padding:0 12px;font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t1);outline:none;background:var(--s2)}
.rsel-comment-input input:focus{border-color:var(--ac);background:var(--s1)}
.rsel-comment-btn{height:36px;padding:0 14px;border-radius:10px;border:none;background:var(--ac);color:#fff;font-family:var(--fb);font-size:12px;font-weight:650;cursor:pointer;transition:background 120ms ease;white-space:nowrap}
.rsel-comment-btn:hover{background:var(--ac-h)}
`;
