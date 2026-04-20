"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  SubmittalDetail,
  SubmittalListRow,
} from "@/domain/loaders/submittals";
import {
  DIRECTION_LABEL,
  DOC_ROLE_LABEL,
  REVIEWER_RESPONSE_STATUSES,
  STATUS_LABEL,
  SUBMITTAL_TYPE_LABEL,
  formatSpecSection,
  isOverdue,
  type SubmittalDocumentRole,
  type SubmittalStatus,
  type SubmittalType,
} from "@/lib/submittals/config";

// Shared contractor + subcontractor submittals workspace. Role drives:
//  - accent color (contractor purple / sub warm orange)
//  - summary strip (6 cards for GC, 4 for sub)
//  - which actions render on the detail panel (GC has forward/reviewer/
//    close; sub has submit + start-revision)
//  - whether the "on behalf of" sub-org picker shows in the New drawer
//
// Shape mirrors the punch list workspace (Step 19). One big client
// component to keep state colocated; the slide-in detail panel is not
// a separate route so we avoid a refresh between list and detail.

type Role = "contractor" | "subcontractor";
type SubOrgOption = { id: string; name: string };

const STATUS_PILL: Record<
  SubmittalStatus,
  "gray" | "orange" | "accent" | "green" | "red" | "blue"
> = {
  draft: "gray",
  submitted: "blue",
  under_review: "orange",
  returned_approved: "green",
  returned_as_noted: "green",
  revise_resubmit: "orange",
  rejected: "red",
  closed: "gray",
};

const SUBMITTAL_TYPES: SubmittalType[] = [
  "product_data",
  "shop_drawing",
  "sample",
  "mock_up",
  "calculations",
  "schedule_of_values",
];

type StatusTab =
  | "all"
  | "draft"
  | "submitted"
  | "under_review"
  | "returned"
  | "closed";

const TAB_LABEL: Record<StatusTab, string> = {
  all: "All",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  returned: "Returned",
  closed: "Closed",
};

