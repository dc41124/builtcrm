"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  PunchItemCommentRow,
  PunchItemDetailFull,
  PunchItemListRow,
  PunchItemPhotoRow,
  PunchItemPriority,
} from "@/domain/loaders/punch-list";
import type { PunchStatus } from "@/lib/punch-list/config";

// Shared contractor + subcontractor workspace. Renders the same list
// + detail split panel from builtcrm_punch_list_workflow_paired.jsx.
// Role prop drives:
//  - accent color (contractor purple / sub warm orange)
//  - summary strip layout (6 cards vs 4)
//  - available status tabs (contractor has Verified; both have Rejected)
//  - which state transitions show as action buttons
//  - whether the New Item button renders (contractor only)
//  - page copy

type Role = "contractor" | "subcontractor";
type SubOrgOption = { id: string; name: string };
type StatusTab = "all" | "open" | "in_progress" | "ready_to_verify" | "rejected" | "verified";

const STATUS_LABELS: Record<PunchStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  ready_to_verify: "Ready to Verify",
  verified: "Verified",
  rejected: "Rejected",
  void: "Void",
};
const STATUS_PILL: Record<PunchStatus, "gray" | "orange" | "accent" | "green" | "red"> = {
  open: "gray",
  in_progress: "orange",
  ready_to_verify: "accent",
  verified: "green",
  rejected: "red",
  void: "gray",
};
const PRIORITY_LABELS: Record<PunchItemPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
const PRIORITY_PILL: Record<
  PunchItemPriority,
  "gray" | "orange" | "red"
> = {
  low: "gray",
  normal: "gray",
  high: "orange",
  urgent: "red",
};

const I = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  camera: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  send: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  check: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
};

