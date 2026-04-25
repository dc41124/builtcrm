"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { TransmittalDetail } from "@/domain/loaders/transmittals";

import {
  Icon,
  docKind,
  formatBytes,
  initials,
} from "../../../../../../transmittals-shared";

export type ProjectDocPick = {
  id: string;
  title: string;
  category: string;
  sizeBytes: number;
};

type RecipientDraft = {
  // Existing rows have a server id; new rows have id === null.
  id: string | null;
  key: string;
  name: string;
  email: string;
  orgLabel: string;
};

const FOLDER_OTHER = "Other documents";

export function TransmittalDraftEditor({
  projectId,
  detail,
  projectDocs,
}: {
  projectId: string;
  detail: TransmittalDetail;
  projectDocs: ProjectDocPick[];
}) {
  const router = useRouter();
  const portalBase = `/contractor/project/${projectId}`;

  const [subject, setSubject] = useState(detail.subject);
  const [message, setMessage] = useState(detail.message);
  const [recipients, setRecipients] = useState<RecipientDraft[]>(() => {
    if (detail.recipients.length === 0) {
      return [{ id: null, key: "r-new-0", name: "", email: "", orgLabel: "" }];
    }
    return detail.recipients.map((r) => ({
      id: r.id,
      key: r.id,
      name: r.name,
      email: r.email,
      orgLabel: r.orgLabel ?? "",
    }));
  });
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(
    new Set(detail.documents.map((d) => d.documentId)),
  );
  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const folders = useMemo(() => {
    const groups = new Map<string, ProjectDocPick[]>();
    for (const d of projectDocs) {
      const folder = friendlyFolderName(d.category);
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(d);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => folderRank(a) - folderRank(b))
      .map(([folder, docs]) => ({
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

  const validRecipients = recipients.filter((r) => r.email.trim().length > 0);
  const canSend =
    subject.trim().length > 0 &&
    validRecipients.length > 0 &&
    selectedDocs.size > 0;

  const onChange = () => setDirty(true);

  const addRecipient = () => {
    setRecipients((rs) => [
      ...rs,
      {
        id: null,
        key: `r-new-${Date.now()}`,
        name: "",
        email: "",
        orgLabel: "",
      },
    ]);
    onChange();
  };

  const removeRecipient = (key: string) => {
    setRecipients((rs) =>
      rs.length === 1 ? rs : rs.filter((r) => r.key !== key),
    );
    onChange();
  };

  const updateRecipient = (
    key: string,
    field: "name" | "email" | "orgLabel",
    value: string,
  ) => {
    setRecipients((rs) =>
      rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
    onChange();
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onChange();
  };

  const toggleFolder = (folder: string) =>
    setFolderOpen((prev) => ({ ...prev, [folder]: !(prev[folder] ?? true) }));

  const persistDraft = async (): Promise<boolean> => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/transmittals/${detail.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          recipients: validRecipients.map((r) => ({
            id: r.id ?? null,
            name: (r.name.trim() || r.email.split("@")[0]!) as string,
            email: r.email.trim(),
            orgLabel: r.orgLabel.trim() || null,
          })),
          documentIds: Array.from(selectedDocs),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "Failed to save draft.");
        return false;
      }
      setDirty(false);
      return true;
    } finally {
      setSubmitting(false);
    }
  };

  const saveAndClose = async () => {
    const ok = await persistDraft();
    if (ok) {
      router.push(`${portalBase}/transmittals`);
      router.refresh();
    }
  };

  const sendNow = async () => {
    if (!canSend) {
      setError(
        "Need a subject, at least one recipient, and at least one attached document.",
      );
      return;
    }
    if (dirty) {
      const ok = await persistDraft();
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/transmittals/${detail.id}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "Failed to send transmittal.");
        return;
      }
      const body = (await res.json()) as {
        shareUrls?: Array<{ recipientId: string; shareUrl: string }>;
      };
      if (body.shareUrls && typeof window !== "undefined") {
        const map: Record<string, string> = {};
        for (const u of body.shareUrls) {
          map[u.recipientId] = u.shareUrl;
        }
        try {
          sessionStorage.setItem(
            `tm-share-urls:${detail.id}`,
            JSON.stringify(map),
          );
        } catch {
          // ignore
        }
      }
      router.push(`${portalBase}/transmittals/${detail.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const discard = async () => {
    if (
      !window.confirm(
        "Discard this draft? This cannot be undone.",
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/transmittals/${detail.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "Failed to discard draft.");
        return;
      }
      router.push(`${portalBase}/transmittals`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="tm-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href={`${portalBase}/transmittals`}
            className="tm-btn sm ghost"
          >
            {Icon.back} Back
          </Link>
          <div className="tm-crumbs">
            <span>Transmittals</span>
            {Icon.chevR}
            <strong>{detail.numberLabel}</strong>
            <span className="tm-crumb-chip">Draft</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="tm-btn sm ghost"
            onClick={discard}
            disabled={submitting}
          >
            {Icon.trash} Discard draft
          </button>
          <button
            type="button"
            className="tm-btn sm ghost"
            onClick={saveAndClose}
            disabled={submitting || !subject.trim()}
          >
            {dirty ? "Save & close" : "Saved"}
          </button>
          <button
            type="button"
            className="tm-btn sm primary"
            onClick={sendNow}
            disabled={submitting || !canSend}
          >
            {Icon.send} {submitting ? "Sending…" : "Send now"}
          </button>
        </div>
      </div>

      <div className="tm-draft-note">
        <span className="tm-draft-note-icon">{Icon.edit}</span>
        <div>
          <strong>This transmittal is a draft.</strong> No recipients have
          been notified. Tokens aren&apos;t generated until send. The audit
          trail records the draft activity, but the formal sequential number
          is assigned only on send.
        </div>
      </div>

      <div className="tm-draft-form">
        <label className="tm-field">
          <span className="tm-field-label">Subject</span>
          <input
            type="text"
            className="tm-input"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              onChange();
            }}
            placeholder="e.g. Floor 2 framing shop drawings — Rev 3 for field"
            maxLength={300}
          />
        </label>
        <label className="tm-field">
          <span className="tm-field-label">Cover message</span>
          <textarea
            className="tm-textarea"
            rows={6}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              onChange();
            }}
            placeholder="What is this transmittal covering? What do recipients need to do?"
            maxLength={8000}
          />
        </label>

        <div className="tm-draft-meta-grid">
          <div className="tm-draft-meta-card">
            <div className="tm-draft-meta-hdr">
              <span className="tm-draft-meta-label">
                {Icon.user} Recipients
              </span>
              <button
                type="button"
                className="tm-btn xs ghost"
                onClick={addRecipient}
                disabled={submitting}
              >
                {Icon.plus} Add
              </button>
            </div>
            <div className="tm-draft-recipient-list">
              {recipients.map((r) => (
                <div key={r.key} className="tm-draft-recipient-row">
                  <div className="tm-draft-recipient-avatar">
                    {initials(r.name || r.email || "?")}
                  </div>
                  <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
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
                    <input
                      type="text"
                      className="tm-input sm"
                      placeholder="Company (optional)"
                      value={r.orgLabel}
                      maxLength={160}
                      onChange={(e) =>
                        updateRecipient(r.key, "orgLabel", e.target.value)
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="tm-btn xs ghost"
                    onClick={() => removeRecipient(r.key)}
                    disabled={recipients.length === 1 || submitting}
                    title="Remove"
                    aria-label="Remove"
                  >
                    {Icon.x}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="tm-draft-meta-card">
            <div className="tm-draft-meta-hdr">
              <span className="tm-draft-meta-label">
                {Icon.doc} Documents
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--text-tertiary)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {selectedDocs.size} selected
                {selectedDocs.size > 0 ? (
                  <> · {formatBytes(totalSelectedBytes)}</>
                ) : null}
              </span>
            </div>
            <div className="tm-doc-picker" style={{ maxHeight: 320 }}>
              {folders.length === 0 ? (
                <div
                  style={{
                    padding: "20px 12px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 12.5,
                  }}
                >
                  No documents on this project yet.
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
        </div>

        <div className="tm-draft-summary">
          <span className="tm-draft-summary-item">
            {Icon.user} <strong>{validRecipients.length}</strong>{" "}
            {validRecipients.length === 1 ? "recipient" : "recipients"}
          </span>
          <span className="tm-draft-summary-item">
            {Icon.doc} <strong>{selectedDocs.size}</strong>{" "}
            {selectedDocs.size === 1 ? "doc" : "docs"} ·{" "}
            {formatBytes(totalSelectedBytes)}
          </span>
          <span className="tm-draft-summary-item">
            {Icon.shield} Tokens generated at send
          </span>
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
    </>
  );
}

function friendlyFolderName(category: string): string {
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

function folderRank(s: string): number {
  const lower = s.toLowerCase();
  if (lower.includes("drawing")) return 0;
  if (lower.includes("spec")) return 1;
  if (lower.includes("submittal")) return 2;
  if (lower.includes("rfi") || lower.includes("change")) return 3;
  if (s === FOLDER_OTHER) return 99;
  return 4;
}

function toTitle(s: string): string {
  return s
    .split(/[_\s]+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