const I = {
  plus: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  send: (
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
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  check: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  file: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  upload: (
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
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
};

export function SubmittalsWorkspace({
  role,
  projectId,
  projectName,
  items,
  subOrgs,
}: {
  role: Role;
  projectId: string;
  projectName: string;
  items: SubmittalListRow[];
  subOrgs: SubOrgOption[];
}) {
  const router = useRouter();
  const accent = role === "contractor" ? "#5b4fc7" : "#d96d34";
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | SubmittalType>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<SubmittalDetail | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [forwardReviewerOpen, setForwardReviewerOpen] = useState(false);
  const [logResponseOpen, setLogResponseOpen] = useState(false);
  const [forwardSubOpen, setForwardSubOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState<SubmittalDocumentRole | null>(
    null,
  );

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((s) => {
      if (statusTab === "returned") {
        if (
          s.status !== "returned_approved" &&
          s.status !== "returned_as_noted" &&
          s.status !== "revise_resubmit" &&
          s.status !== "rejected"
        ) {
          return false;
        }
      } else if (statusTab !== "all" && s.status !== statusTab) {
        return false;
      }
      if (typeFilter !== "all" && s.submittalType !== typeFilter) return false;
      if (needle) {
        const hay = `${s.number} ${s.title} ${s.specSection}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, statusTab, typeFilter, search]);

  // Fetch detail whenever selection changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedId) {
        setDetail(null);
        return;
      }
      try {
        const res = await fetch(`/api/submittals/${selectedId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          setDetail(null);
          return;
        }
        const json = (await res.json()) as SubmittalDetail;
        if (!cancelled) setDetail(json);
      } catch {
        setDetail(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Summary counts.
  const counts = useMemo(() => {
    const draft = items.filter((s) => s.status === "draft").length;
    const submitted = items.filter((s) => s.status === "submitted").length;
    const underReview = items.filter((s) => s.status === "under_review").length;
    const returned = items.filter(
      (s) =>
        s.status === "returned_approved" ||
        s.status === "returned_as_noted" ||
        s.status === "revise_resubmit" ||
        s.status === "rejected",
    ).length;
    const overdue = items.filter((s) =>
      isOverdue({ status: s.status, dueDate: s.dueDate }),
    ).length;
    return {
      total: items.length,
      draft,
      submitted,
      underReview,
      returned,
      overdue,
    };
  }, [items]);

  const selected = items.find((s) => s.id === selectedId) ?? null;

  const refresh = useCallback(() => router.refresh(), [router]);

  return (
    <div
      style={{
        padding: "32px 40px 80px",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
          gap: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 26,
              fontWeight: 820,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Submittals
          </h1>
          <div
            style={{
              marginTop: 6,
              fontSize: 14,
              fontWeight: 520,
              color: "#64687a",
            }}
          >
            {projectName}
          </div>
        </div>
        {role === "contractor" || role === "subcontractor" ? (
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              padding: "0 18px",
              background: accent,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 650,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {I.plus} New submittal
          </button>
        ) : null}
      </header>

      {/* Summary strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            role === "contractor"
              ? "repeat(6, minmax(0, 1fr))"
              : "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <SummaryCard label="Total" value={counts.total} />
        <SummaryCard label="Draft" value={counts.draft} />
        <SummaryCard label="Submitted" value={counts.submitted} />
        {role === "contractor" ? (
          <>
            <SummaryCard label="Under review" value={counts.underReview} />
            <SummaryCard label="Returned" value={counts.returned} />
            <SummaryCard
              label="Overdue"
              value={counts.overdue}
              tone={counts.overdue > 0 ? "red" : "neutral"}
            />
          </>
        ) : (
          <SummaryCard label="Returned" value={counts.returned} />
        )}
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {(
          [
            "all",
            "draft",
            "submitted",
            "under_review",
            "returned",
            "closed",
          ] as StatusTab[]
        ).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setStatusTab(t)}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 620,
              border: "1px solid",
              borderColor: statusTab === t ? accent : "#dfe2eb",
              background: statusTab === t ? `${accent}12` : "#fff",
              color: statusTab === t ? accent : "#2b2f3d",
              cursor: "pointer",
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | SubmittalType)
          }
          style={{
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid #dfe2eb",
            background: "#fff",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 580,
            color: "#2b2f3d",
          }}
        >
          <option value="all">All types</option>
          {SUBMITTAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {SUBMITTAL_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, title, spec…"
          style={{
            flex: 1,
            minWidth: 200,
            height: 32,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid #dfe2eb",
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
            fontSize: 13,
            color: "#2b2f3d",
          }}
        />
      </div>

      {/* List + detail split */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selected ? "1fr 480px" : "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e6e9ef",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {visibleItems.length === 0 ? (
            <EmptyState
              label={
                items.length === 0
                  ? "No submittals yet"
                  : "No submittals match these filters"
              }
              hint={
                items.length === 0
                  ? role === "contractor"
                    ? "Click 'New submittal' to create one, or wait for a sub to submit."
                    : "Click 'New submittal' to upload your first package."
                  : "Try clearing filters or widening your search."
              }
            />
          ) : (
            <SubmittalTable
              rows={visibleItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
              accent={accent}
            />
          )}
        </div>

        {selected ? (
          <DetailPanel
            role={role}
            detail={detail}
            listRow={selected}
            accent={accent}
            onClose={() => setSelectedId(null)}
            onForwardReviewer={() => setForwardReviewerOpen(true)}
            onLogResponse={() => setLogResponseOpen(true)}
            onForwardSub={() => setForwardSubOpen(true)}
            onAttach={(role) => setAttachOpen(role)}
            onSubmitDraft={async () => {
              const res = await fetch(
                `/api/submittals/${selected.id}/transition`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ to: "submitted" }),
                },
              );
              if (!res.ok) {
                const j = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  message?: string;
                };
                // Most common: `missing_package` — submit requires at least
                // one document with role=package attached. Surface the
                // server message verbatim so the user knows what to fix.
                alert(
                  j.message ??
                    (j.error === "missing_package"
                      ? "Attach at least one package document before submitting."
                      : `Submit failed (${j.error ?? res.status})`),
                );
                return;
              }
              refresh();
            }}
            onStartRevision={async () => {
              // Clone metadata into a new draft; sub then uploads new
              // package + submits the draft.
              const res = await fetch(`/api/submittals`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  projectId,
                  specSection: selected.specSection,
                  title: selected.title,
                  submittalType: selected.submittalType,
                  submittedByOrgId: selected.submittedByOrgId,
                  revisionOfId: selected.id,
                  dueDate: selected.dueDate,
                }),
              });
              if (res.ok) {
                const json = (await res.json()) as { id: string };
                setSelectedId(json.id);
                refresh();
              }
            }}
          />
        ) : null}
      </div>

      {newOpen ? (
        <NewSubmittalModal
          role={role}
          projectId={projectId}
          subOrgs={subOrgs}
          accent={accent}
          onClose={() => setNewOpen(false)}
          onCreated={(newId) => {
            setNewOpen(false);
            setSelectedId(newId);
            refresh();
          }}
        />
      ) : null}

      {forwardReviewerOpen && selected ? (
        <ForwardReviewerModal
          projectId={projectId}
          submittalId={selected.id}
          accent={accent}
          defaultReviewer={{
            name: selected.reviewerName ?? "",
            org: selected.reviewerOrg ?? "",
            email: selected.reviewerEmail ?? "",
          }}
          onClose={() => setForwardReviewerOpen(false)}
          onDone={() => {
            setForwardReviewerOpen(false);
            refresh();
          }}
        />
      ) : null}

      {logResponseOpen && selected ? (
        <LogResponseModal
          projectId={projectId}
          submittalId={selected.id}
          accent={accent}
          onClose={() => setLogResponseOpen(false)}
          onDone={() => {
            setLogResponseOpen(false);
            refresh();
          }}
        />
      ) : null}

      {forwardSubOpen && selected ? (
        <ForwardSubModal
          submittalId={selected.id}
          accent={accent}
          onClose={() => setForwardSubOpen(false)}
          onDone={() => {
            setForwardSubOpen(false);
            refresh();
          }}
        />
      ) : null}

      {attachOpen && selected ? (
        <AttachDocumentModal
          projectId={projectId}
          submittalId={selected.id}
          role={attachOpen}
          accent={accent}
          onClose={() => setAttachOpen(null)}
          onDone={() => {
            setAttachOpen(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "red";
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e6e9ef",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 26,
          fontWeight: 820,
          letterSpacing: "-0.02em",
          color: tone === "red" && value > 0 ? "#c14c4c" : "#12141b",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          fontWeight: 580,
          color: "#64687a",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ padding: "64px 24px", textAlign: "center" }}>
      <div
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontWeight: 680,
          fontSize: 16,
          color: "#2b2f3d",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#64687a" }}>{hint}</div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "gray" | "blue" | "orange" | "green" | "red" | "accent";
  children: React.ReactNode;
}) {
  const TONE: Record<
    typeof tone,
    { bg: string; fg: string; border: string }
  > = {
    gray: { bg: "#f1f2f6", fg: "#4a4f60", border: "#dfe2eb" },
    blue: { bg: "#e7eefb", fg: "#2a5aa3", border: "#c8d8f0" },
    orange: { bg: "#fcefdc", fg: "#9a5711", border: "#efd1a3" },
    green: { bg: "#e0f2e6", fg: "#2f7d48", border: "#bfdec7" },
    red: { bg: "#fce5e1", fg: "#a93930", border: "#f1bbb3" },
    accent: { bg: "#ece9fa", fg: "#4a40ab", border: "#d6d0f1" },
  };
  const c = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 10px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function SubmittalTable({
  rows,
  selectedId,
  onSelect,
  accent,
}: {
  rows: SubmittalListRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  accent: string;
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "90px 120px 1fr 140px 140px 110px 110px",
          padding: "10px 16px",
          borderBottom: "1px solid #e6e9ef",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#64687a",
        }}
      >
        <div>Number</div>
        <div>Spec</div>
        <div>Title</div>
        <div>Type</div>
        <div>Status</div>
        <div>Submitted</div>
        <div>Due</div>
      </div>
      {rows.map((row) => {
        const selected = row.id === selectedId;
        const due = row.dueDate ?? "—";
        const sub = row.submittedAt
          ? new Date(row.submittedAt).toISOString().slice(0, 10)
          : "—";
        const overdue = isOverdue({ status: row.status, dueDate: row.dueDate });
        return (
          <button
            type="button"
            key={row.id}
            onClick={() => onSelect(row.id)}
            style={{
              display: "grid",
              gridTemplateColumns:
                "90px 120px 1fr 140px 140px 110px 110px",
              width: "100%",
              padding: "12px 16px",
              borderBottom: "1px solid #f1f2f6",
              background: selected ? `${accent}10` : "#fff",
              border: "none",
              textAlign: "left",
              cursor: "pointer",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 620,
                color: "#2b2f3d",
              }}
            >
              {row.number}
              {row.revisionOfNumber ? (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    color: "#64687a",
                  }}
                >
                  rev of {row.revisionOfNumber}
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: "#4a4f60",
              }}
            >
              {formatSpecSection(row.specSection)}
            </div>
            <div
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 13,
                fontWeight: 620,
                color: "#12141b",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: 8,
              }}
            >
              {row.title}
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  fontWeight: 520,
                  color: "#64687a",
                  fontFamily: "'Instrument Sans', system-ui, sans-serif",
                }}
              >
                {row.submittedByOrgName ?? "—"}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#4a4f60" }}>
              {SUBMITTAL_TYPE_LABEL[row.submittalType]}
            </div>
            <div>
              <Pill tone={STATUS_PILL[row.status]}>
                {STATUS_LABEL[row.status]}
              </Pill>
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#64687a",
              }}
            >
              {sub}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: overdue ? "#c14c4c" : "#64687a",
                fontWeight: overdue ? 620 : 500,
              }}
            >
              {due}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DetailPanel({
  role,
  detail,
  listRow,
  accent,
  onClose,
  onForwardReviewer,
  onLogResponse,
  onForwardSub,
  onAttach,
  onSubmitDraft,
  onStartRevision,
}: {
  role: Role;
  detail: SubmittalDetail | null;
  listRow: SubmittalListRow;
  accent: string;
  onClose: () => void;
  onForwardReviewer: () => void;
  onLogResponse: () => void;
  onForwardSub: () => void;
  onAttach: (r: SubmittalDocumentRole) => void;
  onSubmitDraft: () => void | Promise<void>;
  onStartRevision: () => void | Promise<void>;
}) {
  const row = detail ?? listRow;
  const isContractor = role === "contractor";
  const packageDocCount =
    detail?.documents.filter((d) => d.role === "package").length ?? 0;
  const canSubmitDraft =
    row.status === "draft" && (role === "subcontractor" || isContractor);
  // Draft can't submit without at least one package document. Server
  // enforces the same rule; the disabled state here just avoids a round
  // trip + preserves flow for the sub.
  const submitDraftBlocked = canSubmitDraft && packageDocCount === 0;
  const canRevise =
    row.status === "revise_resubmit" &&
    (role === "subcontractor" || isContractor);

  return (
    <aside
      style={{
        position: "sticky",
        top: 24,
        background: "#fff",
        border: "1px solid #e6e9ef",
        borderRadius: 12,
        maxHeight: "calc(100vh - 80px)",
        overflowY: "auto",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "18px 20px 14px",
          borderBottom: "1px solid #eef0f4",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 620,
                color: "#4a4f60",
              }}
            >
              {row.number}
            </span>
            <Pill tone={STATUS_PILL[row.status]}>{STATUS_LABEL[row.status]}</Pill>
          </div>
          <h2
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 740,
              margin: 0,
              color: "#12141b",
            }}
          >
            {row.title}
          </h2>
          <div
            style={{
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#64687a",
            }}
          >
            {formatSpecSection(row.specSection)} ·{" "}
            {SUBMITTAL_TYPE_LABEL[row.submittalType]}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "#64687a",
            padding: 4,
          }}
        >
          {I.x}
        </button>
      </header>

      <div style={{ padding: "16px 20px" }}>
        <MetaGrid
          rows={[
            ["Submitted by", row.submittedByOrgName ?? "—"],
            ["Reviewer", row.reviewerName || "Not assigned"],
            ["Reviewer org", row.reviewerOrg || "—"],
            ["Due", row.dueDate ?? "—"],
            ["Age", `${row.ageDays}d`],
          ]}
        />
        {row.rejectionReason ? (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              background: "#fce5e1",
              border: "1px solid #f1bbb3",
              borderRadius: 8,
              fontSize: 13,
              color: "#a93930",
            }}
          >
            <strong>Rejection reason:</strong> {row.rejectionReason}
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div
        style={{
          padding: "0 20px 16px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {canSubmitDraft ? (
          <PrimaryBtn
            onClick={onSubmitDraft}
            accent={accent}
            disabled={submitDraftBlocked}
            tooltip={
              submitDraftBlocked
                ? "Attach at least one package document first"
                : undefined
            }
          >
            {I.send} Submit
          </PrimaryBtn>
        ) : null}
        {isContractor && row.status === "submitted" ? (
          <PrimaryBtn onClick={onForwardReviewer} accent={accent}>
            {I.send} Forward to reviewer
          </PrimaryBtn>
        ) : null}
        {isContractor && row.status === "under_review" ? (
          <PrimaryBtn onClick={onLogResponse} accent={accent}>
            {I.check} Log reviewer response
          </PrimaryBtn>
        ) : null}
        {isContractor &&
        (row.status === "returned_approved" ||
          row.status === "returned_as_noted" ||
          row.status === "revise_resubmit" ||
          row.status === "rejected") ? (
          <PrimaryBtn onClick={onForwardSub} accent={accent}>
            {I.send} Forward to sub &amp; close
          </PrimaryBtn>
        ) : null}
        {canRevise ? (
          <SecondaryBtn onClick={onStartRevision}>Start revision</SecondaryBtn>
        ) : null}
      </div>

      {/* Documents */}
      <Section title="Documents">
        <DocumentsGroup
          role="package"
          docs={detail?.documents ?? []}
          onAttach={() => onAttach("package")}
          canAttach={
            (role === "subcontractor" && row.status === "draft") || isContractor
          }
        />
        <DocumentsGroup
          role="reviewer_comments"
          docs={detail?.documents ?? []}
          onAttach={() => onAttach("reviewer_comments")}
          canAttach={isContractor}
        />
        <DocumentsGroup
          role="stamp_page"
          docs={detail?.documents ?? []}
          onAttach={() => onAttach("stamp_page")}
          canAttach={isContractor}
        />
      </Section>

      {/* Transmittal log */}
      <Section title="Transmittal log">
        {detail?.transmittals.length ? (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {detail.transmittals.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #f1f2f6",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <Pill
                    tone={
                      t.direction === "outgoing_to_reviewer"
                        ? "blue"
                        : t.direction === "incoming_from_reviewer"
                          ? "green"
                          : "accent"
                    }
                  >
                    {DIRECTION_LABEL[t.direction]}
                  </Pill>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      color: "#64687a",
                    }}
                  >
                    {new Date(t.transmittedAt).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: "#4a4f60",
                    fontWeight: 520,
                  }}
                >
                  by {t.transmittedByName ?? "Unknown"}
                </div>
                {t.notes ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "#12141b",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {t.notes}
                  </div>
                ) : null}
                {t.documentUrl && t.documentTitle ? (
                  <a
                    href={t.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      marginTop: 6,
                      fontSize: 12,
                      color: accent,
                      textDecoration: "none",
                      fontWeight: 620,
                    }}
                  >
                    {I.file} {t.documentTitle}
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div style={{ fontSize: 12, color: "#64687a" }}>
            No transmittals yet.
          </div>
        )}
      </Section>
    </aside>
  );
}

function MetaGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: 16,
        rowGap: 8,
        margin: 0,
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 620,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#64687a",
            }}
          >
            {k}
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 520,
              color: "#12141b",
            }}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        padding: "16px 20px",
        borderTop: "1px solid #eef0f4",
      }}
    >
      <h3
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#64687a",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function DocumentsGroup({
  role,
  docs,
  onAttach,
  canAttach,
}: {
  role: SubmittalDocumentRole;
  docs: Array<{
    id: string;
    role: SubmittalDocumentRole;
    title: string;
    url: string;
  }>;
  onAttach: () => void;
  canAttach: boolean;
}) {
  const filtered = docs.filter((d) => d.role === role);
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 620,
            color: "#4a4f60",
          }}
        >
          {DOC_ROLE_LABEL[role]}
          {filtered.length > 0 ? (
            <span
              style={{
                marginLeft: 6,
                fontWeight: 520,
                color: "#8a8f9e",
              }}
            >
              ({filtered.length})
            </span>
          ) : null}
        </span>
        {canAttach ? (
          <button
            type="button"
            onClick={onAttach}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 24,
              padding: "0 10px",
              background: "#fff",
              border: "1px solid #dfe2eb",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 620,
              color: "#4a4f60",
            }}
          >
            {I.upload} Upload
          </button>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: "#8a8f9e" }}>—</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
          }}
        >
          {filtered.map((d) => (
            <DocumentThumbnail key={d.id} title={d.title} url={d.url} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentThumbnail({ title, url }: { title: string; url: string }) {
  const isImg = isImageFileName(title);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        border: "1px solid #e6e9ef",
        borderRadius: 8,
        overflow: "hidden",
        textDecoration: "none",
        background: "#fff",
      }}
    >
      <div
        style={{
          aspectRatio: "4 / 3",
          background: "#f4f6fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {isImg ? (
          // Presigned URL; <img> is enough. Next.js <Image> would need
          // loader config for R2 presigned hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: "#64687a",
              letterSpacing: "0.04em",
            }}
          >
            {extensionOf(title)}
          </div>
        )}
      </div>
      <div
        style={{
          padding: "6px 8px",
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
          fontSize: 11,
          color: "#2b2f3d",
          fontWeight: 520,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </div>
    </a>
  );
}

