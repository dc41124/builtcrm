"use client";

import { useMemo, useState } from "react";

import {
  Icon,
  docKind,
  formatBytes,
} from "../../../../transmittals-shared";
import type { ProjectDocPick } from "./workspace";

type RecipientDraft = {
  key: string;
  name: string;
  email: string;
  orgLabel: string;
};

const FOLDER_OTHER = "Other documents";

export function CreateTransmittalModal({
  open,
  onClose,
  projectId,
  projectDocs,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectDocs: ProjectDocPick[];
  onCreated: (transmittalId: string, sent: boolean) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<RecipientDraft[]>([
    { key: "r1", name: "", email: "", orgLabel: "" },
  ]);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group docs by category so the picker mirrors the JSX prototype.
  const folders = useMemo(() => {
    const groups = new Map<string, ProjectDocPick[]>();
    for (const d of projectDocs) {
      const folder = friendlyFolderName(d.category);
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(d);
    }
    const ordered = Array.from(groups.entries()).sort(([a], [b]) => {
      // Drawings + specs near the top — those are the most common
      // transmittal payloads.
      const order = (s: string) => {
        const lower = s.toLowerCase();
        if (lower.includes("drawing")) return 0;
        if (lower.includes("spec")) return 1;
        if (lower.includes("submittal")) return 2;
        if (lower.includes("rfi") || lower.includes("change")) return 3;
        if (s === FOLDER_OTHER) return 99;
        return 4;
      };
      return order(a) - order(b);
    });
    return ordered.map(([folder, docs]) => ({
      folder,
      docs: docs.sort((x, y) => x.title.localeCompare(y.title)),
    }));
  }, [projectDocs]);

  const totalSelectedBytes = useMemo(() => {
    let bytes = 0;
    for (const d of projectDocs) {
      if (selectedDocs.has(d.id)) bytes += d.sizeBytes;
    }
    return bytes;
  }, [selectedDocs, projectDocs]);

  if (!open) return null;

  const addRecipient = () =>
    setRecipients((rs) => [
      ...rs,
      { key: `r${Date.now()}`, name: "", email: "", orgLabel: "" },
    ]);

  const removeRecipient = (key: string) =>
    setRecipients((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.key !== key)));

  const updateRecipient = (
    key: string,
    field: "name" | "email" | "orgLabel",
    value: string,
  ) =>
    setRecipients((rs) =>
      rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );

  const toggleDoc = (id: string) =>
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleFolder = (folder: string) =>
    setFolderOpen((prev) => ({
      ...prev,
      [folder]: !(prev[folder] ?? true),
    }));

  const validRecipients = recipients
    .map((r) => ({
      name: r.name.trim(),
      email: r.email.trim(),
      orgLabel: r.orgLabel.trim() || null,
    }))
    .filter((r) => r.email.length > 0);

  const canSend =
    subject.trim().length > 0 &&
    validRecipients.length > 0 &&
    selectedDocs.size > 0;

  const submit = async (sendNow: boolean) => {
    if (sendNow && !canSend) {
      setError(
        "Need a subject, at least one recipient, and at least one attached document.",
      );
      return;
    }
    if (!sendNow && !subject.trim()) {
      setError("A draft still needs a subject.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Create the draft first.
      const createRes = await fetch("/api/transmittals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          subject: subject.trim(),
          message: message.trim(),
          recipients: validRecipients.map((r) => ({
            name: r.name || r.email.split("@")[0]!,
            email: r.email,
            orgLabel: r.orgLabel,
          })),
          documentIds: Array.from(selectedDocs),
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "Failed to create transmittal.");
        return;
      }
      const created = (await createRes.json()) as { id: string };

      if (!sendNow) {
        onCreated(created.id, false);
        return;
      }

      // Send immediately.
      const sendRes = await fetch(
        `/api/transmittals/${created.id}/send`,
        { method: "POST" },
      );
      if (!sendRes.ok) {
        const body = await sendRes.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "Failed to send transmittal.");
        // The draft still exists — caller can navigate to the draft to
        // edit and retry.
        onCreated(created.id, false);
        return;
      }
      // Stash the per-recipient share URLs in sessionStorage so the
      // detail page can render them. This is the ONLY time plaintext
      // tokens exist in the browser; sessionStorage dies when the tab
      // closes. Treat as a one-shot pass-through, not a cache.
      const sendBody = (await sendRes.json()) as {
        shareUrls?: Array<{ recipientId: string; shareUrl: string }>;
      };
      if (sendBody.shareUrls && typeof window !== "undefined") {
        const map: Record<string, string> = {};
        for (const u of sendBody.shareUrls) {
          map[u.recipientId] = u.shareUrl;
        }
        try {
          sessionStorage.setItem(
            `tm-share-urls:${created.id}`,
            JSON.stringify(map),
          );
        } catch {
          // ignore — non-fatal
        }
      }
      onCreated(created.id, true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="tm-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="tm-modal">
        <div className="tm-modal-hdr">
          <div>
            <h2 className="tm-modal-title">New transmittal</h2>
            <div className="tm-modal-sub">
              Number assigned on send · Project-scoped
            </div>
          </div>
          <button
            type="button"
            className="tm-btn xs ghost"
            onClick={onClose}
            aria-label="Close"
          >
            {Icon.x}
          </button>
        </div>
        <div className="tm-modal-body">
          <label className="tm-field">
            <span className="tm-field-label">Subject</span>
            <input
              type="text"
              className="tm-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. IFC set — Floor 2 framing"
              maxLength={300}
              autoFocus
            />
          </label>
          <label className="tm-field">
            <span className="tm-field-label">Cover message</span>
            <textarea
              className="tm-textarea"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why are you sending this? What should recipients do with it?"
              maxLength={8000}
            />
          </label>

          <div className="tm-create-section">
            <div className="tm-create-section-hdr">
              <span className="tm-field-label">{Icon.user} Recipients</span>
              <button
                type="button"
                className="tm-btn xs ghost"
                onClick={addRecipient}
              >
                {Icon.plus} Add row
              </button>
            </div>
            <div className="tm-create-recipients">
              {recipients.map((r) => (
                <div key={r.key} className="tm-create-recipient-row">
                  <input
                    type="text"
                    className="tm-input sm"
                    placeholder="Full name"
                    value={r.name}
                    maxLength={160}
                    onChange={(e) =>
                      updateRecipient(r.key, "name", e.target.value)
                    }
                  />
                  <input
                    type="email"
                    className="tm-input sm"
                    placeholder="email@company.com"
                    value={r.email}
                    maxLength={255}
                    onChange={(e) =>
                      updateRecipient(r.key, "email", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="tm-btn xs ghost"
                    onClick={() => removeRecipient(r.key)}
                    disabled={recipients.length === 1}
                    title="Remove row"
                    aria-label="Remove row"
                  >
                    {Icon.trash}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="tm-create-section">
            <div className="tm-create-section-hdr">
              <span className="tm-field-label">{Icon.doc} Attach documents</span>
              <div className="tm-create-section-sub">
                {selectedDocs.size} selected
                {selectedDocs.size > 0 ? (
                  <> · {formatBytes(totalSelectedBytes)}</>
                ) : null}
              </div>
            </div>
            <div className="tm-doc-picker">
              {folders.length === 0 ? (
                <div
                  style={{
                    padding: "20px 12px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 12.5,
                  }}
                >
                  No documents on this project. Upload through the Documents
                  module first, then come back to attach them.
                </div>
              ) : (
                folders.map(({ folder, docs }) => {
                  const isOpen = folderOpen[folder] ?? true;
                  return (
                    <div key={folder} className="tm-doc-folder">
                      <button
                        type="button"
                        className="tm-doc-folder-hdr"
                        onClick={() => toggleFolder(folder)}
                      >
                        <span
                          className="tm-doc-folder-chevron"
                          data-open={isOpen}
                        >
                          {Icon.chevR}
                        </span>
                        {Icon.folder}
                        <span className="tm-doc-folder-name">{folder}</span>
                        <span className="tm-doc-folder-count">
                          {docs.length}
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="tm-doc-folder-body">
                          {docs.map((d) => {
                            const selected = selectedDocs.has(d.id);
                            return (
                              <label
                                key={d.id}
                                className={`tm-doc-picker-row${selected ? " selected" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleDoc(d.id)}
                                />
                                <span className="tm-doc-picker-name">
                                  {d.title}
                                </span>
                                <span className="tm-doc-picker-size">
                                  {formatBytes(d.sizeBytes)} ·{" "}
                                  {docKind(d.title).toUpperCase()}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error ? (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--er-soft)",
                color: "var(--er)",
                borderRadius: 7,
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
        <div className="tm-modal-ftr">
          <div className="tm-modal-ftr-left">
            {Icon.shield}
            <span>Tokens generated on send. Plaintext never stored.</span>
          </div>
          <div className="tm-modal-ftr-right">
            <button
              type="button"
              className="tm-btn ghost sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tm-btn sm"
              onClick={() => submit(false)}
              disabled={submitting || !subject.trim()}
            >
              {Icon.edit} Save draft
            </button>
            <button
              type="button"
              className="tm-btn primary sm"
              disabled={submitting || !canSend}
              onClick={() => submit(true)}
            >
              {Icon.send} {submitting ? "Sending…" : "Send transmittal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function friendlyFolderName(category: string): string {
  // Map document_category enum values onto human folder names that
  // mirror the JSX prototype's Drawings/Specs/Cover-Letters layout.
  const lookup: Record<string, string> = {
    drawing_set: "Drawings",
    drawing_sheet: "Drawings",
    submittal: "Submittals",
    submittal_response: "Submittals",
    spec: "Specifications",
    rfi: "Correspondence / RFIs",
    rfi_response: "Correspondence / RFIs",
    change_order: "Change Orders",
    daily_log_photo: "Daily Logs",
    inspection_photo: "Inspections",
    contract: "Contracts",
    insurance: "Compliance",
    permit: "Permits",
    cover_letter: "Cover Letters",
    other: FOLDER_OTHER,
  };
  return lookup[category] ?? toTitle(category);
}

function toTitle(s: string): string {
  return s
    .split(/[_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
