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

export function ResidentialDocumentsView({
  projectId,
  currentUserId,
  canWrite,
  documents,
  linkableItems: _linkableItems,
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

      
    </div>
  );
}