export function PunchListWorkspace({
  role,
  projectId,
  projectName,
  items,
  subOrgs,
}: {
  role: Role;
  projectId: string;
  projectName: string;
  items: PunchItemListRow[];
  subOrgs: SubOrgOption[];
}) {
  const router = useRouter();
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [newOpen, setNewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  // Filter items by status tab. Void items are hidden from "all".
  const visibleItems = useMemo(() => {
    if (statusTab === "all") return items.filter((it) => it.status !== "void");
    return items.filter((it) => it.status === statusTab);
  }, [items, statusTab]);

  const selected = items.find((it) => it.id === selectedId) ?? visibleItems[0] ?? null;

  const counts = useMemo(
    () => ({
      total: items.filter((it) => it.status !== "void").length,
      open: items.filter((it) => it.status === "open").length,
      inProgress: items.filter((it) => it.status === "in_progress").length,
      readyToVerify: items.filter((it) => it.status === "ready_to_verify").length,
      verified: items.filter((it) => it.status === "verified").length,
      rejected: items.filter((it) => it.status === "rejected").length,
      overdue: items.filter(
        (it) =>
          ["open", "in_progress", "rejected"].includes(it.status) &&
          it.dueDate &&
          new Date(it.dueDate + "T23:59:59Z").getTime() < Date.now(),
      ).length,
    }),
    [items],
  );

  const getActions = (
    it: PunchItemListRow | null,
  ): { to: PunchStatus; label: string; kind: "" | "pri" | "ok" | "dg-o" }[] => {
    if (!it) return [];
    if (role === "contractor") {
      switch (it.status) {
        case "open":
          return [
            { to: "in_progress", label: "Mark In Progress", kind: "" },
            { to: "void", label: "Void…", kind: "dg-o" },
          ];
        case "in_progress":
          return [
            { to: "ready_to_verify", label: "Mark Ready to Verify", kind: "pri" },
            { to: "void", label: "Void…", kind: "dg-o" },
          ];
        case "ready_to_verify":
          return [
            { to: "verified", label: "Verify & close", kind: "ok" },
            { to: "rejected", label: "Reject…", kind: "dg-o" },
            { to: "void", label: "Void…", kind: "" },
          ];
        case "rejected":
          return [
            { to: "in_progress", label: "Reopen (In Progress)", kind: "pri" },
            { to: "void", label: "Void…", kind: "dg-o" },
          ];
        default:
          return [];
      }
    }
    // subcontractor
    switch (it.status) {
      case "open":
        return [{ to: "in_progress", label: "Mark In Progress", kind: "pri" }];
      case "in_progress":
        return [{ to: "ready_to_verify", label: "Mark Ready to Verify", kind: "pri" }];
      case "rejected":
        return [{ to: "in_progress", label: "Reopen (In Progress)", kind: "pri" }];
      default:
        return [];
    }
  };

  const statusTabs: [StatusTab, string][] = role === "contractor"
    ? [
        ["all", "All"],
        ["open", "Open"],
        ["in_progress", "In Progress"],
        ["ready_to_verify", "Ready to Verify"],
        ["rejected", "Rejected"],
        ["verified", "Verified"],
      ]
    : [
        ["all", "All"],
        ["open", "Open"],
        ["in_progress", "In Progress"],
        ["ready_to_verify", "Ready to Verify"],
        ["rejected", "Rejected"],
      ];

  const doTransition = async (
    itemId: string,
    to: PunchStatus,
    extras: { rejectionReason?: string; voidReason?: string } = {},
  ) => {
    const res = await fetch(`/api/punch-items/${itemId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, ...extras }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      alert(data.message ?? "Transition failed");
      return;
    }
    router.refresh();
  };

  return (
    <div className={`pl-app ${role}`}>
      <style>{CSS}</style>

      <div className="pl-page-h">
        <div>
          <h1>{role === "contractor" ? "Punch List" : "My Punch List"}</h1>
          <p>
            {role === "contractor"
              ? `Track and verify final completion items for ${projectName}. Create items, assign to subs, and close them out as work is inspected.`
              : "Items assigned to your org. Mark in progress when you start and ready-to-verify when complete. The GC closes out or sends back with notes."}
          </p>
        </div>
        {role === "contractor" && (
          <div className="pl-acts">
            <button className="btn pri" onClick={() => setNewOpen(true)}>
              {I.plus} New item
            </button>
          </div>
        )}
      </div>

      {/* Summary strip */}
      {role === "contractor" ? (
        <div className="ss">
          <SummaryCard label="Total" value={counts.total} meta="Active items" />
          <SummaryCard label="Open" value={counts.open} meta="Not started" />
          <SummaryCard label="In Progress" value={counts.inProgress} meta="Work underway" tone="alert" />
          <SummaryCard label="Ready to Verify" value={counts.readyToVerify} meta="Needs your check" tone="strong" />
          <SummaryCard label="Verified" value={counts.verified} meta="Closed out" />
          <SummaryCard label="Overdue" value={counts.overdue} meta="Past due date" tone="danger" />
        </div>
      ) : (
        <div className="ss sub">
          <SummaryCard label="Assigned to me" value={counts.total} meta="Active items" />
          <SummaryCard label="Open" value={counts.open} meta="Not started" />
          <SummaryCard label="In Progress" value={counts.inProgress} meta="Working on it" tone="alert" />
          <SummaryCard label="Rejected" value={counts.rejected} meta="Needs rework" tone="danger" />
        </div>
      )}

      {/* Workspace card */}
      <div className="ws">
        <div className="ws-head">
          <div>
            <h3>{role === "contractor" ? "Item workspace" : "My work"}</h3>
            <div className="sub">
              {role === "contractor"
                ? "Full lifecycle from creation through verification."
                : "Items where you're the assigned trade."}
            </div>
          </div>
        </div>

        <div className="ws-tabs">
          {statusTabs.map(([k, label]) => {
            const count =
              k === "all"
                ? items.filter((it) => it.status !== "void").length
                : items.filter((it) => it.status === k).length;
            return (
              <button
                key={k}
                className={`wtab${statusTab === k ? " on" : ""}`}
                onClick={() => setStatusTab(k)}
              >
                {label}
                <span className="c">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="md">
          <div>
            <div className="tl">
              {visibleItems.length === 0 && (
                <div className="tl-empty">No items in this view.</div>
              )}
              {visibleItems.map((it) => {
                const overdue =
                  ["open", "in_progress", "rejected"].includes(it.status) &&
                  it.dueDate &&
                  new Date(it.dueDate + "T23:59:59Z").getTime() < Date.now();
                const assigneeInitials = (it.assigneeOrgName ?? "")
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();
                return (
                  <div
                    key={it.id}
                    className={`cc${selected?.id === it.id ? " on" : ""}${overdue ? " overdue" : ""}`}
                    onClick={() => setSelectedId(it.id)}
                  >
                    <div className="cc-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cc-id">
                          {`PI-${String(it.sequentialNumber).padStart(3, "0")}`}
                        </div>
                        <div className="cc-title">{it.title}</div>
                      </div>
                      <Pill kind={STATUS_PILL[it.status]}>
                        {STATUS_LABELS[it.status]}
                      </Pill>
                    </div>
                    {it.location && (
                      <div className="cc-loc">
                        {I.pin}
                        <span>{it.location}</span>
                      </div>
                    )}
                    <div className="cc-meta">
                      <Pill kind={PRIORITY_PILL[it.priority]}>
                        {PRIORITY_LABELS[it.priority]}
                      </Pill>
                      {it.dueDate && (
                        <Pill kind="gray">Due {formatShort(it.dueDate)}</Pill>
                      )}
                      {overdue && <Pill kind="red">Overdue</Pill>}
                    </div>
                    <div className="cc-foot">
                      <div className="cc-asg">
                        <div className="cc-ini">
                          {assigneeInitials || "—"}
                        </div>
                        <span>{it.assigneeOrgName ?? "Unassigned"}</span>
                      </div>
                      <span>{it.ageDays}d old</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail pane */}
          <div className="dp">
            {!selected ? (
              <div className="tl-empty">Select an item to view details.</div>
            ) : (
              <DetailPanel
                key={selected.id}
                role={role}
                item={selected}
                projectId={projectId}
                subOrgs={subOrgs}
                onTransition={doTransition}
                onOpenReject={() => setRejectOpen(true)}
                onOpenVoid={() => setVoidOpen(true)}
                getActions={getActions}
              />
            )}
          </div>
        </div>
      </div>

      {newOpen && role === "contractor" && (
        <NewItemDrawer
          projectId={projectId}
          subOrgs={subOrgs}
          onClose={() => setNewOpen(false)}
          onCreated={(newId) => {
            setNewOpen(false);
            setSelectedId(newId);
            router.refresh();
          }}
        />
      )}

      {rejectOpen && selected && (
        <ReasonModal
          title="Reject — send back for rework"
          blurb="Explain what still needs to be addressed. This reason will be shown to the assignee and logged on the thread."
          confirmLabel="Reject"
          onCancel={() => setRejectOpen(false)}
          onConfirm={async (reason) => {
            await doTransition(selected.id, "rejected", { rejectionReason: reason });
            setRejectOpen(false);
          }}
        />
      )}

      {voidOpen && selected && (
        <ReasonModal
          title="Void this item"
          blurb="Voiding removes the item from the active list but preserves the record for audit. Use for duplicates, mistakes, or items no longer applicable."
          confirmLabel="Void item"
          onCancel={() => setVoidOpen(false)}
          onConfirm={async (reason) => {
            await doTransition(selected.id, "void", { voidReason: reason });
            setVoidOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Pill({
  kind,
  children,
}: {
  kind: "gray" | "orange" | "accent" | "green" | "red";
  children: React.ReactNode;
}) {
  return <span className={`pl ${kind}`}>{children}</span>;
}

function SummaryCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: number;
  meta: string;
  tone?: "alert" | "danger" | "strong";
}) {
  return (
    <div className={`sc${tone ? ` ${tone}` : ""}`}>
      <div className="sc-label">{label}</div>
      <div className="sc-value">{value}</div>
      <div className="sc-meta">{meta}</div>
    </div>
  );
}

function DetailPanel({
  role,
  item,
  projectId: pageProjectId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subOrgs: _subOrgs,
  onTransition,
  onOpenReject,
  onOpenVoid,
  getActions,
}: {
  role: Role;
  item: PunchItemListRow;
  projectId: string;
  subOrgs: SubOrgOption[];
  onTransition: (
    itemId: string,
    to: PunchStatus,
    extras?: { rejectionReason?: string; voidReason?: string },
  ) => Promise<void>;
  onOpenReject: () => void;
  onOpenVoid: () => void;
  getActions: (
    it: PunchItemListRow | null,
  ) => { to: PunchStatus; label: string; kind: "" | "pri" | "ok" | "dg-o" }[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<PunchItemDetailFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [lightbox, setLightbox] = useState<PunchItemPhotoRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    (async () => {
      try {
        const res = await fetch(`/api/punch-items/${item.id}`);
        if (!res.ok) return;
        const data = (await res.json()) as PunchItemDetailFull;
        if (!cancelled) setDetail(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const postComment = async () => {
    if (!commentDraft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/punch-items/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentDraft }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        alert(data.message ?? "Failed to post comment");
        return;
      }
      setCommentDraft("");
      router.refresh();
    } finally {
      setPosting(false);
    }
  };

  const actions = getActions(item);
  const photos = detail?.photos ?? [];
  const comments = detail?.comments ?? [];

  return (
    <>
      <div className="dh">
        <div>
          <div className="dh-id">
            {`PI-${String(item.sequentialNumber).padStart(3, "0")}`}
          </div>
          <h3>{item.title}</h3>
          <div className="dh-desc">{item.description}</div>
        </div>
        <div className="dh-pills">
          <Pill kind={STATUS_PILL[item.status]}>{STATUS_LABELS[item.status]}</Pill>
          <Pill kind={PRIORITY_PILL[item.priority]}>
            {PRIORITY_LABELS[item.priority]}
          </Pill>
        </div>
      </div>

      <div className="dg">
        <div className="dg-i">
          <div className="k">Priority</div>
          <div className="v">{PRIORITY_LABELS[item.priority]}</div>
          <div className="m">
            {item.priority === "urgent" ? "Needs immediate attention" : "Standard"}
          </div>
        </div>
        <div className="dg-i">
          <div className="k">Assignee</div>
          <div className="v">{item.assigneeOrgName ?? "Unassigned"}</div>
          <div className="m">{item.assigneeUserName ?? "Crew lead"}</div>
        </div>
        <div className="dg-i">
          <div className="k">Due</div>
          <div className="v">{item.dueDate ? formatShort(item.dueDate) : "—"}</div>
          <div className="m">
            {item.dueDate &&
            ["open", "in_progress", "rejected"].includes(item.status) &&
            new Date(item.dueDate + "T23:59:59Z").getTime() < Date.now()
              ? "Overdue"
              : `${item.ageDays}d old`}
          </div>
        </div>
        <div className="dg-i">
          <div className="k">Created by</div>
          <div className="v">{item.createdByName ?? "—"}</div>
          <div className="m">{formatShort(item.createdAt)}</div>
        </div>
      </div>

      {item.status === "rejected" && item.rejectionReason && (
        <div className="rej-bnr">
          <div>
            <div className="k">Rejected — requires rework</div>
            <div className="v">{item.rejectionReason}</div>
          </div>
        </div>
      )}

      {item.status === "void" && item.voidReason && (
        <div className="rej-bnr void">
          <div>
            <div className="k">Voided</div>
            <div className="v">{item.voidReason}</div>
          </div>
        </div>
      )}

      {item.location && (
        <div className="ds">
          <div className="ds-h">
            <h4>Location</h4>
          </div>
          <div className="ds-b">
            <div className="loc-chip">
              {I.pin}
              <span>{item.location}</span>
            </div>
          </div>
        </div>
      )}

      <div className="ds">
        <div className="ds-h">
          <h4>Photos ({photos.length})</h4>
          <div className="ds-acts">
            {(role === "contractor" ||
              (role === "subcontractor" &&
                item.status !== "verified" &&
                item.status !== "void")) && (
              <button className="btn sm" onClick={() => setPhotoOpen(true)}>
                {I.camera} Add photos
              </button>
            )}
          </div>
        </div>
        <div className="ds-b">
          {loading && photos.length === 0 ? (
            <p className="muted">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="muted">No photos attached yet.</p>
          ) : (
            <div className="gal">
              {photos.map((p) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  onOpen={() => setLightbox(p)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ds">
        <div className="ds-h">
          <h4>Discussion ({comments.filter((c) => !c.isSystem).length})</h4>
        </div>
        <div className="ds-b">
          <div className="cmt-th">
            {loading && comments.length === 0 ? (
              <p className="muted">Loading thread…</p>
            ) : comments.length === 0 ? (
              <p className="muted">No comments yet.</p>
            ) : (
              comments.map((c) => <CommentRow key={c.id} comment={c} />)
            )}
          </div>
          {item.status !== "verified" && item.status !== "void" && (
            <div className="cmt-input">
              <input
                placeholder="Add a comment…"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    postComment();
                  }
                }}
              />
              <button
                className="btn pri"
                onClick={postComment}
                disabled={posting || !commentDraft.trim()}
              >
                {I.send} Post
              </button>
            </div>
          )}
        </div>
      </div>

      {role === "contractor" && (
        <div className="ds">
          <div className="ds-h">
            <h4>Client-facing note</h4>
          </div>
          <div className="ds-b">
            <ClientFacingNoteEditor
              itemId={item.id}
              initial={item.clientFacingNote ?? ""}
            />
          </div>
        </div>
      )}

      {actions.length === 0 ? (
        <div className="tx-empty">
          {item.status === "verified" && "Item verified and closed. No further actions."}
          {item.status === "void" && "Item voided. No further actions."}
          {item.status === "ready_to_verify" &&
            role === "subcontractor" &&
            "Waiting on the contractor to verify."}
        </div>
      ) : (
        <div className="tx-bar">
          {actions.map((a) => (
            <button
              key={a.to}
              className={`btn ${a.kind}`}
              onClick={() => {
                if (a.to === "rejected") onOpenReject();
                else if (a.to === "void") onOpenVoid();
                else onTransition(item.id, a.to);
              }}
            >
              {a.to === "verified" && I.check}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {photoOpen && (
        <PhotoAttachDrawer
          itemId={item.id}
          projectId={pageProjectId}
          onClose={() => setPhotoOpen(false)}
          onAttached={() => {
            setPhotoOpen(false);
            router.refresh();
          }}
        />
      )}

      {lightbox && (
        <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

function CommentRow({ comment }: { comment: PunchItemCommentRow }) {
  const initials = comment.isSystem
    ? "·"
    : comment.authorName
      ? comment.authorName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
      : "?";
  return (
    <div className={`cmt${comment.isSystem ? " sys" : ""}`}>
      <div className="cmt-av">{initials}</div>
      <div className="cmt-body">
        <div className="cmt-head">
          <span className="cmt-name">
            {comment.isSystem ? "System" : comment.authorName ?? "—"}
          </span>
          <span className="cmt-ts">{formatAbs(comment.createdAt)}</span>
        </div>
        <div className="cmt-text">{comment.body}</div>
      </div>
    </div>
  );
}

function PhotoTile({
  photo,
  onOpen,
}: {
  photo: PunchItemPhotoRow;
  onOpen: () => void;
}) {
  const clickable = !!photo.url;
  return (
    <div
      className={`ph${clickable ? " clickable" : ""}`}
      onClick={() => clickable && onOpen()}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt={photo.caption ?? photo.title} className="ph-img" loading="lazy" />
      ) : (
        <div className="phbg" style={{ background: "var(--s2)" }} />
      )}
      {photo.caption && <div className="ph-cap">{photo.caption}</div>}
    </div>
  );
}

// Simple full-screen photo viewer. Click overlay, press Escape, or
// click the close button to dismiss. No zoom / pan / multi-photo
// carousel — those are Phase 6 polish.
function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: PunchItemPhotoRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="lb-ov"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        className="lb-close"
        onClick={onClose}
        aria-label="Close photo"
      >
        {I.x}
      </button>
      <div className="lb-body" onClick={(e) => e.stopPropagation()}>
        {photo.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.caption ?? photo.title}
            className="lb-img"
          />
        )}
        {photo.caption && <div className="lb-cap">{photo.caption}</div>}
      </div>
    </div>
  );
}

function ClientFacingNoteEditor({
  itemId,
  initial,
}: {
  itemId: string;
  initial: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = value !== initial;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/punch-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientFacingNote: value || null }),
      });
      if (!res.ok) {
        alert("Failed to save note");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="muted" style={{ marginBottom: 8 }}>
        Shown on the homeowner&apos;s Walkthrough Items page when the project
        reaches closeout. Leave blank to hide.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="e.g., Re-coated yesterday. 24 hours to fully cure."
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button
          className="btn pri sm"
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}

function NewItemDrawer({
  projectId,
  subOrgs,
  onClose,
  onCreated,
}: {
  projectId: string;
  subOrgs: SubOrgOption[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<PunchItemPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeOrgId, setAssigneeOrgId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/punch-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim(),
          location: location.trim() || null,
          priority,
          assigneeOrgId: assigneeOrgId || null,
          dueDate: dueDate || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? "Create failed");
        return;
      }
      const data = (await res.json()) as { id: string };
      onCreated(data.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-ov" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-h">
          <h3>New punch list item</h3>
          <button className="btn ghost" onClick={onClose}>{I.x}</button>
        </div>
        <div className="drawer-b">
          <div className="field">
            <label>Title</label>
            <input
              placeholder="e.g., Paint runs on east lobby wall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              placeholder="What needs to be addressed and how…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              placeholder="e.g., Floor 2 — corridor 2B, door frame upper-left"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as PunchItemPriority)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="field">
              <label>Due date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Assign to</label>
            <select
              value={assigneeOrgId}
              onChange={(e) => setAssigneeOrgId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {subOrgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          {error && <div className="drawer-err">{error}</div>}
        </div>
        <div className="drawer-f">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : (<>{I.plus} Create item</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReasonModal({
  title,
  blurb,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  blurb: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="modal-ov" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{title}</h3>
          <p>{blurb}</p>
        </div>
        <div className="modal-b">
          <div className="field">
            <label>Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn dg-o"
            disabled={!reason.trim() || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onConfirm(reason.trim());
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoAttachDrawer({
  itemId,
  projectId,
  onClose,
  onAttached,
}: {
  itemId: string;
  projectId: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  type Staged = {
    id: string;
    file: File;
    previewUrl: string;
    caption: string;
    status: "staged" | "uploading" | "linking" | "done" | "error";
    error?: string;
  };
  const [staged, setStaged] = useState<Staged[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: Staged[] = [];
    for (const file of Array.from(files)) {
      next.push({
        id: cryptoRandom(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        status: "staged",
      });
    }
    setStaged((p) => [...p, ...next]);
  };

  const remove = (id: string) =>
    setStaged((p) => {
      const hit = p.find((s) => s.id === id);
      if (hit) URL.revokeObjectURL(hit.previewUrl);
      return p.filter((s) => s.id !== id);
    });

  const uploadAll = async () => {
    setSubmitting(true);
    for (const s of staged) {
      if (s.status === "done") continue;
      try {
        setStaged((p) => p.map((x) => (x.id === s.id ? { ...x, status: "uploading" } : x)));
        const reqRes = await fetch("/api/upload/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            filename: s.file.name,
            contentType: s.file.type || "application/octet-stream",
            documentType: "punch_item_photo",
          }),
        });
        if (!reqRes.ok) throw new Error("Presign failed");
        const { uploadUrl, storageKey } = (await reqRes.json()) as {
          uploadUrl: string;
          storageKey: string;
        };
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": s.file.type || "application/octet-stream" },
          body: s.file,
        });
        if (!putRes.ok) throw new Error("Upload failed");
        const finRes = await fetch("/api/upload/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            storageKey,
            title: s.file.name,
            documentType: "punch_item_photo",
            visibilityScope: "project_wide",
            audienceScope: "internal",
          }),
        });
        if (!finRes.ok) throw new Error("Finalize failed");
        const { documentId } = (await finRes.json()) as { documentId: string };
        setStaged((p) => p.map((x) => (x.id === s.id ? { ...x, status: "linking" } : x)));
        const linkRes = await fetch("/api/punch-item-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            punchItemId: itemId,
            documentId,
            caption: s.caption || null,
          }),
        });
        if (!linkRes.ok) throw new Error("Link failed");
        setStaged((p) => p.map((x) => (x.id === s.id ? { ...x, status: "done" } : x)));
      } catch (err) {
        setStaged((p) =>
          p.map((x) =>
            x.id === s.id
              ? {
                  ...x,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : x,
          ),
        );
      }
    }
    setSubmitting(false);
    if (staged.every((s) => s.status === "done" || s.status === "staged") && staged.length > 0) {
      onAttached();
    }
  };

  return (
    <div className="drawer-ov" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-h">
          <h3>Attach photos</h3>
          <button className="btn ghost" onClick={onClose}>{I.x}</button>
        </div>
        <div className="drawer-b">
          <label className="ph-picker">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              disabled={submitting}
              style={{ display: "none" }}
            />
            <span>
              <span className="ph-picker-plus">{I.plus}</span>
              <span>Click to pick photos</span>
            </span>
          </label>
          {staged.length > 0 && (
            <div className="ph-list">
              {staged.map((s) => (
                <div key={s.id} className="ph-row">
                  <div className="ph-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.previewUrl} alt={s.file.name} />
                  </div>
                  <div className="ph-fields">
                    <input
                      placeholder="Caption (optional)"
                      value={s.caption}
                      onChange={(e) =>
                        setStaged((p) =>
                          p.map((x) =>
                            x.id === s.id ? { ...x, caption: e.target.value } : x,
                          ),
                        )
                      }
                      disabled={submitting}
                    />
                    <div className="ph-row-foot">
                      <span className={`ph-status ${s.status}`}>
                        {s.status === "staged"
                          ? "Ready"
                          : s.status === "uploading"
                            ? "Uploading…"
                            : s.status === "linking"
                              ? "Linking…"
                              : s.status === "done"
                                ? "✓ Done"
                                : s.error ?? "Failed"}
                      </span>
                      {s.status !== "done" && (
                        <button
                          className="btn ghost sm"
                          onClick={() => remove(s.id)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="drawer-f">
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button
            className="btn pri"
            onClick={uploadAll}
            disabled={submitting || staged.length === 0}
          >
            {submitting ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

function cryptoRandom(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function formatShort(iso: string): string {
  return new Date(iso.length > 10 ? iso : iso + "T12:00:00Z").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: "UTC" },
  );
}

function formatAbs(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// CSS — adapted from builtcrm_punch_list_workflow_paired.jsx. Root
// class `pl-app.contractor` uses purple accent; `pl-app.subcontractor`
// overrides to warm orange per the paired spec.
const CSS = `
.pl-app{
  --s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --fd:'DM Sans',system-ui,sans-serif;--fb:'Instrument Sans',system-ui,sans-serif;--fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shri:0 0 0 3px rgba(91,79,199,.15);
  font-family:var(--fb);color:var(--t1);line-height:1.5;font-size:14px;padding:24px;
}
.pl-app *{box-sizing:border-box}
.pl-app.subcontractor{--ac:#c17a1a;--ac-h:#a6680f;--ac-s:#fdf4e6;--ac-t:#96600f;--ac-m:#e8c896;--shri:0 0 0 3px rgba(193,122,26,.18)}

.pl-page-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px}
.pl-page-h h1{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;margin:0}
.pl-page-h p{margin-top:6px;font-size:13px;color:var(--t2);max-width:560px;line-height:1.5}
.pl-acts{display:flex;gap:8px;padding-top:4px}

.ss{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px}
.ss.sub{grid-template-columns:repeat(4,1fr)}
.sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.sc.alert{border-color:#f5d5a0}.sc.danger{border-color:#f5baba}.sc.strong{border-color:var(--ac-m)}
.sc-label{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

.btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);cursor:pointer;white-space:nowrap;font-family:var(--fb)}
.btn:hover{border-color:var(--s4);background:var(--sh)}
.btn.pri{background:var(--ac);border-color:var(--ac);color:white}.btn.pri:hover{background:var(--ac-h)}
.btn.ok{background:var(--ok);border-color:var(--ok);color:white}.btn.ok:hover{filter:brightness(.92)}
.btn.dg-o{border-color:#f5baba;color:var(--dg-t)}.btn.dg-o:hover{background:var(--dg-s)}
.btn.sm{height:32px;padding:0 12px;font-size:12px}
.btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}.btn.ghost:hover{background:var(--s2)}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.btn svg{width:14px;height:14px;flex-shrink:0}

.pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:720;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.pl.gray{background:var(--s2);color:var(--t3)}

.ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.ws-head h3{font-family:var(--fd);font-size:15px;font-weight:720;margin:0}
.ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}
.ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
.wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer}
.wtab:hover{border-color:var(--s4);color:var(--t1)}
.wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.wtab .c{margin-left:6px;font-family:var(--fm);font-size:11px;color:var(--t3)}
.wtab.on .c{color:var(--ac-t)}

.md{display:grid;grid-template-columns:360px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
@media(max-width:1200px){.md{grid-template-columns:1fr}.ss{grid-template-columns:repeat(3,1fr)}.ss.sub{grid-template-columns:repeat(2,1fr)}}

.tl{display:flex;flex-direction:column;gap:6px;max-height:720px;overflow-y:auto;padding-right:4px}
.tl-empty{padding:24px;text-align:center;font-size:13px;color:var(--t3)}
.cc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all 200ms cubic-bezier(.16,1,.3,1)}
.cc:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.cc.on{border-color:var(--ac-m);background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:var(--shri)}
.cc.overdue{border-left:3px solid var(--dg)}
.cc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.cc-id{font-family:var(--fm);font-size:11px;color:var(--t3)}
.cc-title{font-family:var(--fd);font-size:13px;font-weight:720;margin-top:2px;line-height:1.35}
.cc-loc{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--t3);margin-top:6px}
.cc-loc svg{color:var(--t3);flex-shrink:0}
.cc-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
.cc-foot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--t3);padding-top:8px;border-top:1px solid var(--s2)}
.cc-asg{display:flex;align-items:center;gap:5px}
.cc-ini{width:18px;height:18px;border-radius:50%;background:var(--s2);color:var(--t2);display:grid;place-items:center;font-family:var(--fd);font-size:9.5px;font-weight:720}

