"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ClientActivityEvent,
  ClientActivityPhoto,
  ClientProgressMetrics,
  ClientProjectView,
} from "@/domain/loaders/project-home";

type Props = {
  contractorName: string;
  currentPhase: string;
  phasePercentByPhase: Record<string, number>;
  activityTrail: ClientActivityEvent[];
  progressMetrics: ClientProgressMetrics;
  milestones: ClientProjectView["milestones"];
  approvals: ClientProjectView["approvals"];
  drawRequests: ClientProjectView["drawRequests"];
};

type PhaseCard = {
  key: string;
  name: string;
  pct: number;
  done: boolean;
  current: boolean;
  future: boolean;
  label: string;
};

type UpdateCategory = "construction" | "approvals" | "financial" | "conversation";

type UpdateTag = { label: string; type: "blue" | "green" | "amber" | "gray" };

type UpdateItem = {
  id: string;
  title: string;
  body: string[];
  category: UpdateCategory;
  dateLabel: string;
  sortTime: number;
  tags: UpdateTag[];
  photos: ClientActivityPhoto[];
  authorName: string | null;
  metrics?: Array<{ val: string; label: string; color?: string }>;
};

const PHASE_ORDER = ["phase_1", "phase_2", "phase_3", "closeout"] as const;
const PHASE_NAMES: Record<(typeof PHASE_ORDER)[number], string> = {
  phase_1: "Phase 1 · Foundations",
  phase_2: "Phase 2 · Structural",
  phase_3: "Phase 3 · Interior Rough-In",
  closeout: "Phase 4 · Finishes",
};

function phaseIndex(phase: string): number {
  if (phase === "preconstruction" || phase === "phase_1") return 0;
  if (phase === "phase_2") return 1;
  if (phase === "phase_3") return 2;
  if (phase === "closeout") return 3;
  return 0;
}

function buildPhases(
  currentPhase: string,
  milestones: ClientProjectView["milestones"],
  phasePercentByPhase: Record<string, number>,
): PhaseCard[] {
  const currentIdx = phaseIndex(currentPhase);
  return PHASE_ORDER.map((key, idx) => {
    const done = idx < currentIdx;
    const current = idx === currentIdx;
    const future = idx > currentIdx;
    const rawPct = phasePercentByPhase[key];
    const pct = done
      ? 100
      : current
        ? typeof rawPct === "number"
          ? rawPct
          : 0
        : typeof rawPct === "number"
          ? rawPct
          : 0;

    let label = "";
    if (done) {
      label = "Completed";
    } else if (current) {
      const inProgress = milestones.find(
        (m) => m.milestoneStatus === "in_progress",
      );
      if (inProgress) {
        label = `Target: ${fmtShortDate(inProgress.scheduledDate)}`;
      } else {
        label = "In progress";
      }
    } else {
      const next = milestones.find((m) => m.milestoneStatus === "scheduled");
      label = next ? `Starts ${fmtShortDate(next.scheduledDate)}` : "Not started";
    }

    return {
      key,
      name: PHASE_NAMES[key],
      pct,
      done,
      current,
      future,
      label,
    };
  });
}

function fmtShortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtLongDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "GC"
  );
}

function categorizeActivity(
  relatedType: string | null,
  activityType: string,
): UpdateCategory {
  if (
    activityType === "message_posted" ||
    activityType === "comment_added" ||
    relatedType === "conversation"
  ) {
    return "conversation";
  }
  if (
    relatedType === "draw_request" ||
    relatedType === "payment" ||
    relatedType === "retainage_release" ||
    activityType.includes("payment") ||
    activityType.includes("draw")
  ) {
    return "financial";
  }
  if (
    relatedType === "approval" ||
    relatedType === "change_order" ||
    activityType.includes("approval")
  ) {
    return "approvals";
  }
  return "construction";
}

function tagsForCategory(category: UpdateCategory): UpdateTag[] {
  switch (category) {
    case "construction":
      return [{ label: "Construction", type: "blue" }];
    case "approvals":
      return [{ label: "Approval", type: "green" }];
    case "financial":
      return [{ label: "Financial", type: "green" }];
    case "conversation":
      return [{ label: "Update", type: "gray" }];
  }
}

