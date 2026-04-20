"use client";

import Link from "next/link";
import { useState } from "react";

type Step = "idle" | "creating" | "uploading" | "finalizing" | "done" | "error";

export function UploadWorkspace({ projectId }: { projectId: string }) {
  const [family, setFamily] = useState("cd");
  const [name, setName] = useState("100% CD Set");
  const [note, setNote] = useState("");
  const [asBuilt, setAsBuilt] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    setId: string;
    sheetCount: number;
    autoDetectedCount: number;
  } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setError(null);
    setResult(null);
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
          asBuilt,
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

      setStep("uploading");
      const putRes = await fetch(created.uploadUrl, {
        method: created.method,
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`upload to R2 failed (${putRes.status})`);
      }

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("error");
    }
  }

  return (
    <div className="dr-page">
      <div className="dr-page-hdr">
        <div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
            <Link
              href={`/contractor/project/${projectId}/drawings`}
              style={{ color: "inherit" }}
            >
              Drawings
            </Link>{" "}
            / Upload sheet set
          </div>
          <h1 className="dr-page-title">Upload sheet set</h1>
          <p className="dr-page-desc">
            Upload a multi-page PDF. Sheet numbers are auto-detected from each
            page&apos;s title block; misses can be edited on the index page.
            The new set will supersede the current set in the same family.
          </p>
        </div>
      </div>

      <div
        className="dr-card"
        style={{
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxWidth: 640,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 650 }}>Family</span>
          <input
            type="text"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            placeholder="cd, shell, dd, as_built"
            className="dr-btn"
            style={{ justifyContent: "flex-start", paddingLeft: 12 }}
            disabled={step !== "idle" && step !== "error"}
          />
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            Short code that groups versions together. Uploads with the same
            family auto-chain as new versions.
          </span>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 650 }}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="100% CD Set"
            className="dr-btn"
            style={{ justifyContent: "flex-start", paddingLeft: 12 }}
            disabled={step !== "idle" && step !== "error"}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 650 }}>Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Revision supersedes v2 — 3 sheets changed."
            className="dr-btn"
            style={{
              height: 64,
              justifyContent: "flex-start",
              paddingLeft: 12,
              paddingTop: 10,
              alignItems: "flex-start",
            }}
            disabled={step !== "idle" && step !== "error"}
          />
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={asBuilt}
            onChange={(e) => setAsBuilt(e.target.checked)}
            disabled={step !== "idle" && step !== "error"}
          />
          <span>Mark as as-built (feeds closeout package)</span>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 650 }}>Sheet set PDF</span>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={step !== "idle" && step !== "error"}
          />
          {file ? (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          ) : null}
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="dr-btn primary"
            disabled={
              !file ||
              !family.trim() ||
              !name.trim() ||
              (step !== "idle" && step !== "error")
            }
            onClick={handleUpload}
          >
            {step === "creating"
              ? "Creating set…"
              : step === "uploading"
                ? "Uploading to storage…"
                : step === "finalizing"
                  ? "Extracting sheets…"
                  : step === "done"
                    ? "Uploaded"
                    : "Upload and extract"}
          </button>
          <Link
            className="dr-btn"
            href={`/contractor/project/${projectId}/drawings`}
          >
            Cancel
          </Link>
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

        {result ? (
          <div
            style={{
              background: "#edf7f1",
              border: "1px solid #2d8a5e",
              color: "#1e6b46",
              padding: 10,
              borderRadius: 10,
              fontSize: 12.5,
            }}
          >
            Extracted {result.sheetCount} sheet{result.sheetCount === 1 ? "" : "s"}
            {" "}({result.autoDetectedCount} auto-detected).{" "}
            <Link href={`/contractor/project/${projectId}/drawings/${result.setId}`}>
              Open set →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