.dp{min-height:400px}
.dh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
.dh h3{font-family:var(--fd);font-size:18px;font-weight:740;letter-spacing:-.02em;line-height:1.25;margin:0}
.dh-id{font-family:var(--fm);font-size:12px;color:var(--t3);margin-top:2px}
.dh-desc{font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;max-width:560px}
.dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px}

.dg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.dg-i{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
.dg-i .k{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.dg-i .v{font-family:var(--fd);font-size:14px;font-weight:720;margin-top:3px}
.dg-i .m{font-size:11.5px;color:var(--t2);margin-top:2px}

.rej-bnr{margin-top:12px;padding:12px 14px;border:1.5px solid #f5baba;border-radius:var(--r-m);background:var(--dg-s);display:flex;gap:10px}
.rej-bnr.void{border-color:var(--s3);background:var(--s2)}
.rej-bnr .k{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--dg-t);margin-bottom:4px}
.rej-bnr.void .k{color:var(--t3)}
.rej-bnr .v{font-size:13px;color:var(--t1);line-height:1.5}

.ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
.ds-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
.ds-h h4{font-family:var(--fd);font-size:13px;font-weight:720;margin:0}
.ds-acts{display:flex;gap:6px}
.ds-b{padding:14px 16px}
.ds-b .muted{font-size:13px;color:var(--t3);font-style:italic;margin:0}
.ds-b textarea,.ds-b input{width:100%;border:1px solid var(--s3);border-radius:var(--r-m);padding:8px 12px;font-family:var(--fb);font-size:13px;background:var(--s1);color:var(--t1);outline:none;resize:vertical}
.ds-b textarea:focus,.ds-b input:focus{border-color:var(--ac);box-shadow:var(--shri)}

.loc-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);font-size:12.5px;color:var(--t2)}

