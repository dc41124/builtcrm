import {
  getAnonymousTransmittalByDigest,
  type AnonymousTransmittalView,
} from "@/domain/loaders/transmittals";
import { hashToken } from "@/lib/transmittals/token";

import {
  Icon,
  LogoMark,
  docKind,
  formatBytes,
  formatDateTime,
} from "../../(portal)/transmittals-shared";
import "../../(portal)/transmittals.css";

// Anonymous, tokenized transmittal landing page. Recipients arrive
// via a per-recipient share URL — the token in the URL is hashed and
// looked up against the SHA-256 digest stored on transmittal_recipients.
//
// Failure modes (not found / revoked / expired) all render a neutral
// "link unavailable" card. We deliberately don't distinguish them in
// the UI — the response shouldn't act as a token oracle.

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnonymousTransmittalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = token ? await getAnonymousTransmittalByDigest(hashToken(token)) : null;

  if (!view || view.revoked || view.expired) {
    return (
      <div className="tm-recipient-page">
        <div className="tm-recipient-card">
          <div className="tm-recipient-fail">
            <div className="tm-recipient-fail-icon">{Icon.lock}</div>
            <h2>Link unavailable</h2>
            <p>
              This download link is no longer valid. The sender may have
              revoked it, the token may have expired, or the URL may be
              mistyped. Reach out to the sender for a fresh link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <RecipientCard token={token} view={view} />;
}

function RecipientCard({
  token,
  view,
}: {
  token: string;
  view: AnonymousTransmittalView;
}) {
  // The download href hits the streaming API route; the route writes
  // an access_events row + bumps the recipient's rollups + notifies
  // the sender. We use a plain anchor so the browser handles the file
  // save naturally.
  const downloadHref = `/api/transmittals/access/${encodeURIComponent(token)}`;

  return (
    <div className="tm-recipient-page">
      <div className="tm-recipient-card">
        <div className="tm-recipient-card-hdr">
          <div>
            <div className="tm-recipient-from-label">From</div>
            <div className="tm-recipient-from-name">
              {view.senderOrgName ?? view.sentByName ?? "BuiltCRM"}
            </div>
            <div className="tm-recipient-from-sub">
              Project: <strong>{view.projectName}</strong>
            </div>
          </div>
          <div className="tm-recipient-num-block">
            <div className="tm-recipient-num">{view.numberLabel}</div>
            <div className="tm-recipient-sent">
              Sent {formatDateTime(view.sentAt)}
            </div>
          </div>
        </div>

        <h1 className="tm-recipient-subject">{view.subject}</h1>

        {view.message ? (
          <div className="tm-recipient-msg">{view.message}</div>
        ) : null}

        {view.sentByName ? (
          <div className="tm-recipient-signoff">
            — {view.sentByName}
            {view.senderOrgName ? (
              <>
                <br />
                {view.senderOrgName}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="tm-recipient-bundle">
          <div className="tm-recipient-bundle-hdr">
            <span className="tm-recipient-bundle-title">
              {Icon.zip} Document bundle
            </span>
            <span className="tm-recipient-bundle-meta">
              {view.documents.length}{" "}
              {view.documents.length === 1 ? "file" : "files"} ·{" "}
              {formatBytes(
                view.documents.reduce((s, d) => s + d.sizeBytes, 0),
              )}
            </span>
          </div>
          <div className="tm-recipient-doc-list">
            {view.documents.map((d) => {
              const kind = docKind(d.name);
              return (
                <div key={d.id} className="tm-recipient-doc-row">
                  <div className={`tm-doc-thumb-sm ${kind}`}>{Icon.doc}</div>
                  <div>
                    <div className="tm-recipient-doc-name">{d.name}</div>
                    <div className="tm-recipient-doc-meta">
                      {formatBytes(d.sizeBytes)} ·{" "}
                      {kind === "other" ? "FILE" : kind.toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <a
            href={downloadHref}
            className="tm-btn lg primary tm-recipient-download"
          >
            {Icon.download} Download all as ZIP
            <span className="tm-recipient-download-sub">
              {formatBytes(
                view.documents.reduce((s, d) => s + d.sizeBytes, 0),
              )}{" "}
              ·{" "}
              {view.documents.length}{" "}
              {view.documents.length === 1 ? "file" : "files"}
            </span>
          </a>
        </div>

        <div className="tm-recipient-audit">
          <div className="tm-recipient-audit-icon">{Icon.eye}</div>
          <div>
            <strong>This download is logged.</strong> The sender is
            notified when you download and sees your source IP and
            browser. This link is bound to your email address and
            shouldn&apos;t be shared.
          </div>
        </div>

        <div className="tm-recipient-footer">
          <div className="tm-recipient-footer-brand">
            <LogoMark />
            <span>Delivered securely by BuiltCRM</span>
          </div>
          <div className="tm-recipient-footer-sub">
            Token verified · Revocable by sender
          </div>
        </div>
      </div>
    </div>
  );
}
