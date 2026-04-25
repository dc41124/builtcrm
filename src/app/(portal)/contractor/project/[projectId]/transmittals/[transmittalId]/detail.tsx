"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type {
  TransmittalAccessEventRow,
  TransmittalDetail,
} from "@/domain/loaders/transmittals";

import {
  Icon,
  STATUS_LABEL,
  docKind,
  formatBytes,
  formatDateTime,
  initials,
} from "../../../../../transmittals-shared";

type Tab = "recipients" | "documents" | "access_log";

// Per-recipient share URL captured in memory after a regenerate. Plaintext
// only ever exists in this map; reloading the page wipes it. The DB
// stores the digest only.
type EphemeralShareUrls = Record<string, string>;

const SESSION_STORAGE_KEY_PREFIX = "tm-share-urls:";

export function TransmittalDetailUI({
  projectId,
  detail,
}: {
  projectId: string;
  detail: TransmittalDetail;
}) {
  const router = useRouter();
  const portalBase = `/contractor/project/${projectId}`;
  const [tab, setTab] = useState<Tab>("recipients");
  const [shareUrls, setShareUrls] = useState<EphemeralShareUrls>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Hydrate share URLs from session storage. The send response stashes
  // them there so they survive the post-send navigation but die when
  // the tab closes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = SESSION_STORAGE_KEY_PREFIX + detail.id;
    try {
      const stashed = sessionStorage.getItem(key);
      if (stashed) {
        setShareUrls(JSON.parse(stashed));
      }
    } catch {
      // ignore — corrupt storage is non-fatal here
    }
  }, [detail.id]);

  const persistShareUrls = (next: EphemeralShareUrls) => {
    setShareUrls(next);
    if (typeof window !== "undefined") {
      const key = SESSION_STORAGE_KEY_PREFIX + detail.id;
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage may be disabled — fall back to in-memory only.
      }
    }
  };

  const copyShareUrl = async (recipientId: string, url: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(recipientId);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const regenerateShareUrl = async (recipientId: string) => {
    setBusyId(recipientId);
    try {
      const res = await fetch(
        `/api/transmittals/${detail.id}/recipients/${recipientId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "regenerate" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "Failed to regenerate");
        return;
      }
      const body = (await res.json()) as { shareUrl: string };
      persistShareUrls({ ...shareUrls, [recipientId]: body.shareUrl });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const revokeRecipient = async (recipientId: string, name: string) => {
    if (
      !window.confirm(
        `Revoke access for ${name}? Their share URL will stop working immediately.`,
      )
    ) {
      return;
    }
    setBusyId(recipientId);
    try {
      const res = await fetch(
        `/api/transmittals/${detail.id}/recipients/${recipientId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revoke" }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "Failed to revoke");
        return;
      }
      // Drop the session-stashed URL too — it's worthless now.
      const next = { ...shareUrls };
      delete next[recipientId];
      persistShareUrls(next);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const totalAccepted = detail.recipients.filter(
    (r) => r.status === "downloaded",
  ).length;

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
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="tm-btn sm ghost"
            onClick={() =>
              window.alert(
                "Cover-letter PDF generation lands with the closeout-package PDF infra (Step 48). For now, copy the subject + message into your own template.",
              )
            }
            title="Coming with Step 48"
          >
            {Icon.download} Download cover letter
          </button>
        </div>
      </div>

      <div className="tm-detail-hdr">
        <div className="tm-detail-hdr-top">
          <span className={`tm-status-pill ${detail.status}`}>
            {Icon.check} {STATUS_LABEL[detail.status]}
          </span>
          <span className="tm-detail-num">{detail.numberLabel}</span>
          <span className="tm-detail-sent">
            {Icon.send}
            {detail.sentByName ? (
              <>
                Sent by {detail.sentByName} · {formatDateTime(detail.sentAt)}
              </>
            ) : (
              <>Sent {formatDateTime(detail.sentAt)}</>
            )}
          </span>
        </div>
        <h2 className="tm-detail-subject">{detail.subject}</h2>
        {detail.message ? (
          <p className="tm-detail-msg">{detail.message}</p>
        ) : null}
        <div className="tm-detail-stat-row">
          <div>
            <div className="tm-detail-stat-label">Recipients</div>
            <div className="tm-detail-stat-value">{detail.recipientCount}</div>
          </div>
          <div>
            <div className="tm-detail-stat-label">Downloaded</div>
            <div className="tm-detail-stat-value">
              {totalAccepted}
              <span className="tm-detail-stat-denom">
                /{detail.recipientCount}
              </span>
            </div>
          </div>
          <div>
            <div className="tm-detail-stat-label">Total downloads</div>
            <div className="tm-detail-stat-value">{detail.totalDownloads}</div>
          </div>
          <div>
            <div className="tm-detail-stat-label">Documents</div>
            <div className="tm-detail-stat-value">{detail.docCount}</div>
          </div>
          <div>
            <div className="tm-detail-stat-label">Bundle size</div>
            <div className="tm-detail-stat-value">
              {formatBytes(detail.totalSizeBytes)}
            </div>
          </div>
        </div>
      </div>

      <div className="tm-stub-note">
        <div className="tm-stub-note-icon">{Icon.mail}</div>
        <div>
          <strong>Email delivery is stubbed.</strong> Per-recipient secure
          download URLs appear in the Recipients tab the first time you send
          (and on every Resend). Copy and send from your own email client.
          Downloads are logged either way.
        </div>
      </div>

      <div className="tm-detail-tabs">
        <button
          type="button"
          className={`tm-detail-tab${tab === "recipients" ? " active" : ""}`}
          onClick={() => setTab("recipients")}
        >
          {Icon.user} Recipients
          <span className="tm-detail-tab-count">
            {detail.recipients.length}
          </span>
        </button>
        <button
          type="button"
          className={`tm-detail-tab${tab === "documents" ? " active" : ""}`}
          onClick={() => setTab("documents")}
        >
          {Icon.doc} Documents
          <span className="tm-detail-tab-count">
            {detail.documents.length}
          </span>
        </button>
        <button
          type="button"
          className={`tm-detail-tab${tab === "access_log" ? " active" : ""}`}
          onClick={() => setTab("access_log")}
        >
          {Icon.eye} Access log
          <span className="tm-detail-tab-count">
            {detail.accessEvents.length}
          </span>
        </button>
      </div>

      {tab === "recipients" ? (
        <div className="tm-recip-list">
          {detail.recipients.map((r) => {
            const shareUrl = shareUrls[r.id] ?? null;
            const busy = busyId === r.id;
            return (
              <div key={r.id} className={`tm-recip-row ${r.status}`}>
                <div className="tm-recip-avatar">{initials(r.name)}</div>
                <div>
                  <div className="tm-recip-name-row">
                    <span className="tm-recip-name">{r.name}</span>
                    {r.orgLabel ? (
                      <span className="tm-recip-org">· {r.orgLabel}</span>
                    ) : null}
                  </div>
                  <div className="tm-recip-email">{r.email}</div>
                  <div className="tm-recip-share">
                    <span className="tm-recip-share-label">
                      {Icon.link} Share URL
                    </span>
                    {r.status === "revoked" ? (
                      <span className="tm-recip-share-empty">
                        Revoked — link disabled
                      </span>
                    ) : shareUrl ? (
                      <>
                        <code className="tm-recip-share-url">{shareUrl}</code>
                        <button
                          type="button"
                          className={`tm-btn xs ghost${copiedId === r.id ? " copied" : ""}`}
                          onClick={() => copyShareUrl(r.id, shareUrl)}
                        >
                          {copiedId === r.id ? (
                            <>
                              {Icon.check} Copied
                            </>
                          ) : (
                            <>
                              {Icon.copy} Copy
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="tm-recip-share-empty">
                        Plaintext URL is gone — click Resend to mint a fresh
                        link.
                      </span>
                    )}
                  </div>
                </div>
                <div className="tm-recip-right">
                  {r.status === "downloaded" ? (
                    <>
                      <span className="tm-recip-status downloaded">
                        {Icon.check} Downloaded
                      </span>
                      <div className="tm-recip-status-sub">
                        {r.totalDownloads}{" "}
                        {r.totalDownloads === 1 ? "download" : "downloads"}
                      </div>
                      <div className="tm-recip-status-sub tertiary">
                        Last: {formatDateTime(r.lastDownloadedAt)}
                      </div>
                    </>
                  ) : r.status === "revoked" ? (
                    <>
                      <span className="tm-recip-status revoked">
                        {Icon.x} Revoked
                      </span>
                      <div className="tm-recip-status-sub tertiary">
                        Access disabled
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="tm-recip-status pending">
                        {Icon.clock} Pending
                      </span>
                      <div className="tm-recip-status-sub tertiary">
                        Not yet opened
                      </div>
                    </>
                  )}
                  <div className="tm-recip-actions">
                    <button
                      type="button"
                      className="tm-recip-action"
                      title="Generate fresh share URL"
                      aria-label="Resend"
                      onClick={() => regenerateShareUrl(r.id)}
                      disabled={busy || r.status === "revoked"}
                    >
                      {Icon.send}
                    </button>
                    <button
                      type="button"
                      className="tm-recip-action danger"
                      title="Revoke access"
                      aria-label="Revoke"
                      onClick={() => revokeRecipient(r.id, r.name)}
                      disabled={busy || r.status === "revoked"}
                    >
                      {Icon.x}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="tm-docs">
          <div className="tm-docs-hdr">
            <div>
              <strong>{detail.documents.length}</strong> documents ·{" "}
              {formatBytes(detail.totalSizeBytes)} bundle
            </div>
          </div>
          <div className="tm-docs-grid">
            {detail.documents.map((d, idx) => {
              const kind = docKind(d.name);
              return (
                <div key={d.id} className="tm-doc-tile">
                  <div className={`tm-doc-thumb ${kind}`}>
                    {Icon.doc}
                    <span className="tm-doc-kind">{kind.toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="tm-doc-name">{d.name}</div>
                    <div className="tm-doc-meta">
                      {formatBytes(d.sizeBytes)}
                    </div>
                  </div>
                  <div className="tm-doc-order">#{idx + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "access_log" ? (
        <div className="tm-log">
          <div className="tm-log-hdr">
            <h3>Access log</h3>
            <div className="tm-log-sub">
              Every download is recorded with timestamp, source IP, and user
              agent. Tokens are validated against SHA-256 digests — plaintext
              is never stored.
            </div>
          </div>
          {detail.accessEvents.length === 0 ? (
            <div className="tm-log-empty">
              No downloads yet. Activity will appear here when a recipient
              opens their share URL.
            </div>
          ) : (
            <div className="tm-log-table">
              <div className="tm-log-table-head">
                <span>When</span>
                <span>Recipient</span>
                <span>Source IP</span>
                <span>User agent</span>
              </div>
              {detail.accessEvents.map((e) => (
                <AccessRow key={e.id} row={e} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function AccessRow({ row }: { row: TransmittalAccessEventRow }) {
  return (
    <div className="tm-log-row">
      <span className="tm-log-when">
        {Icon.clock}
        {formatDateTime(row.downloadedAt)}
      </span>
      <span className="tm-log-who">
        <span className="tm-log-who-avatar">
          {initials(row.recipientName)}
        </span>
        <div>
          <div className="tm-log-who-name">{row.recipientName}</div>
          <div className="tm-log-who-org">
            {row.orgLabel ?? row.recipientEmail}
          </div>
        </div>
      </span>
      <span className="tm-log-ip">
        <code>{row.ipAddress ?? "—"}</code>
      </span>
      <span className="tm-log-ua">{row.userAgent ?? "—"}</span>
    </div>
  );
}
