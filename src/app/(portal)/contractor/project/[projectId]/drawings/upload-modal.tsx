"use client";

// Upload Drawing Set modal. Ported to match docs/specs/builtcrm_drawings_module.jsx
// — drop zone on top, progress bar once a file is in flight, "Detected
// Preview" summary card once extraction returns, then form fields (Set
// Name, Family, Notes) and a footer with the cadence hint + Cancel /
// Upload & Publish buttons.
//
// The prototype mocks the upload pipeline; this implementation wires it
// through the real backend: POST /api/drawings/sets → presigned PUT to
// R2 → POST /api/drawings/sets/{id}/finalize → refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "idle" | "creating" | "uploading" | "finalizing" | "done" | "error";

const MAX_BYTES = 250 * 1024 * 1024; // matches the route's zod cap

export function UploadModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [family, setFamily] = useState("cd");
  const [name, setName] = useState("100% CD Set");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    setId: string;
    sheetCount: number;
    autoDetectedCount: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeOnEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "uploading" && step !== "finalizing") {
        onClose();
      }
    },
    [onClose, step],
  );
  useEffect(() => {
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeOnEscape]);

  function handleDropFile(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(
        `File exceeds the ${Math.round(MAX_BYTES / 1024 / 1024)} MB limit.`,
      );
      return;
    }
    setFile(f);
  }

  async function runUpload() {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploadPct(0);

    try {
      setStep("creating");
      const createRes = await fetch("/api/drawings/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          family: family.trim(),
          name: name.trim(),
          filename: file.name,
          fileSize: file.size,
          contentType: file.type || "application/pdf",
          note: note.trim() || undefined,
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.message ?? `create failed (${createRes.status})`);
      }
      const created = (await createRes.json()) as {
        setId: string;
        uploadUrl: string;
        method: string;
      };

      // Real PUT-to-R2 with progress. Using XHR here (rather than fetch)
      // because fetch doesn't expose upload progress in the browser.
      setStep("uploading");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(created.method, created.uploadUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/pdf",
        );
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadPct(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadPct(100);
            resolve();
          } else {
            reject(new Error(`R2 PUT ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("R2 PUT network error"));
        xhr.send(file);
      });

      setStep("finalizing");
      const finalizeRes = await fetch(
        `/api/drawings/sets/${created.setId}/finalize`,
        { method: "POST" },
      );
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(
          body.message ?? `finalize failed (${finalizeRes.status})`,
        );
      }
      const finalized = (await finalizeRes.json()) as {
        setId: string;
        sheetCount: number;
        autoDetectedCount: number;
      };

      setResult(finalized);
      setStep("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  }

  function handleConfirmClose() {
    if (result) {
      // Success path — navigate to the new set's index.
      router.push(`/contractor/project/${projectId}/drawings/${result.setId}`);
    } else {
      onClose();
    }
  }

  const isBusy = step === "creating" || step === "uploading" || step === "finalizing";
  const fileKB = file ? (file.size / 1024 / 1024).toFixed(1) : null;

  return (
    <div
      className="dr-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        className="dr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dr-upload-title"
      >
        <div className="dr-modal-hdr">
          <h3 id="dr-upload-title">Upload Drawing Set</h3>
          <button
            className="dr-btn sm ghost icon"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="dr-modal-body">
          {/* Drop zone — clickable, drag-and-drop, hidden input behind it. */}
          {!file ? (
            <div
              className="dr-upload-drop"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleDropFile(e.dataTransfer.files?.[0]);
              }}
              style={{
                borderColor: dragActive ? "var(--accent)" : undefined,
                background: dragActive ? "#eeedfb" : undefined,
              }}
            >
              <div className="dr-upload-drop-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h4>Drop a PDF sheet set here</h4>
              <p>
                Multi-page PDF. We&apos;ll split into sheets and auto-detect
                sheet numbers from the title block. Max{" "}
                {Math.round(MAX_BYTES / 1024 / 1024)} MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => handleDropFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div className="dr-upload-progress">
              <div className="dr-upload-prog-top">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="dr-upload-prog-name">{file.name}</span>
                <span className="dr-upload-prog-pct">
                  {step === "idle" || step === "creating"
                    ? "Ready"
                    : step === "uploading"
                      ? `${uploadPct}%`
                      : step === "finalizing"
                        ? "Processing…"
                        : step === "done"
                          ? "100%"
                          : "Failed"}
                </span>
              </div>
              <div className="dr-upload-prog-bar">
                <div
                  className="dr-upload-prog-fill"
                  style={{
                    width:
                      step === "done"
                        ? "100%"
                        : step === "uploading"
                          ? `${uploadPct}%`
                          : step === "finalizing"
                            ? "100%"
                            : step === "idle" || step === "creating"
                              ? "0%"
                              : "0%",
                    background:
                      step === "error" ? "#c93b3b" : undefined,
                  }}
                />
              </div>
              {!isBusy && step !== "done" ? (
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="dr-btn xs ghost"
                    onClick={() => {
                      setFile(null);
                      setStep("idle");
                      setUploadPct(0);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Replace file
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Detected Preview — populated after extraction returns. */}
          {result ? (
            <div className="dr-upload-preview">
              <h5>Detected Preview</h5>
              <div className="dr-upload-preview-row">
                <span className="k">Pages detected</span>
                <span className="v">{result.sheetCount}</span>
              </div>
              <div className="dr-upload-preview-row">
                <span className="k">Sheet numbers auto-extracted</span>
                <span className="v">
                  {result.autoDetectedCount} of {result.sheetCount}
                  {result.sheetCount - result.autoDetectedCount > 0 ? (
                    <span
                      style={{
                        color: "#96600f",
                        fontSize: 11,
                        fontWeight: 580,
                        marginLeft: 6,
                      }}
                    >
                      · {result.sheetCount - result.autoDetectedCount} need manual entry
                    </span>
                  ) : null}
                </span>
              </div>
              {fileKB ? (
                <div className="dr-upload-preview-row">
                  <span className="k">File size</span>
                  <span className="v">{fileKB} MB</span>
                </div>
              ) : null}
            </div>
          ) : file && step === "idle" ? (
            <div className="dr-upload-preview">
              <h5>Ready to Upload</h5>
              <div className="dr-upload-preview-row">
                <span className="k">File name</span>
                <span className="v" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  {file.name}
                </span>
              </div>
              <div className="dr-upload-preview-row">
                <span className="k">File size</span>
                <span className="v">{fileKB} MB</span>
              </div>
              <div className="dr-upload-preview-row">
                <span className="k">Extraction</span>
                <span className="v">
                  Sheet numbers + disciplines auto-detected on upload
                </span>
              </div>
            </div>
          ) : null}

          {/* Form fields — prototype layout: Set Name + Set Type in a
              two-column grid, Notes below. The Set Type dropdown carries
              the underlying "family" code; the actual version number is
              auto-assigned by the server and surfaced as a hint. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="dr-field">
              <label>Set Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isBusy || step === "done"}
                placeholder="100% CD Set"
              />
            </div>
            <div className="dr-field">
              <label>Set Type</label>
              <select
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                disabled={isBusy || step === "done"}
              >
                <option value="cd">CD Set (Construction Documents)</option>
                <option value="dd">DD Set (Design Development)</option>
                <option value="sd">SD Set (Schematic Design)</option>
                <option value="shell">Shell Permit Set</option>
                <option value="tenant">Tenant Improvement Set</option>
                <option value="as_built">As-Built Record Set</option>
                <option value="other">Other / Custom</option>
              </select>
              <span className="dr-field-hint">
                Groups versions together — uploads with the same type
                auto-chain as new revisions.
              </span>
            </div>
          </div>
          <div className="dr-field">
            <label>Notes (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isBusy || step === "done"}
              placeholder="e.g. Revision supersedes v2 — 3 sheets changed."
            />
          </div>

          {error ? (
            <div
              style={{
                background: "#fdeaea",
                border: "1px solid #c93b3b",
                color: "#a52e2e",
                padding: 10,
                borderRadius: 10,
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="dr-modal-foot">
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-tertiary)",
              fontWeight: 520,
            }}
          >
            Processing typically takes a few seconds per sheet
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="dr-btn sm ghost"
              onClick={onClose}
              disabled={isBusy}
            >
              Cancel
            </button>
            {step === "done" ? (
              <button
                className="dr-btn sm primary"
                onClick={handleConfirmClose}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Open Set
              </button>
            ) : (
              <button
                className="dr-btn sm primary"
                onClick={runUpload}
                disabled={!file || !name.trim() || !family.trim() || isBusy}
              >
                {step === "creating"
                  ? "Starting…"
                  : step === "uploading"
                    ? "Uploading…"
                    : step === "finalizing"
                      ? "Extracting…"
                      : "Upload & Publish"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
