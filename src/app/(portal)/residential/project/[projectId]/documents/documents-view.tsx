"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DocumentRow } from "@/domain/loaders/project-home";
import type { LinkableItem } from "@/domain/loaders/documents";

type Props = {
  projectId: string;
  currentUserId: string;
  canWrite: boolean;
  documents: DocumentRow[];
  linkableItems: LinkableItem[];
};

// Category definitions matching prototype sidebar
const CATEGORIES = [
  { id: "all", label: "All files" },
  { id: "contract", label: "Contract & agreement", keywords: ["contract", "agreement", "scope_of_work"] },
  { id: "drawings", label: "Drawings & plans", keywords: ["drawing", "plan", "elevation", "layout"] },
  { id: "permits", label: "Permits", keywords: ["permit"] },
  { id: "selections", label: "Selections", keywords: ["selection", "confirmation"] },
  { id: "yours", label: "Your uploads", keywords: [] },
];

function catFor(doc: DocumentRow, currentUserId: string): string {
  if (doc.uploadedByUserId === currentUserId) return "yours";
  const t = `${doc.documentType} ${doc.title}`.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.id === "all" || c.id === "yours") continue;
    if (c.keywords?.some((k) => t.includes(k))) return c.id;
  }
  return "all";
}

function extIcon(title: string, storageKey: string): "pdf" | "dwg" {
  const ext = (storageKey || title).toLowerCase().split(".").pop() ?? "";
  if (ext === "dwg" || ext === "dxf") return "dwg";
  return "pdf";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtSize(key: string): string {
  const segs = key.split("/");
  const last = segs[segs.length - 1] ?? "";
  if (last.includes(".")) return "—";
  return "—";
}

export function ResidentialDocumentsView({
  projectId,
  currentUserId,
  canWrite,
  documents,
  linkableItems,
}: Props) {
  const router = useRouter();
  const [selCat, setSelCat] = useState("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const builderDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.uploadedByUserId !== currentUserId && !d.isSuperseded,
      ),
    [documents, currentUserId],
  );
  const ownerDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.uploadedByUserId === currentUserId && !d.isSuperseded,
      ),
    [documents, currentUserId],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const active = documents.filter((d) => !d.isSuperseded);
    counts.set("all", active.length);
    counts.set("yours", ownerDocs.length);
    for (const d of builderDocs) {
      const cat = catFor(d, currentUserId);
      if (cat !== "all" && cat !== "yours") {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return counts;
  }, [documents, builderDocs, ownerDocs, currentUserId]);

  const filteredBuilder = useMemo(() => {
    if (selCat === "all") return builderDocs;
    if (selCat === "yours") return [];
    return builderDocs.filter((d) => catFor(d, currentUserId) === selCat);
  }, [builderDocs, selCat, currentUserId]);

  const showOwner = selCat === "all" || selCat === "yours";

  async function downloadDoc(docId: string) {
    const res = await fetch(`/api/files/${docId}`);
    if (!res.ok) return;
    const body = (await res.json()) as { downloadUrl: string };
    window.open(body.downloadUrl, "_blank", "noopener");
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const presignRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          documentType: "owner_upload",
        }),
      });
      if (!presignRes.ok) throw new Error("presign_failed");
      const presign = (await presignRes.json()) as {
        uploadUrl: string;
        storageKey: string;
        headers: Record<string, string>;
      };
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      if (!putRes.ok) throw new Error("put_failed");
      const finalRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey: presign.storageKey,
          title: file.name,
          documentType: "owner_upload",
          visibilityScope: "client_visible",
          audienceScope: "client",
        }),
      });
      if (!finalRes.ok) throw new Error("finalize_failed");
      router.refresh();
    } catch {
      // swallow — could show error UI
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="rdoc">
      <div className="rdoc-head">
        <div className="rdoc-title">Documents</div>
        <div className="rdoc-sub">
          Important files for your project. Your builder shares key documents
          here, and you can upload things they&apos;ve asked for too.
        </div>
      </div>

      {/* ── Upload zone ── */}
      {canWrite ? (
        <div
          className="rdoc-upz"
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleUpload(f);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          <div className="rdoc-upz-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h4>{uploading ? "Uploading…" : "Upload your documents"}</h4>
          <p>Drag and drop files here, or click to browse</p>
          <div className="rdoc-upz-hints">
            <span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
              PDF, JPG, PNG
            </span>
            <span>Max 25 MB per file</span>
          </div>
        </div>
      ) : null}

      {/* ── Category sidebar + file list ── */}
      <div className="rdoc-lay">
        <div className="rdoc-cats">
          <div className="rdoc-dc-title">Categories</div>
          {CATEGORIES.map((c) => {
            const count = categoryCounts.get(c.id) ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                className={`rdoc-dc${selCat === c.id ? " on" : ""}`}
                onClick={() => setSelCat(c.id)}
              >
                {c.label} <span className="rdoc-cnt">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="rdoc-files">
          {/* Shared by your builder */}
          {(selCat !== "yours") && (
            <>
              <div className="rdoc-section-label">Shared by your builder</div>
              {filteredBuilder.length === 0 ? (
                <div className="rdoc-empty">No documents in this category yet.</div>
              ) : (
                <div className="rdoc-list">
                  {filteredBuilder.map((d) => {
                    const icon = extIcon(d.title, d.storageKey);
                    return (
                      <div key={d.id} className="rdoc-dr">
                        <div className={`rdoc-di ${icon}`}>
                          {icon === "pdf" ? "PDF" : "DWG"}
                        </div>
                        <div className="rdoc-d-info">
                          <div className="rdoc-d-name">{d.title}</div>
                          <div className="rdoc-d-meta">
                            <span>{d.documentType.replace(/_/g, " ")}</span>
                            <span>·</span>
                            <span>Shared {fmtDate(d.createdAt)}</span>
                          </div>
                        </div>
                        <div className="rdoc-d-acts">
                          <button
                            type="button"
                            className="rdoc-btn-sm"
                            onClick={() => downloadDoc(d.id)}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Your uploads */}
          {showOwner && (
            <div className="rdoc-you-up">
              <div className="rdoc-you-up-lbl">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17,8 12,3 7,8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Uploaded by you
              </div>
              {ownerDocs.length === 0 ? (
                <div className="rdoc-empty">
                  You haven&apos;t uploaded any documents yet.
                </div>
              ) : (
                <div className="rdoc-list">
                  {ownerDocs.map((d) => (
                    <div key={d.id} className="rdoc-dr owner">
                      <div className="rdoc-di pdf">PDF</div>
                      <div className="rdoc-d-info">
                        <div className="rdoc-d-name">{d.title}</div>
                        <div className="rdoc-d-meta">
                          <span>Your uploads</span>
                          <span>·</span>
                          <span>Uploaded {fmtDate(d.createdAt)}</span>
                        </div>
                      </div>
                      <div className="rdoc-d-acts">
                        <span className="rdoc-pl green">
                          {d.documentStatus === "active" ? "Accepted" : d.documentStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Requested uploads callout */}
          {canWrite && (
            <div className="rdoc-req">
              <div className="rdoc-req-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Your builder may request documents here
              </div>
              <div className="rdoc-req-row">
                <div>
                  <div className="rdoc-req-name">
                    Insurance certificates, HOA approvals, or other owner-provided documents
                  </div>
                  <div className="rdoc-req-desc">
                    When your builder needs something from you, it will appear here
                    with an upload button.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: rdocCss }} />
    </div>
  );
}

const rdocCss = `
.rdoc{display:flex;flex-direction:column}
.rdoc-head{margin-bottom:20px}
.rdoc-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.rdoc-sub{font-family:var(--fb);font-size:13.5px;color:var(--t2);margin-top:4px;max-width:600px}

.rdoc-upz{border:2px dashed var(--s3);border-radius:var(--r-xl);padding:32px 20px;text-align:center;background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%);cursor:pointer;transition:all 200ms ease;margin-bottom:20px}
.rdoc-upz:hover{border-color:var(--ac);background:var(--ac-s)}
.rdoc-upz-icon{width:48px;height:48px;border-radius:50%;background:var(--ac-s);display:grid;place-items:center;margin:0 auto 12px;color:var(--ac)}
.rdoc-upz h4{font-family:var(--fd);font-size:15px;font-weight:680;margin:0 0 4px;color:var(--t1)}
.rdoc-upz p{font-family:var(--fb);font-size:13px;color:var(--t2);margin:0}
.rdoc-upz-hints{display:flex;gap:16px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.rdoc-upz-hints span{font-family:var(--fb);font-size:11.5px;color:var(--t3);display:flex;align-items:center;gap:4px}
.rdoc-upz-hints svg{flex-shrink:0}

.rdoc-lay{display:grid;grid-template-columns:220px 1fr;gap:20px}
.rdoc-cats{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px;align-self:start;position:sticky;top:80px}
.rdoc-dc-title{font-family:var(--fd);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:8px;margin-bottom:4px}
.rdoc-dc{padding:8px 12px;border-radius:var(--r-m);font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t2);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:all 120ms ease;margin-bottom:1px;background:none;border:none;width:100%;text-align:left}
.rdoc-dc:hover{background:var(--sh);color:var(--t1)}
.rdoc-dc.on{background:var(--sa);color:var(--t1);font-weight:620}
.rdoc-cnt{font-size:11px;color:var(--t3);font-weight:600;font-family:var(--fd)}

.rdoc-files{min-width:0}
.rdoc-section-label{font-family:var(--fd);font-size:13px;font-weight:650;color:var(--t2);margin-bottom:12px}
.rdoc-list{display:flex;flex-direction:column;gap:8px}
.rdoc-dr{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);transition:all 120ms ease;cursor:pointer}
.rdoc-dr:hover{border-color:var(--s4);box-shadow:var(--shsm)}
.rdoc-dr.owner{border-color:var(--ac-s);background:linear-gradient(90deg,var(--ac-s) 0%,var(--s1) 40%)}
.rdoc-di{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0;font-size:11px;font-weight:700;font-family:var(--fd)}
.rdoc-di.pdf{background:var(--dg-s);color:var(--dg-t)}
.rdoc-di.dwg{background:var(--in-s);color:var(--in-t)}
.rdoc-d-info{flex:1;min-width:0}
.rdoc-d-name{font-family:var(--fb);font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t1)}
.rdoc-d-meta{font-family:var(--fb);font-size:11.5px;color:var(--t3);margin-top:1px;display:flex;gap:6px;align-items:center}
.rdoc-d-meta span{white-space:nowrap}
.rdoc-d-acts{display:flex;gap:8px;flex-shrink:0;align-items:center}
.rdoc-btn-sm{height:28px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:620;cursor:pointer;transition:all 120ms ease}
.rdoc-btn-sm:hover{background:var(--s2);border-color:var(--s4)}

.rdoc-you-up{margin-top:20px;padding-top:20px;border-top:2px solid var(--ac-s)}
.rdoc-you-up-lbl{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--ac-t);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.rdoc-you-up-lbl svg{flex-shrink:0}

.rdoc-req{margin-top:20px;padding:16px;background:var(--wr-s);border:1px solid rgba(193,122,26,.15);border-radius:var(--r-l)}
.rdoc-req-title{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--wr-t);margin-bottom:8px;display:flex;align-items:center;gap:6px}
.rdoc-req-title svg{flex-shrink:0}
.rdoc-req-row{display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--s1);border-radius:var(--r-m);gap:16px}
.rdoc-req-name{font-family:var(--fb);font-size:13px;font-weight:600;color:var(--t1)}
.rdoc-req-desc{font-family:var(--fb);font-size:12px;color:var(--t2);margin-top:2px}

.rdoc-pl{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-family:var(--fd);font-size:10.5px;font-weight:700;white-space:nowrap}
.rdoc-pl.green{background:var(--ok-s);color:var(--ok-t)}

.rdoc-empty{font-family:var(--fb);font-size:13px;color:var(--t3);padding:16px 0}

@media(max-width:900px){.rdoc-lay{grid-template-columns:1fr}.rdoc-cats{position:static}}
@media(max-width:720px){.rdoc-title{font-size:22px}}
`;
