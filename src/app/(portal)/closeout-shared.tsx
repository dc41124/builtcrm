"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  CO_ICONS,
  fmtSize,
  fmtSizeBig,
  initials,
  plural,
} from "@/app/(portal)/closeout-icons";
import { SECTION_CONFIG } from "@/lib/closeout-packages/section-config";
import type {
  CloseoutPackageDetail,
  CloseoutSectionRow,
} from "@/domain/loaders/closeout-packages";

// Client review screen — shared between commercial + residential portals.
// Renders the delivered package read-only with per-item comment threads,
// a package-level overall comments box, and a sticky accept bar.

export function ClientCloseoutReview({
  pkg,
  backHref,
  signerSuggestion,
}: {
  pkg: CloseoutPackageDetail;
  backHref: string;
  signerSuggestion: string;
}) {
  const router = useRouter();
  const [pending, startMutation] = useTransition();
  const [newCommentItemId, setNewCommentItemId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [pkgCommentDraft, setPkgCommentDraft] = useState("");
  const [pkgCommentOpen, setPkgCommentOpen] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [acceptSigner, setAcceptSigner] = useState(signerSuggestion);
  const [acceptNote, setAcceptNote] = useState("");

  const totalItems = pkg.sections.reduce((a, s) => a + s.items.length, 0);
  const totalSize = pkg.sections.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + i.sizeBytes, 0),
    0,
  );
  const packageComments = pkg.comments.filter((c) => c.scope === "package");
  const openComments = pkg.comments.filter((c) => c.resolvedAt == null).length;

  const commentsForItem = (itemId: string) =>
    pkg.comments.filter((c) => c.scope === "item" && c.itemId === itemId);

  const submitItemComment = (sectionId: string, itemId: string) => {
    if (!newCommentText.trim()) return;
    startMutation(async () => {
      const res = await fetch(
        `/api/closeout-packages/${pkg.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "item",
            sectionId,
            itemId,
            body: newCommentText,
          }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || "Failed to post comment");
        return;
      }
      setNewCommentText("");
      setNewCommentItemId(null);
      router.refresh();
    });
  };

  const submitPackageComment = () => {
    if (!pkgCommentDraft.trim()) return;
    startMutation(async () => {
      const res = await fetch(
        `/api/closeout-packages/${pkg.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "package",
            body: pkgCommentDraft,
          }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || "Failed to post comment");
        return;
      }
      setPkgCommentDraft("");
      setPkgCommentOpen(false);
      router.refresh();
    });
  };

  const submitAccept = () => {
    if (!acceptSigner.trim()) return;
    startMutation(async () => {
      const res = await fetch(
        `/api/closeout-packages/${pkg.id}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            acceptedSigner: acceptSigner,
            acceptanceNote: acceptNote || null,
          }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        alert(txt || "Failed to accept");
        return;
      }
      setShowAccept(false);
      router.refresh();
    });
  };

  return (
    <div className="cp-client-review">
      <div className="cp-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a className="cp-btn sm ghost" href={backHref}>
            {CO_ICONS.back} Back
          </a>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            className="cp-btn sm ghost"
            href={`/api/closeout-packages/${pkg.id}/download`}
          >
            {CO_ICONS.download} Download full ZIP ({fmtSizeBig(totalSize)})
          </a>
          {pkg.canAccept && (
            <button
              className="cp-btn sm primary"
              onClick={() => setShowAccept(true)}
            >
              {CO_ICONS.award} Accept package
            </button>
          )}
        </div>
      </div>

      <div className="cp-review-hdr">
        <div className="cp-review-hdr-top">
          <span className={`cp-status-pill ${pkg.status}`}>
            {pkg.status === "delivered" && CO_ICONS.send}
            {pkg.status === "accepted" && CO_ICONS.check}
            {pkg.status === "delivered"
              ? `Delivered ${pkg.deliveredAt ? new Date(pkg.deliveredAt).toLocaleDateString() : ""}`
              : `Accepted ${pkg.acceptedAt ? new Date(pkg.acceptedAt).toLocaleDateString() : ""}`}
          </span>
          <span className="cp-review-num">{pkg.numberLabel}</span>
        </div>
        <h2 className="cp-review-subject">
          {pkg.title} — {pkg.projectName}
        </h2>
        <p className="cp-review-msg">
          {pkg.preparedByName ?? "Your contractor"} has delivered the closeout
          package for your project. Review each section below — drop a comment
          on a specific document if you have questions, or accept the package
          when you&apos;re satisfied. Acceptance closes the project on the
          contractor&apos;s end and releases final invoicing.
        </p>
        {pkg.preparedByOrgName ? (
          <div className="cp-review-signoff-from">
            — {pkg.preparedByName ?? "Your contractor"},{" "}
            {pkg.preparedByOrgName}
          </div>
        ) : null}

        <div className="cp-review-stat-row">
          <div>
            <div className="cp-review-stat-label">Sections</div>
            <div className="cp-review-stat-value">{pkg.sections.length}</div>
          </div>
          <div>
            <div className="cp-review-stat-label">Documents</div>
            <div className="cp-review-stat-value">{totalItems}</div>
          </div>
          <div>
            <div className="cp-review-stat-label">Bundle</div>
            <div className="cp-review-stat-value">{fmtSizeBig(totalSize)}</div>
          </div>
          <div>
            <div className="cp-review-stat-label">Open questions</div>
            <div
              className={`cp-review-stat-value${openComments > 0 ? " warn" : ""}`}
            >
              {openComments}
            </div>
          </div>
        </div>
      </div>

      {(packageComments.length > 0 || pkg.canAccept) && (
        <div className="cp-review-pkg-comments">
          <div className="cp-review-pkg-comments-hdr">
            {CO_ICONS.comment} Overall comments
          </div>
          {packageComments.map((c) => (
            <div key={c.id} className="cp-review-comment">
              <div className="cp-review-comment-avatar">
                {initials(c.authorName)}
              </div>
              <div className="cp-review-comment-body">
                <div className="cp-review-comment-meta">
                  <strong>{c.authorName ?? "Owner"}</strong>
                  <span className="cp-review-comment-when">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="cp-review-comment-text">{c.body}</div>
              </div>
            </div>
          ))}
          {pkg.canAccept && (
            <div style={{ marginTop: 8 }}>
              {!pkgCommentOpen ? (
                <button
                  className="cp-btn xs ghost"
                  onClick={() => setPkgCommentOpen(true)}
                >
                  {CO_ICONS.plus} Add an overall comment
                </button>
              ) : (
                <div className="cp-comment-compose">
                  <textarea
                    className="cp-textarea sm"
                    rows={3}
                    placeholder="Anything you want to flag at the package level…"
                    value={pkgCommentDraft}
                    onChange={(e) => setPkgCommentDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="cp-comment-compose-actions">
                    <button
                      className="cp-btn xs ghost"
                      onClick={() => {
                        setPkgCommentOpen(false);
                        setPkgCommentDraft("");
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="cp-btn xs primary"
                      onClick={submitPackageComment}
                      disabled={pending || !pkgCommentDraft.trim()}
                    >
                      {CO_ICONS.send} Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="cp-review-sections">
        {pkg.sections.map((sec: CloseoutSectionRow) => {
          const cfg = SECTION_CONFIG[sec.sectionType];
          const label =
            sec.sectionType === "other" && sec.customLabel
              ? sec.customLabel
              : cfg.label;
          return (
            <div key={sec.id} className="cp-review-section">
              <div
                className="cp-review-section-hdr"
                style={
                  {
                    "--sec-solid": cfg.solid,
                    "--sec-soft": cfg.soft,
                  } as React.CSSProperties
                }
              >
                <span
                  className="cp-section-color-tag"
                  style={{ background: cfg.solid }}
                />
                <h3 className="cp-section-name">{label}</h3>
                <span className="cp-section-count">
                  {plural(sec.items.length, "doc", "docs")}
                </span>
              </div>
              <div className="cp-review-section-body">
                {sec.items.map((item) => {
                  const itemComments = commentsForItem(item.id);
                  const isAddingComment = newCommentItemId === item.id;
                  return (
                    <div key={item.id} className="cp-review-item">
                      <div className="cp-review-item-row">
                        <div className="cp-item-thumb">{CO_ICONS.doc}</div>
                        <div className="cp-review-item-body">
                          <div className="cp-review-item-name">{item.name}</div>
                          <div className="cp-review-item-meta">
                            {fmtSize(item.sizeBytes)}
                          </div>
                          {item.notes ? (
                            <div className="cp-review-item-note">
                              <span className="cp-review-item-note-icon">
                                {CO_ICONS.pen}
                              </span>
                              {item.notes}
                            </div>
                          ) : null}
                        </div>
                        <div className="cp-review-item-actions">
                          {pkg.canAccept && (
                            <button
                              className={`cp-btn xs ghost${
                                itemComments.length > 0 ? " has-comments" : ""
                              }`}
                              onClick={() => {
                                setNewCommentItemId(item.id);
                                setNewCommentText("");
                              }}
                            >
                              {CO_ICONS.comment}
                              {itemComments.length > 0 && (
                                <span className="cp-comment-count">
                                  {itemComments.length}
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {(itemComments.length > 0 || isAddingComment) && (
                        <div className="cp-review-item-comments">
                          {itemComments.map((c) => (
                            <div
                              key={c.id}
                              className="cp-review-comment small"
                            >
                              <div className="cp-review-comment-avatar">
                                {initials(c.authorName)}
                              </div>
                              <div className="cp-review-comment-body">
                                <div className="cp-review-comment-meta">
                                  <strong>{c.authorName ?? "Owner"}</strong>
                                  <span className="cp-review-comment-when">
                                    {new Date(c.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <div className="cp-review-comment-text">
                                  {c.body}
                                </div>
                              </div>
                            </div>
                          ))}
                          {isAddingComment && (
                            <div className="cp-comment-compose">
                              <textarea
                                className="cp-textarea sm"
                                rows={2}
                                placeholder="Ask a question or note an issue…"
                                value={newCommentText}
                                onChange={(e) =>
                                  setNewCommentText(e.target.value)
                                }
                                autoFocus
                              />
                              <div className="cp-comment-compose-actions">
                                <button
                                  className="cp-btn xs ghost"
                                  onClick={() => {
                                    setNewCommentItemId(null);
                                    setNewCommentText("");
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="cp-btn xs primary"
                                  onClick={() =>
                                    submitItemComment(sec.id, item.id)
                                  }
                                  disabled={
                                    pending || !newCommentText.trim()
                                  }
                                >
                                  {CO_ICONS.send} Post
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {pkg.canAccept && (
        <div className="cp-review-accept-bar">
          <div className="cp-review-accept-text">
            <strong>Ready to sign off?</strong> Accepting this package
            transitions the project to <strong>Closed</strong> and releases
            final invoicing. The audit log captures your acceptance.
          </div>
          <button
            className="cp-btn primary lg"
            onClick={() => setShowAccept(true)}
          >
            {CO_ICONS.award} Accept package
          </button>
        </div>
      )}

      {pkg.acceptedAt && pkg.acceptanceNote ? (
        <div
          className="cp-review-pkg-comments"
          style={{ borderLeftColor: "var(--ok)", background: "var(--ok-soft)" }}
        >
          <div
            className="cp-review-pkg-comments-hdr"
            style={{ color: "var(--ok)" }}
          >
            {CO_ICONS.award} Acceptance note —{" "}
            {pkg.acceptedSigner ?? "client"}
          </div>
          <div className="cp-review-comment-text">{pkg.acceptanceNote}</div>
        </div>
      ) : null}

      {showAccept && (
        <div
          className="cp-modal-backdrop"
          onClick={() => setShowAccept(false)}
        >
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-hdr">
              <div>
                <h2 className="cp-modal-title">Accept closeout package</h2>
                <div className="cp-modal-sub">
                  Acknowledge receipt of all materials and close out{" "}
                  <strong>{pkg.projectName}</strong>.
                </div>
              </div>
              <button
                className="cp-btn xs ghost"
                onClick={() => setShowAccept(false)}
              >
                {CO_ICONS.x}
              </button>
            </div>
            <div className="cp-modal-body">
              <div className="cp-accept-summary">
                <div className="cp-accept-icon">{CO_ICONS.award}</div>
                <div>
                  <div className="cp-accept-summary-title">
                    You&apos;re accepting <strong>{pkg.numberLabel}</strong>
                  </div>
                  <div className="cp-accept-summary-sub">
                    {pkg.sections.length} sections · {totalItems} documents ·{" "}
                    {fmtSizeBig(totalSize)}
                  </div>
                </div>
              </div>
              <label className="cp-field">
                <span className="cp-field-label">Sign as</span>
                <input
                  type="text"
                  className="cp-input"
                  value={acceptSigner}
                  onChange={(e) => setAcceptSigner(e.target.value)}
                />
                <span className="cp-field-hint">
                  Your name and timestamp are recorded on the project audit
                  log.
                </span>
              </label>
              <label className="cp-field">
                <span className="cp-field-label">
                  Acceptance note (optional)
                </span>
                <textarea
                  className="cp-textarea"
                  rows={3}
                  placeholder="Any closing thoughts for the contractor…"
                  value={acceptNote}
                  onChange={(e) => setAcceptNote(e.target.value)}
                />
              </label>
              {openComments > 0 && (
                <div className="cp-modal-warn">
                  <span className="cp-modal-warn-icon">{CO_ICONS.shield}</span>
                  <div>
                    <strong>
                      {openComments} open question
                      {openComments === 1 ? "" : "s"}
                    </strong>{" "}
                    on individual documents — these stay on record after
                    acceptance.
                  </div>
                </div>
              )}
              <div className="cp-accept-clickwrap">
                <span className="cp-accept-clickwrap-icon">
                  {CO_ICONS.check}
                </span>
                <div>
                  By clicking <strong>Sign &amp; accept</strong> I confirm
                  that I have received the closeout materials for{" "}
                  <strong>{pkg.projectName}</strong> and that the project may
                  be transitioned to <strong>Closed</strong>. Final invoicing
                  can release.
                </div>
              </div>
            </div>
            <div className="cp-modal-ftr">
              <button
                className="cp-btn ghost"
                onClick={() => setShowAccept(false)}
              >
                Cancel
              </button>
              <button
                className="cp-btn primary"
                disabled={pending || !acceptSigner.trim()}
                onClick={submitAccept}
              >
                {CO_ICONS.award} Sign &amp; accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Client list — used by both commercial + residential entry pages.
// ───────────────────────────────────────────────────────────────────

export function ClientCloseoutList({
  rows,
  reviewHrefBase,
  emptyTitle,
  emptySub,
  vocab,
}: {
  rows: import("@/domain/loaders/closeout-packages").CloseoutPackageListRow[];
  reviewHrefBase: string;
  emptyTitle: string;
  emptySub: string;
  vocab: {
    pageTitle: string;
    pageSub: string;
  };
}) {
  return (
    <div className="cp-client-page">
      <div className="cp-client-hdr">
        <h1 className="cp-client-title">{vocab.pageTitle}</h1>
        <p className="cp-client-sub">{vocab.pageSub}</p>
      </div>
      <div className="cp-client-pkg-list">
        {rows.length === 0 && (
          <div className="cp-empty">
            <div className="cp-empty-icon">{CO_ICONS.pkg}</div>
            <div className="cp-empty-title">{emptyTitle}</div>
            <div className="cp-empty-sub">{emptySub}</div>
          </div>
        )}
        {rows.map((p) => {
          const isActive = p.status === "delivered";
          return (
            <a
              key={p.id}
              href={`${reviewHrefBase}/${p.id}`}
              className={`cp-client-pkg ${
                isActive ? "cp-client-pkg-active" : "cp-client-pkg-archived"
              }`}
            >
              <div className="cp-client-pkg-hdr">
                <span className={`cp-status-pill ${p.status}`}>
                  {p.status === "delivered" && CO_ICONS.send}
                  {p.status === "accepted" && CO_ICONS.check}
                  {p.status === "delivered"
                    ? "Delivered — awaiting your review"
                    : `Accepted ${p.acceptedAt ? new Date(p.acceptedAt).toLocaleDateString() : ""}`}
                </span>
                <span className="cp-client-pkg-num">{p.numberLabel}</span>
              </div>
              <h2 className="cp-client-pkg-name">{p.title}</h2>
              <div className="cp-client-pkg-meta">
                {p.deliveredAt
                  ? `Delivered ${new Date(p.deliveredAt).toLocaleString()}`
                  : ""}
              </div>
              <div className="cp-client-pkg-stats">
                <div>
                  <strong>{p.sectionsCount}</strong> sections
                </div>
                <div>
                  <strong>{p.docsCount}</strong> documents
                </div>
                <div>
                  <strong>{fmtSizeBig(p.totalSizeBytes)}</strong> bundle
                </div>
                {p.openCommentsCount > 0 && (
                  <div className="cp-client-pkg-comments-chip">
                    {CO_ICONS.comment} {p.openCommentsCount} open question
                    {p.openCommentsCount === 1 ? "" : "s"}
                  </div>
                )}
              </div>
              <div className="cp-client-pkg-cta">
                {isActive ? "Open and review" : "Open archive"} {CO_ICONS.chevR}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