.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.ph{aspect-ratio:4/3;border-radius:var(--r-m);overflow:hidden;position:relative;border:1px solid var(--s3);background:var(--s2)}
.ph.clickable{cursor:zoom-in;transition:transform 120ms cubic-bezier(.16,1,.3,1)}
.ph.clickable:hover{transform:scale(1.02);border-color:var(--ac-m)}
.ph-img{width:100%;height:100%;object-fit:cover;display:block}
.phbg{position:absolute;inset:0}
.ph-cap{position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.6));color:white;font-size:11px;font-weight:620}

/* Lightbox — dark overlay, image scaled to fit viewport */
.lb-ov{position:fixed;inset:0;background:rgba(12,10,8,.88);z-index:1000;display:flex;align-items:center;justify-content:center;padding:40px;cursor:zoom-out;animation:lb-fade 160ms cubic-bezier(.16,1,.3,1)}
.lb-close{position:absolute;top:20px;right:20px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.12);color:white;border:none;display:grid;place-items:center;cursor:pointer;transition:background 120ms}
.lb-close:hover{background:rgba(255,255,255,.2)}
.lb-close svg{width:20px;height:20px}
.lb-body{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:100%;max-height:100%;cursor:default}
.lb-img{max-width:min(92vw,1400px);max-height:calc(100vh - 120px);object-fit:contain;border-radius:var(--r-m);box-shadow:0 16px 48px rgba(0,0,0,.5)}
.lb-cap{color:white;font-size:14px;font-weight:560;max-width:80ch;text-align:center;line-height:1.5}
@keyframes lb-fade{from{opacity:0}to{opacity:1}}

