"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  CO_ICONS,
  fmtSize,
  fmtSizeBig,
  plural,
  statusLabel,
  statusVerb,
} from "@/app/(portal)/closeout-icons";
import { SECTION_CONFIG } from "@/lib/closeout-packages/section-config";
import type {
  CloseoutPackageDetail,
  CloseoutSectionType,
  DocLibraryFolder,
} from "@/domain/loaders/closeout-packages";

const ALL_SECTION_TYPES: CloseoutSectionType[] = [
  "om_manuals",
  "warranties",
  "as_builts",
  "permits_final",
  "testing_certificates",
  "cad_files",
  "other",
];

export function CloseoutBuilder({
  projectId,
  pkg,
  docLibrary,
}: {
  projectId: string;
  pkg: CloseoutPackageDetail;
  docLibrary: DocLibraryFolder[];
}) {
  const router = useRouter();
  const [pending, startMutation] = useTransition();

  const [activeDragDocId, setDrag] = useState<string | null>(null);
  const [dropTargetSecId, setDrop] = useState<string | null>(null);
  const [editingItemId, setEditing] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [docPickerSearch, setDPS] = useState("");
  const [pickerFolderOpen, setPFO] = useState(
    Object.fromEntries(docLibrary.map((f) => [f.label, true])),
  );
  const [showDeliverModal, setShowDeliver] = useState<
    null | { target: "review" | "delivered" }
  >(null);

  const usedDocIds = useMemo(
    () =>
      new Set(
        pkg.sections.flatMap((s) => s.items.map((i) => i.documentId)),
      ),
    [pkg.sections],
  );

  const availableSectionTypes = useMemo(() => {
    const used = new Set(pkg.sections.map((s) => s.sectionType));
    return ALL_SECTION_TYPES.filter((t) => t === "other" || !used.has(t));
  }, [pkg.sections]);

  const totalItems = pkg.sections.reduce((a, s) => a + s.items.length, 0);
  const totalSize = pkg.sections.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + i.sizeBytes, 0),
    0,
  );

  const post = async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Request failed (${res.status})`);
    }
    return res.json();
  };
  const patch = async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Request failed (${res.status})`);
    }
    return res.json();
  };
  const del = async (path: string) => {
    const res = await fetch(path, { method: "DELETE" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Request failed (${res.status})`);
    }
    return res.json();
  };

  const refresh = () => router.refresh();

  // ─── Mutations ──────────────────────────────────────────────────
  const addSectionType = (type: CloseoutSectionType) =>
    startMutation(async () => {
      try {
        await post(`/api/closeout-packages/${pkg.id}/sections`, {
          sectionType: type,
          customLabel: type === "other" ? "Custom" : null,
        });
        setShowAddSection(false);
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  const removeSection = (sectionId: string) =>
    startMutation(async () => {
      if (!confirm("Remove this section and all its items?")) return;
      try {
        await del(`/api/closeout-packages/sections/${sectionId}`);
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  const renameCustom = (sectionId: string, customLabel: string) =>
    startMutation(async () => {
      try {
        await patch(`/api/closeout-packages/sections/${sectionId}`, {
          customLabel,
        });
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  const addDocToSection = (sectionId: string, documentId: string) => {
    if (usedDocIds.has(documentId)) return;
    startMutation(async () => {
      try {
        await post(
          `/api/closeout-packages/sections/${sectionId}/items`,
          { documentId },
        );
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  };

  const removeItem = (itemId: string) =>
    startMutation(async () => {
      try {
        await del(`/api/closeout-packages/items/${itemId}`);
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  const saveNotes = (itemId: string) =>
    startMutation(async () => {
      try {
        await patch(`/api/closeout-packages/items/${itemId}`, {
          notes: draftNotes,
        });
        setEditing(null);
        setDraftNotes("");
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  const moveStatus = (target: "review" | "delivered") =>
    startMutation(async () => {
      try {
        await post(`/api/closeout-packages/${pkg.id}/deliver`, { to: target });
        setShowDeliver(null);
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  const revertToBuilding = () =>
    startMutation(async () => {
      try {
        await patch(`/api/closeout-packages/${pkg.id}`, {
          status: "building",
        });
        refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });

  // ─── Drag handlers ──────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, docId: string) => {
    setDrag(docId);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", docId);
  };
  const onDragEnd = () => {
    setDrag(null);
    setDrop(null);
  };
  const onDragOverSection = (e: React.DragEvent, secId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dropTargetSecId !== secId) setDrop(secId);
  };
  const onDragLeaveSection = (_e: React.DragEvent, secId: string) => {
    if (dropTargetSecId === secId) setDrop(null);
  };
  const onDropSection = (e: React.DragEvent, secId: string) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData("text/plain") || activeDragDocId;
    if (!docId) return;
    addDocToSection(secId, docId);
    setDrag(null);
    setDrop(null);
  };

  const filteredLibrary = useMemo(() => {
    if (!docPickerSearch.trim()) return docLibrary;
    const q = docPickerSearch.toLowerCase();
    return docLibrary
      .map((folder) => ({
        ...folder,
        docs: folder.docs.filter((d) => d.name.toLowerCase().includes(q)),
      }))
      .filter((f) => f.docs.length > 0);
  }, [docLibrary, docPickerSearch]);

  const totalLibraryDocs = docLibrary.reduce((a, f) => a + f.docs.length, 0);

  return (
    <>
      <div className="cp-builder-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            className="cp-btn sm ghost"
            href={`/contractor/project/${projectId}/closeout-packages`}
          >
            {CO_ICONS.back} All packages
          </Link>
        </div>
        <div className="cp-builder-title-block">
          <div className="cp-builder-title-row">
            <span className={`cp-status-pill ${pkg.status}`}>
              {pkg.status === "building" && CO_ICONS.edit}
              {pkg.status === "review" && CO_ICONS.shield}
              {pkg.status === "delivered" && CO_ICONS.send}
              {pkg.status === "accepted" && CO_ICONS.check}
              {statusLabel(pkg.status)}
            </span>
            <h1 className="cp-builder-title">{pkg.title}</h1>
            <span className="cp-builder-num">{pkg.numberLabel}</span>
          </div>
          <div className="cp-builder-sub">
            Closeout package {statusVerb(pkg.status)}. Prepared by{" "}
            <strong>{pkg.preparedByName ?? "—"}</strong>
            {pkg.preparedByOrgName ? ` · ${pkg.preparedByOrgName}` : ""}
            {pkg.deliveredAt
              ? ` · Delivered ${new Date(pkg.deliveredAt).toLocaleDateString()}`
              : ""}
            {pkg.acceptedAt
              ? ` · Accepted ${new Date(pkg.acceptedAt).toLocaleDateString()}`
              : ""}
          </div>
        </div>
        <div className="cp-builder-actions">
          <a
            className="cp-btn sm ghost"
            href={`/api/closeout-packages/${pkg.id}/download`}
          >
            {CO_ICONS.zip} Preview ZIP
          </a>
          {pkg.status === "building" && (
            <button
              className="cp-btn sm primary"
              onClick={() => setShowDeliver({ target: "review" })}
              disabled={pending || !pkg.canDeliver}
              title={pkg.canDeliver ? "" : "Add at least one document"}
            >
              {CO_ICONS.shield} Move to review
            </button>
          )}
          {pkg.status === "review" && (
            <>
              <button
                className="cp-btn sm ghost"
                onClick={revertToBuilding}
                disabled={pending}
              >
                {CO_ICONS.edit} Back to building
              </button>
              <button
                className="cp-btn sm primary"
                onClick={() => setShowDeliver({ target: "delivered" })}
                disabled={pending}
              >
                {CO_ICONS.send} Deliver to client
              </button>
            </>
          )}
          {pkg.status === "delivered" && (
            <span className="cp-builder-state-note">
              {CO_ICONS.clock} Awaiting client sign-off
            </span>
          )}
          {pkg.status === "accepted" && (
            <span className="cp-builder-state-note">
              {CO_ICONS.award} Accepted by {pkg.acceptedSigner ?? "client"}
            </span>
          )}
        </div>
      </div>

      <div className="cp-completion-card">
        <div className="cp-completion-stat">
          <div className="cp-completion-label">Sections</div>
          <div className="cp-completion-value">{pkg.sections.length}</div>
        </div>
        <div className="cp-completion-divider" />
        <div className="cp-completion-stat">
          <div className="cp-completion-label">Documents</div>
          <div className="cp-completion-value">{totalItems}</div>
        </div>
        <div className="cp-completion-divider" />
        <div className="cp-completion-stat">
          <div className="cp-completion-label">Bundle size</div>
          <div className="cp-completion-value">{fmtSizeBig(totalSize)}</div>
        </div>
        <div className="cp-completion-divider" />
        <div className="cp-completion-stat cp-completion-progress">
          <div className="cp-completion-label">Completion</div>
          <div className="cp-completion-bar">
            <div className="cp-completion-bar-track">
              <div
                className="cp-completion-bar-fill"
                style={{ width: `${pkg.completionPct}%` }}
              />
            </div>
            <span className="cp-completion-pct">{pkg.completionPct}%</span>
          </div>
        </div>
      </div>

      <div className="cp-builder-grid">
        <div className="cp-sections">
          {pkg.sections.map((sec) => {
            const cfg = SECTION_CONFIG[sec.sectionType];
            const sectionTotalSize = sec.items.reduce(
              (a, i) => a + i.sizeBytes,
              0,
            );
            const isDropTarget = dropTargetSecId === sec.id;
            return (
              <div
                key={sec.id}
                className={`cp-section${isDropTarget ? " drop-target" : ""}`}
                onDragOver={(e) => onDragOverSection(e, sec.id)}
                onDragLeave={(e) => onDragLeaveSection(e, sec.id)}
                onDrop={(e) => onDropSection(e, sec.id)}
              >
                <div
                  className="cp-section-hdr"
                  style={
                    {
                      "--sec-solid": cfg.solid,
                      "--sec-soft": cfg.soft,
                    } as React.CSSProperties
                  }
                >
                  <div className="cp-section-hdr-left">
                    <span
                      className="cp-section-color-tag"
                      style={{ background: cfg.solid }}
                    />
                    <div>
                      {sec.sectionType === "other" ? (
                        <input
                          type="text"
                          className="cp-section-custom-input"
                          defaultValue={sec.customLabel ?? ""}
                          onBlur={(e) => {
                            if (e.target.value !== (sec.customLabel ?? "")) {
                              renameCustom(sec.id, e.target.value);
                            }
                          }}
                          placeholder="Custom section name"
                          disabled={!pkg.canEdit}
                        />
                      ) : (
                        <h3 className="cp-section-name">{cfg.label}</h3>
                      )}
                      <div className="cp-section-desc">{cfg.desc}</div>
                    </div>
                  </div>
                  <div className="cp-section-hdr-right">
                    <span className="cp-section-count">
                      {plural(sec.items.length, "doc", "docs")}
                      {sectionTotalSize > 0
                        ? ` · ${fmtSize(sectionTotalSize)}`
                        : ""}
                    </span>
                    {pkg.canEdit && (
                      <button
                        className="cp-icon-btn danger"
                        onClick={() => removeSection(sec.id)}
                        title="Remove section"
                        disabled={pending}
                      >
                        {CO_ICONS.trash}
                      </button>
                    )}
                  </div>
                </div>

                <div className="cp-section-body">
                  {sec.items.length === 0 && (
                    <div className="cp-section-empty">
                      <div className="cp-section-empty-icon">
                        {CO_ICONS.doc}
                      </div>
                      <div className="cp-section-empty-text">
                        No documents yet —{" "}
                        <strong>drag from the library</strong> or click{" "}
                        <strong>Add</strong> on the right.
                      </div>
                    </div>
                  )}
                  {sec.items.map((item, idx) => (
                    <div key={item.id} className="cp-item">
                      <div className="cp-item-row">
                        <div className="cp-item-num">#{idx + 1}</div>
                        <div className="cp-item-thumb">{CO_ICONS.doc}</div>
                        <div className="cp-item-body">
                          <div className="cp-item-name">{item.name}</div>
                          <div className="cp-item-meta">
                            {fmtSize(item.sizeBytes)}
                          </div>
                          {editingItemId === item.id ? (
                            <div className="cp-item-notes-edit">
                              <textarea
                                className="cp-textarea sm"
                                rows={2}
                                value={draftNotes}
                                onChange={(e) => setDraftNotes(e.target.value)}
                                placeholder="Add notes — visible to the owner."
                                autoFocus
                              />
                              <div className="cp-item-notes-actions">
                                <button
                                  className="cp-btn xs ghost"
                                  onClick={() => {
                                    setEditing(null);
                                    setDraftNotes("");
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="cp-btn xs primary"
                                  onClick={() => saveNotes(item.id)}
                                  disabled={pending}
                                >
                                  {CO_ICONS.check} Save
                                </button>
                              </div>
                            </div>
                          ) : item.notes ? (
                            <button
                              className="cp-item-notes"
                              onClick={() => {
                                if (!pkg.canEdit) return;
                                setEditing(item.id);
                                setDraftNotes(item.notes ?? "");
                              }}
                            >
                              <span className="cp-item-notes-icon">
                                {CO_ICONS.pen}
                              </span>
                              <span className="cp-item-notes-text">
                                {item.notes}
                              </span>
                            </button>
                          ) : pkg.canEdit ? (
                            <button
                              className="cp-item-notes-add"
                              onClick={() => {
                                setEditing(item.id);
                                setDraftNotes("");
                              }}
                            >
                              {CO_ICONS.plus} Add note
                            </button>
                          ) : null}
                        </div>
                        {pkg.canEdit && (
                          <div className="cp-item-actions">
                            <button
                              className="cp-icon-btn"
                              onClick={() => {
                                setEditing(item.id);
                                setDraftNotes(item.notes ?? "");
                              }}
                              title="Edit notes"
                            >
                              {CO_ICONS.edit}
                            </button>
                            <button
                              className="cp-icon-btn danger"
                              onClick={() => removeItem(item.id)}
                              title="Remove from package"
                              disabled={pending}
                            >
                              {CO_ICONS.x}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {activeDragDocId && pkg.canEdit && (
                    <div
                      className={`cp-drop-hint${isDropTarget ? " active" : ""}`}
                    >
                      {CO_ICONS.plus} Drop here to add to{" "}
                      <strong>
                        {sec.sectionType === "other"
                          ? sec.customLabel ?? "Custom"
                          : cfg.label}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {pkg.canEdit && (
            <div className="cp-add-section">
              {!showAddSection ? (
                <button
                  className="cp-btn ghost full"
                  onClick={() => setShowAddSection(true)}
                >
                  {CO_ICONS.plus} Add a section
                </button>
              ) : (
                <div className="cp-add-section-picker">
                  <div className="cp-add-section-hdr">
                    <strong>Choose a section type</strong>
                    <button
                      className="cp-btn xs ghost"
                      onClick={() => setShowAddSection(false)}
                    >
                      {CO_ICONS.x}
                    </button>
                  </div>
                  <div className="cp-add-section-grid">
                    {availableSectionTypes.map((t) => {
                      const cfg = SECTION_CONFIG[t];
                      return (
                        <button
                          key={t}
                          className="cp-add-section-tile"
                          onClick={() => addSectionType(t)}
                          disabled={pending}
                        >
                          <span
                            className="cp-add-section-color"
                            style={{ background: cfg.solid }}
                          />
                          <div className="cp-add-section-name">
                            {cfg.label}
                          </div>
                          <div className="cp-add-section-desc">{cfg.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {pkg.canEdit && (
          <aside className="cp-picker">
            <div className="cp-picker-hdr">
              <div>
                <h3 className="cp-picker-title">
                  {CO_ICONS.folder} Project documents
                </h3>
                <div className="cp-picker-sub">
                  Drag onto a section, or click to add. {usedDocIds.size} of{" "}
                  {totalLibraryDocs} added.
                </div>
              </div>
            </div>
            <div className="cp-picker-search">
              {CO_ICONS.search}
              <input
                type="text"
                placeholder="Search documents…"
                value={docPickerSearch}
                onChange={(e) => setDPS(e.target.value)}
              />
            </div>
            <div className="cp-picker-body">
              {filteredLibrary.map((folder) => (
                <div key={folder.label} className="cp-picker-folder">
                  <button
                    className="cp-picker-folder-hdr"
                    onClick={() =>
                      setPFO((o) => ({
                        ...o,
                        [folder.label]: !o[folder.label],
                      }))
                    }
                  >
                    <span
                      className="cp-picker-folder-chev"
                      data-open={pickerFolderOpen[folder.label]}
                    >
                      {CO_ICONS.chevR}
                    </span>
                    {CO_ICONS.folder}
                    <span className="cp-picker-folder-name">
                      {folder.label}
                    </span>
                    <span className="cp-picker-folder-count">
                      {folder.docs.length}
                    </span>
                  </button>
                  {pickerFolderOpen[folder.label] && (
                    <div className="cp-picker-docs">
                      {folder.docs.map((d) => {
                        const used = usedDocIds.has(d.id);
                        const targetSec = pkg.sections.find(
                          (s) => s.sectionType === d.suggestedSectionType,
                        );
                        return (
                          <div
                            key={d.id}
                            className={`cp-picker-doc${used ? " used" : ""}${
                              activeDragDocId === d.id ? " dragging" : ""
                            }`}
                            draggable={!used}
                            onDragStart={(e) => onDragStart(e, d.id)}
                            onDragEnd={onDragEnd}
                          >
                            <span className="cp-picker-doc-grip">
                              {CO_ICONS.drag}
                            </span>
                            <div>
                              <div className="cp-picker-doc-name">
                                {d.name}
                              </div>
                              <div className="cp-picker-doc-meta">
                                <span>{fmtSize(d.sizeBytes)}</span>
                                {d.suggestedSectionType && !used && (
                                  <span
                                    className="cp-picker-suggest-chip"
                                    style={{
                                      background:
                                        SECTION_CONFIG[d.suggestedSectionType]
                                          .soft,
                                      color:
                                        SECTION_CONFIG[d.suggestedSectionType]
                                          .solid,
                                    }}
                                  >
                                    {CO_ICONS.sparkle}
                                    {SECTION_CONFIG[d.suggestedSectionType]
                                      .short}
                                  </span>
                                )}
                              </div>
                            </div>
                            {used ? (
                              <span className="cp-picker-doc-status">
                                {CO_ICONS.check} Added
                              </span>
                            ) : (
                              <button
                                className="cp-picker-doc-add"
                                onClick={() => {
                                  const sec =
                                    targetSec ?? pkg.sections[0] ?? null;
                                  if (sec) addDocToSection(sec.id, d.id);
                                }}
                                disabled={pkg.sections.length === 0 || pending}
                                title={
                                  targetSec
                                    ? `Add to ${
                                        SECTION_CONFIG[targetSec.sectionType]
                                          .label
                                      }`
                                    : "Add to first section"
                                }
                              >
                                {CO_ICONS.plus}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {filteredLibrary.length === 0 && (
                <div className="cp-empty sm">
                  <div className="cp-empty-sub">No documents match.</div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {showDeliverModal && (
        <div
          className="cp-modal-backdrop"
          onClick={() => setShowDeliver(null)}
        >
          <div className="cp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cp-modal-hdr">
              <div>
                <h2 className="cp-modal-title">
                  {showDeliverModal.target === "review"
                    ? "Move to internal review"
                    : "Deliver to client"}
                </h2>
                <div className="cp-modal-sub">
                  {showDeliverModal.target === "review"
                    ? "Lock further structure changes and route to your team for QA before sending."
                    : (
                      <>
                        Send <strong>{pkg.numberLabel}</strong> to the project
                        client. They&apos;ll get a portal notification and an
                        email link to review and sign off.
                      </>
                    )}
                </div>
              </div>
              <button
                className="cp-btn xs ghost"
                onClick={() => setShowDeliver(null)}
              >
                {CO_ICONS.x}
              </button>
            </div>
            <div className="cp-modal-body">
              <div className="cp-deliver-summary">
                <div className="cp-deliver-row">
                  <span className="cp-deliver-label">Project</span>
                  <span className="cp-deliver-value">{pkg.projectName}</span>
                </div>
                <div className="cp-deliver-row">
                  <span className="cp-deliver-label">Bundle</span>
                  <span className="cp-deliver-value">
                    {pkg.sections.length} sections · {totalItems} documents ·{" "}
                    {fmtSizeBig(totalSize)}
                  </span>
                </div>
              </div>
              <div className="cp-modal-info">
                <span className="cp-modal-info-icon">{CO_ICONS.shield}</span>
                <div>
                  {showDeliverModal.target === "review" ? (
                    <>
                      Moving to review preserves your structure. You&apos;ll
                      still be able to edit notes and swap individual documents
                      until delivery.
                    </>
                  ) : (
                    <>
                      On delivery, an indexed ZIP and PDF cover letter become
                      available to the owner. Until they sign off, the
                      package locks from edits except via &quot;back to
                      building&quot;.
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="cp-modal-ftr">
              <button
                className="cp-btn ghost"
                onClick={() => setShowDeliver(null)}
              >
                Cancel
              </button>
              <button
                className="cp-btn primary"
                onClick={() => moveStatus(showDeliverModal.target)}
                disabled={pending}
              >
                {showDeliverModal.target === "review" ? (
                  <>{CO_ICONS.shield} Move to review</>
                ) : (
                  <>{CO_ICONS.send} Deliver to client</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