function activityToUpdate(a: ClientActivityEvent): UpdateItem {
  const category = categorizeActivity(a.relatedObjectType, a.activityType);
  return {
    id: `act-${a.id}`,
    title: a.title,
    body: a.body ? [a.body] : ["Update logged on this project."],
    category,
    dateLabel: fmtLongDate(a.createdAt),
    sortTime: new Date(a.createdAt).getTime(),
    tags: tagsForCategory(category),
    photos: a.photoAttachments,
    authorName: a.actorName,
  };
}

function buildUpdates(
  contractorName: string,
  milestones: ClientProjectView["milestones"],
  approvals: ClientProjectView["approvals"],
  drawRequests: ClientProjectView["drawRequests"],
  activityTrail: ClientActivityEvent[],
): UpdateItem[] {
  if (activityTrail.length > 0) {
    return activityTrail
      .map(activityToUpdate)
      .sort((a, b) => b.sortTime - a.sortTime);
  }
  const items: UpdateItem[] = [];

  for (const m of milestones) {
    if (m.milestoneStatus === "completed") {
      items.push({
        id: `ms-${m.id}`,
        title: `${m.title} completed`,
        body: [
          `${contractorName} marked this milestone complete on ${fmtLongDate(m.scheduledDate)}.`,
        ],
        category: "construction",
        dateLabel: fmtLongDate(m.scheduledDate),
        sortTime: new Date(m.scheduledDate).getTime(),
        tags: [{ label: "Construction", type: "blue" }],
        photos: [], authorName: null,
      });
    }
  }

  for (const a of approvals) {
    if (a.approvalStatus === "approved" || a.approvalStatus === "rejected") {
      const approved = a.approvalStatus === "approved";
      items.push({
        id: `ap-${a.id}`,
        title: approved
          ? `Approval #${a.approvalNumber} — ${a.title} approved`
          : `Approval #${a.approvalNumber} — ${a.title} declined`,
        body: [
          a.description ??
            (approved
              ? "This approval has been decided and work can proceed."
              : "This approval was declined."),
          ...(a.decisionNote ? [`Decision note: ${a.decisionNote}`] : []),
        ],
        category: "approvals",
        dateLabel: "—",
        sortTime: 0,
        tags: [
          {
            label: approved ? "Approval" : "Declined",
            type: approved ? "green" : "amber",
          },
          { label: a.category, type: "gray" },
        ],
        photos: [], authorName: null,
      });
    }
  }

  for (const d of drawRequests) {
    if (d.drawRequestStatus === "paid" && d.paidAt) {
      items.push({
        id: `dr-${d.id}`,
        title: `Draw #${d.drawNumber} payment confirmed`,
        body: [
          `The ${new Date(d.periodFrom).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })} progress payment of ${fmtCents(d.currentPaymentDueCents)} has been received and confirmed.`,
        ],
        category: "financial",
        dateLabel: fmtLongDate(d.paidAt),
        sortTime: new Date(d.paidAt).getTime(),
        tags: [{ label: "Financial", type: "green" }],
        photos: [], authorName: null,
      });
    } else if (
      (d.drawRequestStatus === "submitted" ||
        d.drawRequestStatus === "under_review") &&
      d.submittedAt
    ) {
      items.push({
        id: `dr-${d.id}`,
        title: `Draw #${d.drawNumber} submitted for your review`,
        body: [
          `${fmtCents(d.currentPaymentDueCents)} progress payment is waiting on your review.`,
        ],
        category: "financial",
        dateLabel: fmtLongDate(d.submittedAt),
        sortTime: new Date(d.submittedAt).getTime(),
        tags: [
          { label: "Financial", type: "green" },
          { label: "Action needed", type: "amber" },
        ],
        photos: [], authorName: null,
      });
    }
  }

  items.sort((a, b) => b.sortTime - a.sortTime);
  return items;
}