.cmt-th{display:flex;flex-direction:column;gap:10px}
.cmt{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--s2)}
.cmt:last-child{border-bottom:none}
.cmt-av{width:28px;height:28px;border-radius:50%;background:var(--ac);color:white;display:grid;place-items:center;font-family:var(--fd);font-size:10.5px;font-weight:720;flex-shrink:0}
.cmt.sys .cmt-av{background:var(--s3);color:var(--t3)}
.cmt-body{flex:1;min-width:0}
.cmt-head{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.cmt-name{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1)}
.cmt-ts{font-size:11px;color:var(--t3);margin-left:auto}
.cmt-text{font-size:13px;color:var(--t1);line-height:1.5}
.cmt.sys .cmt-text{font-size:12.5px;color:var(--t2);font-style:italic}
.cmt-input{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--s2)}
.cmt-input input{flex:1;height:38px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:13px;background:var(--s1);color:var(--t1);outline:none}
.cmt-input input:focus{border-color:var(--ac);box-shadow:var(--shri)}

.tx-bar{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:14px;border-top:1.5px solid var(--s3)}
.tx-empty{padding:14px;background:var(--s2);border-radius:var(--r-m);font-size:12.5px;color:var(--t3);text-align:center;margin-top:18px;font-style:italic}

/* Drawers + modals */
.drawer-ov{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100;display:flex;justify-content:flex-end}
.drawer{width:520px;max-width:100vw;height:100vh;background:var(--s1);display:flex;flex-direction:column;animation:slideIn 280ms cubic-bezier(.16,1,.3,1);overflow:hidden}
.drawer-h{padding:18px 22px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center}
.drawer-h h3{font-family:var(--fd);font-size:17px;font-weight:740;margin:0}
.drawer-b{flex:1;overflow-y:auto;padding:18px 22px}
.drawer-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px;background:var(--s2)}
.drawer-err{background:var(--dg-s);color:var(--dg-t);padding:8px 12px;border-radius:var(--r-m);font-size:12.5px;margin-top:12px}
.field{margin-bottom:14px}
.field label{display:block;font-family:var(--fd);font-size:12px;font-weight:720;color:var(--t2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.field input,.field select,.field textarea{width:100%;height:38px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-size:13px;background:var(--s1);color:var(--t1);outline:none;font-family:var(--fb)}
.field textarea{min-height:100px;padding:10px 12px;line-height:1.5;resize:vertical;height:auto}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--ac);box-shadow:var(--shri)}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}