function extensionOf(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : "FILE";
}

function PrimaryBtn({
  onClick,
  accent,
  children,
  disabled = false,
  tooltip,
}: {
  onClick: () => void | Promise<void>;
  accent: string;
  children: React.ReactNode;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 34,
        padding: "0 14px",
        background: disabled ? "#c3c8d4" : accent,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontWeight: 650,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({
  onClick,
  children,
}: {
  onClick: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 34,
        padding: "0 14px",
        background: "#fff",
        color: "#2b2f3d",
        border: "1px solid #dfe2eb",
        borderRadius: 8,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontWeight: 620,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20, 22, 30, 0.5)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: 520,
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 20px",
            borderBottom: "1px solid #eef0f4",
          }}
        >
          <h2
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontWeight: 740,
              fontSize: 16,
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64687a",
            }}
          >
            {I.x}
          </button>
        </header>
        <div style={{ padding: "18px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div
        style={{
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 620,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#64687a",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  padding: "0 12px",
  border: "1px solid #dfe2eb",
  borderRadius: 8,
  fontFamily: "'Instrument Sans', system-ui, sans-serif",
  fontSize: 13,
  color: "#12141b",
  boxSizing: "border-box",
};

function NewSubmittalModal({
  role,
  projectId,
  subOrgs,
  accent,
  onClose,
  onCreated,
}: {
  role: Role;
  projectId: string;
  subOrgs: SubOrgOption[];
  accent: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [specSection, setSpecSection] = useState("");
  const [title, setTitle] = useState("");
  const [submittalType, setSubmittalType] =
    useState<SubmittalType>("product_data");
  const [dueDate, setDueDate] = useState("");
  const [submittedByOrgId, setSubmittedByOrgId] = useState(
    subOrgs[0]?.id ?? "",
  );
  // Shop-drawing submittals can run 10+ PDFs. Default to multi-file.
  const [packageFiles, setPackageFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !specSection.trim()) {
      setErr("Title and spec section are required");
      return;
    }
    if (role === "contractor" && !submittedByOrgId) {
      setErr("Choose the submitting sub org");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        projectId,
        specSection: specSection.trim(),
        title: title.trim(),
        submittalType,
      };
      // Contractors submit on behalf of a sub (required). Subs omit this
      // field and the API infers from ctx.organization.id.
      if (role === "contractor" && submittedByOrgId)
        body.submittedByOrgId = submittedByOrgId;
      if (dueDate) body.dueDate = dueDate;
      const res = await fetch("/api/submittals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setErr((j?.message as string) || "Could not create submittal");
        setBusy(false);
        return;
      }
      const json = (await res.json()) as { id: string };

      // Upload + attach package docs in parallel. Each upload is its
      // own presign + PUT + finalize + attach chain; failures are
      // surfaced but don't unwind the created draft (the sub can retry
      // the attach step from the detail panel).
      if (packageFiles.length > 0) {
        const results = await Promise.all(
          packageFiles.map(async (f) => {
            const docId = await uploadToProject({ projectId, file: f });
            if (!docId) return false;
            const attach = await fetch(`/api/submittal-documents`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                submittalId: json.id,
                documentId: docId,
                role: "package",
              }),
            });
            return attach.ok;
          }),
        );
        const failed = results.filter((r) => !r).length;
        if (failed > 0) {
          setErr(
            `${failed}/${packageFiles.length} files failed to upload. Open the draft to retry.`,
          );
          // Continue — draft still exists, user can see it + retry.
        }
      }

      onCreated(json.id);
    } catch {
      setErr("Network error");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="New submittal" onClose={onClose}>
      {role === "contractor" && subOrgs.length > 0 ? (
        <Field label="Submitting sub org">
          <select
            value={submittedByOrgId}
            onChange={(e) => setSubmittedByOrgId(e.target.value)}
            style={inputStyle}
          >
            {subOrgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {/* Sub mode: no org picker. API defaults submittedByOrgId to
          ctx.organization.id so subs just fill in the metadata. */}
      <Field label="Spec section (e.g. 033000 or 03 30 00)">
        <input
          type="text"
          value={specSection}
          onChange={(e) => setSpecSection(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Type">
        <select
          value={submittalType}
          onChange={(e) => setSubmittalType(e.target.value as SubmittalType)}
          style={inputStyle}
        >
          {SUBMITTAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {SUBMITTAL_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Due date (optional)">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Package documents">
        <FileDropzone
          files={packageFiles}
          onChange={setPackageFiles}
          multiple
          accent={accent}
          accept="application/pdf,image/*"
          hint="PDFs + images · at least one required before you can submit"
        />
      </Field>
      {err ? (
        <div
          style={{
            fontSize: 12,
            color: "#a93930",
            padding: "8px 10px",
            background: "#fce5e1",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={submit} accent={accent}>
          {busy ? "Creating…" : "Create draft"}
        </PrimaryBtn>
      </div>
    </ModalShell>
  );
}

function ForwardReviewerModal({
  projectId,
  submittalId,
  accent,
  defaultReviewer,
  onClose,
  onDone,
}: {
  projectId: string;
  submittalId: string;
  accent: string;
  defaultReviewer: { name: string; org: string; email: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(defaultReviewer.name);
  const [org, setOrg] = useState(defaultReviewer.org);
  const [email, setEmail] = useState(defaultReviewer.email);
  const [notes, setNotes] = useState("");
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    expiresAt: string;
  } | null>(null);

  // Primary flow (Step 20.5): send an invitation link so the reviewer
  // can stamp directly via the portal.
  const sendInvitation = async () => {
    if (!name.trim()) {
      setErr("Reviewer name is required");
      return;
    }
    if (!email.trim()) {
      setErr("Reviewer email is required to send an invitation");
      return;
    }
    const days = parseInt(expiresInDays, 10);
    if (!Number.isFinite(days) || days < 1 || days > 180) {
      setErr("Expiry must be between 1 and 180 days");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // Upload cover doc first (so the invite includes the id).
      let coverDocumentId: string | null = null;
      const cover = coverFiles[0];
      if (cover) {
        coverDocumentId = await uploadToProject({ projectId, file: cover });
      }
      const res = await fetch(
        `/api/submittals/${submittalId}/invite-reviewer`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reviewerName: name.trim(),
            reviewerOrg: org.trim() || null,
            reviewerEmail: email.trim(),
            expiresInDays: days,
            coverNotes: notes.trim() || null,
            coverDocumentId,
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setErr((j?.message as string) || "Could not send invitation");
        setBusy(false);
        return;
      }
      const json = (await res.json()) as {
        inviteUrl: string;
        expiresAt: string;
      };
      setInviteResult(json);
      setBusy(false);
    } catch {
      setErr("Something went wrong");
      setBusy(false);
    }
  };

  // Escape hatch flow (Step 20): record the reviewer as contact-only.
  // No invitation, no portal link — the GC will log the response
  // themselves via the "Log reviewer response" modal when the email
  // arrives.
  const recordContactOnly = async () => {
    if (!name.trim()) {
      setErr("Reviewer name is required");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await fetch(`/api/submittals/${submittalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewerName: name.trim(),
          reviewerOrg: org.trim() || null,
          reviewerEmail: email.trim() || null,
        }),
      });
      let documentId: string | null = null;
      const cover = coverFiles[0];
      if (cover) {
        documentId = await uploadToProject({ projectId, file: cover });
      }
      await fetch(`/api/submittals/${submittalId}/transmittals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          direction: "outgoing_to_reviewer",
          documentId,
          notes: notes.trim() || null,
        }),
      });
      const transRes = await fetch(
        `/api/submittals/${submittalId}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: "under_review" }),
        },
      );
      if (!transRes.ok) {
        const j = (await transRes.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setErr(j.message ?? j.error ?? "Transition failed");
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setErr("Something went wrong");
      setBusy(false);
    }
  };

  // Post-send success state: show the invite URL so the GC can copy
  // and forward manually if the reviewer didn't get the email.
  if (inviteResult) {
    return (
      <ModalShell title="Invitation sent" onClose={onDone}>
        <p
          style={{
            fontSize: 13,
            color: "#4a4f60",
            marginTop: 0,
            marginBottom: 14,
          }}
        >
          We notified {name} at {email}. The link below is their direct
          review portal — copy it if you want to forward it yourself.
        </p>
        <div
          style={{
            padding: "10px 12px",
            background: "#f4f6fa",
            border: "1px solid #e6e9ef",
            borderRadius: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#12141b",
            wordBreak: "break-all",
            marginBottom: 10,
          }}
        >
          {inviteResult.inviteUrl}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#64687a",
            marginBottom: 14,
          }}
        >
          Expires {new Date(inviteResult.expiresAt).toLocaleDateString()}.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <SecondaryBtn
            onClick={() =>
              navigator.clipboard.writeText(inviteResult.inviteUrl)
            }
          >
            Copy link
          </SecondaryBtn>
          <PrimaryBtn onClick={onDone} accent={accent}>
            Done
          </PrimaryBtn>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Forward to reviewer" onClose={onClose}>
      <Field label="Reviewer name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Reviewer firm">
        <input
          type="text"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          placeholder="Architect / engineer firm"
          style={inputStyle}
        />
      </Field>
      <Field label="Reviewer email">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Cover letter / notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{
            ...inputStyle,
            height: 90,
            padding: 10,
            resize: "vertical",
          }}
        />
      </Field>
      <Field label="Cover sheet document (optional)">
        <FileDropzone
          files={coverFiles}
          onChange={setCoverFiles}
          accent={accent}
          accept="application/pdf,image/*"
        />
      </Field>
      <Field label="Link expires after (days)">
        <input
          type="number"
          value={expiresInDays}
          min={1}
          max={180}
          onChange={(e) => setExpiresInDays(e.target.value)}
          style={{ ...inputStyle, width: 120 }}
        />
      </Field>
      {err ? (
        <div
          style={{
            fontSize: 12,
            color: "#a93930",
            padding: "8px 10px",
            background: "#fce5e1",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
        }}
      >
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={sendInvitation} accent={accent}>
          {busy ? "Sending…" : "Send invitation link"}
        </PrimaryBtn>
      </div>
      <button
        type="button"
        onClick={recordContactOnly}
        disabled={busy}
        style={{
          display: "block",
          marginTop: 12,
          marginLeft: "auto",
          background: "transparent",
          border: "none",
          color: "#64687a",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 580,
          cursor: busy ? "not-allowed" : "pointer",
          textDecoration: "underline",
          textDecorationColor: "#c3c8d4",
          textUnderlineOffset: 3,
        }}
      >
        Record contact only (no portal)
      </button>
    </ModalShell>
  );
}

function LogResponseModal({
  projectId,
  submittalId,
  accent,
  onClose,
  onDone,
}: {
  projectId: string;
  submittalId: string;
  accent: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [responseStatus, setResponseStatus] =
    useState<SubmittalStatus>("returned_approved");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  const [stampFiles, setStampFiles] = useState<File[]>([]);
  const [commentsFiles, setCommentsFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (responseStatus === "rejected" && !rejectionReason.trim()) {
      setErr("Reason is required when rejecting");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let stampDocId: string | null = null;
      const stampFile = stampFiles[0];
      if (stampFile) {
        stampDocId = await uploadToProject({ projectId, file: stampFile });
        if (stampDocId) {
          await fetch(`/api/submittal-documents`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              submittalId,
              documentId: stampDocId,
              role: "stamp_page",
            }),
          });
        }
      }
      const commentsFile = commentsFiles[0];
      if (commentsFile) {
        const commentsDocId = await uploadToProject({
          projectId,
          file: commentsFile,
        });
        if (commentsDocId) {
          await fetch(`/api/submittal-documents`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              submittalId,
              documentId: commentsDocId,
              role: "reviewer_comments",
            }),
          });
        }
      }
      // Log incoming transmittal.
      await fetch(`/api/submittals/${submittalId}/transmittals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          direction: "incoming_from_reviewer",
          documentId: stampDocId,
          notes: notes.trim() || null,
        }),
      });
      // Transition to the chosen returned_* status.
      const transitionBody: Record<string, unknown> = { to: responseStatus };
      if (responseStatus === "rejected")
        transitionBody.rejectionReason = rejectionReason.trim();
      const transRes = await fetch(
        `/api/submittals/${submittalId}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(transitionBody),
        },
      );
      if (!transRes.ok) {
        const j = (await transRes.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setErr(j.message ?? j.error ?? "Transition failed");
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setErr("Something went wrong");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Log reviewer response" onClose={onClose}>
      <Field label="Response">
        <select
          value={responseStatus}
          onChange={(e) => setResponseStatus(e.target.value as SubmittalStatus)}
          style={inputStyle}
        >
          {REVIEWER_RESPONSE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      {responseStatus === "rejected" ? (
        <Field label="Rejection reason">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            style={{
              ...inputStyle,
              height: 72,
              padding: 10,
              resize: "vertical",
            }}
          />
        </Field>
      ) : null}
      <Field label="Reviewer notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{
            ...inputStyle,
            height: 72,
            padding: 10,
            resize: "vertical",
          }}
        />
      </Field>
      <Field label="Stamp page (optional)">
        <FileDropzone
          files={stampFiles}
          onChange={setStampFiles}
          accent={accent}
          accept="application/pdf,image/*"
        />
      </Field>
      <Field label="Reviewer comments doc (optional)">
        <FileDropzone
          files={commentsFiles}
          onChange={setCommentsFiles}
          accent={accent}
          accept="application/pdf,image/*"
        />
      </Field>
      {err ? (
        <div
          style={{
            fontSize: 12,
            color: "#a93930",
            padding: "8px 10px",
            background: "#fce5e1",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={submit} accent={accent}>
          {busy ? "Saving…" : "Record response"}
        </PrimaryBtn>
      </div>
    </ModalShell>
  );
}

function ForwardSubModal({
  submittalId,
  accent,
  onClose,
  onDone,
}: {
  submittalId: string;
  accent: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await fetch(`/api/submittals/${submittalId}/transmittals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          direction: "forwarded_to_sub",
          notes: notes.trim() || null,
        }),
      });
      const transRes = await fetch(
        `/api/submittals/${submittalId}/transition`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: "closed" }),
        },
      );
      if (!transRes.ok) {
        const j = (await transRes.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        alert(j.message ?? j.error ?? "Transition failed");
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setBusy(false);
    }
  };
  return (
    <ModalShell title="Forward to sub &amp; close" onClose={onClose}>
      <p
        style={{
          fontSize: 13,
          color: "#4a4f60",
          marginTop: 0,
          marginBottom: 14,
        }}
      >
        Record the forward to the sub and close this submittal. The sub will
        be notified.
      </p>
      <Field label="Notes for the sub (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{
            ...inputStyle,
            height: 72,
            padding: 10,
            resize: "vertical",
          }}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={submit} accent={accent}>
          {busy ? "Closing…" : "Forward & close"}
        </PrimaryBtn>
      </div>
    </ModalShell>
  );
}