export function CommercialProgressView({
  contractorName,
  currentPhase,
  phasePercentByPhase,
  activityTrail,
  progressMetrics,
  milestones,
  approvals,
  drawRequests,
}: Props) {
  const phases = useMemo(
    () => buildPhases(currentPhase, milestones, phasePercentByPhase),
    [currentPhase, milestones, phasePercentByPhase],
  );
  const allUpdates = useMemo(
    () =>
      buildUpdates(
        contractorName,
        milestones,
        approvals,
        drawRequests,
        activityTrail,
      ),
    [contractorName, milestones, approvals, drawRequests, activityTrail],
  );

  const counts = useMemo(
    () => ({
      all: allUpdates.length,
      construction: allUpdates.filter((u) => u.category === "construction").length,
      approvals: allUpdates.filter((u) => u.category === "approvals").length,
      financial: allUpdates.filter((u) => u.category === "financial").length,
      conversation: allUpdates.filter((u) => u.category === "conversation").length,
    }),
    [allUpdates],
  );

  const [filter, setFilter] = useState<"all" | UpdateCategory>("all");
  const visible =
    filter === "all"
      ? allUpdates
      : allUpdates.filter((u) => u.category === filter);

  const contractorInitials = initialsOf(contractorName);

  // Lightbox state — clicking a photo chip opens a modal overlay with the
  // full image. Close on backdrop click or Escape.
  const [lightbox, setLightbox] = useState<ClientActivityPhoto | null>(null);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <div className="ccp">
      <div className="ccp-head">
        <h1 className="ccp-pt">Progress &amp; Updates</h1>
        <div className="ccp-sub">
          Weekly reports and milestone updates from your contractor, {contractorName}.
        </div>
      </div>

      <div className="ccp-phase-grid">
        {phases.map((p) => (
          <div key={p.key} className={`ccp-ph${p.current ? " cur" : ""}`}>
            <h5>{p.name}</h5>
            <div className="ccp-ph-bar">
              <div
                className="ccp-ph-fill"
                style={{
                  width: `${p.pct}%`,
                  background: p.done
                    ? "var(--ok)"
                    : p.pct === 0
                      ? "var(--s4)"
                      : "var(--ac)",
                }}
              />
            </div>
            <div
              className="ccp-ph-pct"
              style={{
                color: p.done
                  ? "var(--ok)"
                  : p.pct === 0
                    ? "var(--t3)"
                    : "var(--t1)",
              }}
            >
              {p.pct}%
            </div>
            <div className="ccp-ph-label">{p.label}</div>
          </div>
        ))}
      </div>

      <div className="ccp-fb">
        {([
          { id: "all", label: "All updates", count: counts.all },
          { id: "construction", label: "Construction", count: counts.construction },
          { id: "approvals", label: "Approvals", count: counts.approvals },
          { id: "financial", label: "Financial", count: counts.financial },
          { id: "conversation", label: "Conversations", count: counts.conversation },
        ] as const).map((f) => (
          <button
            key={f.id}
            type="button"
            className={`ccp-fp${filter === f.id ? " on" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            <span className="ccp-cnt">{f.count}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="ccp-empty">
          No updates yet. Weekly reports from {contractorName} will appear here.
        </div>
      ) : (
        <div className="ccp-feed">
          {visible.map((u, idx) => {
            const isTop = idx === 0 && filter === "all";
            const metricItems = isTop
              ? [
                  {
                    val: String(progressMetrics.milestonesCompletedLast7d),
                    label: "Milestones completed",
                  },
                  {
                    val:
                      progressMetrics.scheduleStatus === "on_track"
                        ? "On track"
                        : "At risk",
                    label: "Schedule status",
                    color:
                      progressMetrics.scheduleStatus === "on_track"
                        ? "var(--ok)"
                        : "var(--wr)",
                  },
                  {
                    val: String(progressMetrics.photosAddedLast7d),
                    label: "Photos added",
                  },
                ]
              : (u.metrics ?? null);
            const displayName = u.authorName ?? contractorName;
            const roleSuffix = u.authorName
              ? `Project team, ${contractorName}`
              : "Project team";
            const avInitials = u.authorName
              ? initialsOf(u.authorName)
              : contractorInitials;
            return (
            <div key={u.id} className="ccp-uc">
              <div className="ccp-uc-top">
                <div className="ccp-uc-main">
                  <div className="ccp-uc-author">
                    <div className="ccp-uc-av">{avInitials}</div>
                    <div className="ccp-uc-info">
                      <strong>{displayName}</strong> · {roleSuffix}
                    </div>
                  </div>
                  <div className="ccp-uc-title">{u.title}</div>
                </div>
                <div className="ccp-uc-date">{u.dateLabel}</div>
              </div>
              <div className="ccp-uc-body">
                {u.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
              {metricItems ? (
                <div className="ccp-wm">
                  {metricItems.map((m) => (
                    <div key={m.label} className="ccp-wm-item">
                      <div
                        className="ccp-wm-v"
                        style={m.color ? { color: m.color } : undefined}
                      >
                        {m.val}
                      </div>
                      <div className="ccp-wm-l">{m.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {u.photos.length > 0 ? (
                <div className="ccp-uc-photos">
                  {u.photos.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="ccp-ph-chip"
                      onClick={() => setLightbox(p)}
                    >
                      <span className="ccp-ph-thumb" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="9" cy="9" r="2"/>
                          <path d="m21 15-5-5L5 21"/>
                        </svg>
                      </span>
                      <span className="ccp-ph-chip-label">{p.title}</span>
                    </button>
                  ))}
                  {u.photos.length > 4 ? (
                    <button
                      type="button"
                      className="ccp-ph-chip more"
                      onClick={() => setLightbox(u.photos[4])}
                    >
                      +{u.photos.length - 4} more
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="ccp-uc-tags">
                {u.tags.map((t) => (
                  <span key={t.label} className={`ccp-pl ${t.type}`}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {lightbox ? (
        <div
          className="ccp-lb"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="ccp-lb-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ccp-lb-close"
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            {lightbox.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.url} alt={lightbox.title} className="ccp-lb-img" />
            ) : (
              <div className="ccp-lb-ph">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>Image unavailable</span>
              </div>
            )}
            <div className="ccp-lb-caption">{lightbox.title}</div>
          </div>
        </div>
      ) : null}

      <style dangerouslySetInnerHTML={{ __html: `
.ccp{display:flex;flex-direction:column}
.ccp-head{margin-bottom:20px}
.ccp-pt{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.ccp-sub{font-family:var(--fb);margin-top:4px;font-size:13.5px;color:var(--t2)}

.ccp-phase-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.ccp-ph{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;text-align:center}
.ccp-ph.cur{border-color:var(--ac);background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%)}
.ccp-ph h5{font-family:var(--fd);font-size:12px;font-weight:650;letter-spacing:-.01em;margin:0 0 6px;color:var(--t1)}
.ccp-ph-bar{height:6px;border-radius:3px;background:var(--s3);overflow:hidden;margin-bottom:4px}
.ccp-ph-fill{height:100%;border-radius:3px;transition:width 200ms ease}
.ccp-ph-pct{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em}
.ccp-ph-label{font-family:var(--fb);font-size:11px;color:var(--t3);margin-top:2px}

.ccp-fb{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.ccp-fp{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12.5px;font-weight:560;color:var(--t2);cursor:pointer;transition:all 120ms ease;display:inline-flex;align-items:center}
.ccp-fp:hover{border-color:var(--s4);color:var(--t1)}
.ccp-fp.on{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:620}
.ccp-cnt{font-size:10.5px;margin-left:4px;opacity:.7}

.ccp-feed{display:flex;flex-direction:column}
.ccp-uc{padding:20px;border:1px solid var(--s3);border-radius:var(--r-l);background:var(--s1);transition:box-shadow 120ms ease}
.ccp-uc+.ccp-uc{margin-top:12px}
.ccp-uc:hover{box-shadow:var(--shmd)}
.ccp-uc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px}
.ccp-uc-main{flex:1;min-width:0}
.ccp-uc-author{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.ccp-uc-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;flex-shrink:0;color:#fff;background:linear-gradient(135deg,#5b4fc7,#7c6fe0)}
.ccp-uc-info{font-family:var(--fb);font-size:12px;color:var(--t2)}
.ccp-uc-info strong{color:var(--t1);font-weight:620}
.ccp-uc-title{font-family:var(--fd);font-size:15px;font-weight:660;letter-spacing:-.01em;line-height:1.3;margin-bottom:8px;color:var(--t1)}
.ccp-uc-date{font-family:var(--fd);font-size:12px;color:var(--t3);font-weight:560;white-space:nowrap;flex-shrink:0}
.ccp-uc-body{font-family:var(--fb);font-size:13.5px;color:var(--t2);line-height:1.55}
.ccp-uc-body p+p{margin-top:8px}
.ccp-wm{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--s3)}
.ccp-wm-item{text-align:center}
.ccp-wm-v{font-family:var(--fd);font-size:16px;font-weight:720;letter-spacing:-.02em;color:var(--t1)}
.ccp-wm-l{font-family:var(--fb);font-size:11px;color:var(--t3);margin-top:2px}
.ccp-uc-photos{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.ccp-ph-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--s3);border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:550;color:var(--t2);background:var(--s1);text-decoration:none;transition:all 120ms ease;max-width:220px}
.ccp-ph-chip:hover{border-color:var(--ac);color:var(--ac-t);background:var(--ac-s)}
.ccp-ph-chip.more{font-weight:620;color:var(--ac-t);border-color:var(--ac-m);background:var(--ac-s)}
.ccp-ph-thumb{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;color:var(--t3);flex-shrink:0}
.ccp-ph-chip:hover .ccp-ph-thumb{color:var(--ac-t)}
.ccp-ph-chip-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccp-uc-tags{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.ccp-pl{height:22px;padding:0 10px;border-radius:999px;border:1px solid var(--s3);display:inline-flex;align-items:center;font-family:var(--fd);font-size:10.5px;font-weight:700;background:var(--s1);color:var(--t3);white-space:nowrap}
.ccp-pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d4ee}
.ccp-pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#a7d9be}
.ccp-pl.amber{background:var(--wr-s);color:var(--wr-t);border-color:#f5d6a0}
.ccp-pl.gray{background:var(--s2);color:var(--t3);border-color:var(--s3)}

.ccp-empty{padding:32px;border:1px dashed var(--s3);border-radius:var(--r-l);font-family:var(--fb);font-size:13px;color:var(--t3);text-align:center;background:var(--s1)}

.ccp-lb{position:fixed;inset:0;background:rgba(12,14,20,.88);z-index:1000;display:flex;align-items:center;justify-content:center;padding:32px;animation:ccp-lb-fade 160ms ease-out}
@keyframes ccp-lb-fade{from{opacity:0}to{opacity:1}}
.ccp-lb-inner{position:relative;width:min(1400px,92vw);display:flex;flex-direction:column;align-items:center;gap:14px}
.ccp-lb-img{width:100%;height:auto;max-height:84vh;object-fit:contain;border-radius:var(--r-l);box-shadow:0 20px 60px rgba(0,0,0,.5);background:var(--s2);display:block}
.ccp-lb-ph{width:100%;aspect-ratio:4/3;max-height:84vh;border-radius:var(--r-l);background:linear-gradient(135deg,#2a2e3c,#1a1d28);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,.7);font-family:var(--fb);font-size:13px}
.ccp-lb-ph svg{width:48px;height:48px;opacity:.4}
.ccp-lb-caption{font-family:var(--fb);font-size:13px;color:rgba(255,255,255,.88);text-align:center;max-width:80vw;text-shadow:0 1px 3px rgba(0,0,0,.5)}
.ccp-lb-close{position:absolute;top:-8px;right:-8px;width:36px;height:36px;border-radius:50%;border:none;background:var(--s1);color:var(--t1);display:grid;place-items:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);transition:all 120ms ease}
.ccp-lb-close:hover{background:var(--s2);transform:scale(1.05)}

@media(max-width:1280px){.ccp-phase-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:720px){.ccp-phase-grid{grid-template-columns:1fr}.ccp-pt{font-size:22px}}
      ` }} />
    </div>
  );
}