.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:110;display:grid;place-items:center;padding:20px}
.modal{width:520px;max-width:100%;background:var(--s1);border-radius:var(--r-xl);overflow:hidden;box-shadow:var(--shmd)}
.modal-h{padding:18px 22px;border-bottom:1px solid var(--s3)}
.modal-h h3{font-family:var(--fd);font-size:17px;font-weight:740;margin:0}
.modal-h p{font-size:13px;color:var(--t2);margin-top:3px}
.modal-b{padding:18px 22px}
.modal-f{padding:14px 22px;border-top:1px solid var(--s3);display:flex;justify-content:flex-end;gap:8px;background:var(--s2)}

/* Photo attach drawer extras */
.ph-picker{display:block;border:2px dashed var(--s3);border-radius:12px;padding:24px;text-align:center;cursor:pointer;background:var(--si);margin-bottom:16px}
.ph-picker:hover{border-color:var(--ac);background:var(--ac-s)}
.ph-picker > span{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--t2);font-size:13px}
.ph-picker-plus{width:40px;height:40px;border-radius:50%;background:var(--ac-s);color:var(--ac-t);display:grid;place-items:center;font-size:22px;font-weight:700}
.ph-list{display:flex;flex-direction:column;gap:10px}
.ph-row{display:flex;gap:10px;border:1px solid var(--s3);border-radius:12px;padding:10px}
.ph-thumb{width:72px;height:72px;border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--s2)}
.ph-thumb img{width:100%;height:100%;object-fit:cover}
.ph-fields{flex:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.ph-fields input{height:32px;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 10px;font-size:12.5px;font-family:var(--fb);outline:none}
.ph-fields input:focus{border-color:var(--ac);box-shadow:var(--shri)}
.ph-row-foot{display:flex;justify-content:space-between;align-items:center}
.ph-status{font-size:11.5px;font-weight:700;font-family:var(--fd);color:var(--t2)}
.ph-status.uploading,.ph-status.linking{color:var(--wr-t)}
.ph-status.done{color:var(--ok-t)}
.ph-status.error{color:var(--dg-t)}

@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
`;