function AttachDocumentModal({
  projectId,
  submittalId,
  role,
  accent,
  onClose,
  onDone,
}: {
  projectId: string;
  submittalId: string;
  role: SubmittalDocumentRole;
  accent: string;
  onClose: () => void;
  onDone: () => void;
}) {
  // Package allows multi; stamp/comments are single-file by nature.
  const multiple = role === "package";
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (files.length === 0) {
      setErr("Pick at least one file");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const results = await Promise.all(
        files.map(async (f) => {
          const docId = await uploadToProject({ projectId, file: f });
          if (!docId) return false;
          const res = await fetch(`/api/submittal-documents`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ submittalId, documentId: docId, role }),
          });
          return res.ok;
        }),
      );
      const failed = results.filter((r) => !r).length;
      if (failed > 0) {
        setErr(`${failed}/${files.length} files failed`);
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setErr("Upload failed");
      setBusy(false);
    }
  };
  return (
    <ModalShell
      title={`Upload ${DOC_ROLE_LABEL[role].toLowerCase()}`}
      onClose={onClose}
    >
      <Field label={multiple ? "Files" : "File"}>
        <FileDropzone
          files={files}
          onChange={setFiles}
          multiple={multiple}
          accent={accent}
          accept="application/pdf,image/*"
        />
      </Field>
      {err ? (
        <div
          style={{
            fontSize: 12,
            color: "#a93930",
            padding: "8px 10px",
            background: "#fce5e1",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
        <PrimaryBtn onClick={submit} accent={accent}>
          {busy ? "Uploading…" : "Upload"}
        </PrimaryBtn>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────
// FileDropzone — styled file input that doubles as a drop target.
//
// Reused across every upload surface in the module. Single-file or
// multi-file modes. Drag + drop events are handled at the wrapper
// level; the underlying <input type=file> is visually hidden but
// still accessible for keyboard + screen-reader users. The dotted
// border makes the click target obvious — the native "Choose file /
// No file chosen" control was the bug Step 20 shipped with.
// ─────────────────────────────────────────────────────────────────

function FileDropzone({
  files,
  onChange,
  multiple = false,
  accent,
  accept,
  hint,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accent: string;
  accept?: string;
  hint?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const id = useMemo(
    () => `dz-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const handleFiles = (picked: FileList | null) => {
    if (!picked) return;
    const arr = Array.from(picked);
    if (multiple) {
      // De-dup by (name, size) — common when someone drops the same
      // file twice.
      const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
      const merged = [...files];
      for (const f of arr) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      onChange(merged);
    } else {
      onChange(arr.slice(0, 1));
    }
  };

  const removeAt = (idx: number) => {
    const next = files.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "22px 16px",
          border: `1.5px dashed ${dragOver ? accent : "#c3c8d4"}`,
          borderRadius: 10,
          background: dragOver ? `${accent}0d` : "#fafbfd",
          cursor: "pointer",
          textAlign: "center",
          transition: "all 0.12s ease",
        }}
      >
        <div style={{ color: accent, marginBottom: 6 }}>{I.upload}</div>
        <div
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 620,
            color: "#2b2f3d",
          }}
        >
          {multiple ? "Drop files here or click to choose" : "Drop a file here or click to choose"}
        </div>
        {hint ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "#64687a",
              fontWeight: 520,
            }}
          >
            {hint}
          </div>
        ) : null}
        <input
          id={id}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={(e) => handleFiles(e.target.files)}
          // Visually hidden; the label is the clickable surface.
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        />
      </label>
      {files.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "10px 0 0",
          }}
        >
          {files.map((f, i) => (
            <li
              key={`${f.name}:${f.size}:${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "#fff",
                border: "1px solid #e6e9ef",
                borderRadius: 8,
                marginTop: i === 0 ? 0 : 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <span style={{ color: "#64687a", flexShrink: 0 }}>
                  {I.file}
                </span>
                <span
                  style={{
                    fontFamily: "'Instrument Sans', system-ui, sans-serif",
                    fontSize: 12,
                    color: "#2b2f3d",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: "#8a8f9e",
                    flexShrink: 0,
                  }}
                >
                  {Math.round(f.size / 1024)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64687a",
                  cursor: "pointer",
                  padding: 4,
                }}
                aria-label={`Remove ${f.name}`}
              >
                {I.x}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function isImageFileName(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif)$/i.test(name);
}

// ─────────────────────────────────────────────────────────────────
// Upload helper — hits the existing /api/upload/request + PUT + finalize flow.
// ─────────────────────────────────────────────────────────────────

async function uploadToProject(input: {
  projectId: string;
  file: File;
}): Promise<string | null> {
  const req = await fetch(`/api/upload/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      filename: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      documentType: "submittal",
    }),
  });
  if (!req.ok) return null;
  const { uploadUrl, storageKey } = (await req.json()) as {
    uploadUrl: string;
    storageKey: string;
  };
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: input.file,
    headers: { "content-type": input.file.type || "application/octet-stream" },
  });
  if (!put.ok) return null;
  const fin = await fetch(`/api/upload/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      storageKey,
      title: input.file.name,
      documentType: "submittal",
    }),
  });
  if (!fin.ok) return null;
  const json = (await fin.json()) as { documentId: string };
  return json.documentId;
}
