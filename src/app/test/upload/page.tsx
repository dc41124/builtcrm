"use client";

import { useState } from "react";

type LogEntry = { ts: string; text: string };

export default function TestUploadPage() {
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastDocumentId, setLastDocumentId] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  function push(text: string) {
    setLog((prev) => [
      ...prev,
      { ts: new Date().toISOString().slice(11, 19), text },
    ]);
  }

  async function handleUpload() {
    if (!projectId || !file) {
      push("Missing projectId or file");
      return;
    }
    setBusy(true);
    try {
      push(`Requesting presigned URL for ${file.name}`);
      const reqRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          documentType: "general",
        }),
      });
      if (!reqRes.ok) {
        push(`request failed: ${reqRes.status} ${await reqRes.text()}`);
        return;
      }
      const { uploadUrl, storageKey } = await reqRes.json();
      push(`Got storageKey ${storageKey}`);

      push("PUT to R2...");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        push(`PUT failed: ${putRes.status}`);
        return;
      }
      push("PUT ok");

      push("Finalizing...");
      const finRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey,
          title: file.name,
          documentType: "general",
        }),
      });
      if (!finRes.ok) {
        push(`finalize failed: ${finRes.status} ${await finRes.text()}`);
        return;
      }
      const { documentId } = await finRes.json();
      setLastDocumentId(documentId);
      push(`Finalized document ${documentId}`);
    } catch (err) {
      push(`error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!lastDocumentId) return;
    const res = await fetch(`/api/files/${lastDocumentId}`);
    if (!res.ok) {
      push(`download failed: ${res.status}`);
      return;
    }
    const { downloadUrl } = await res.json();
    push("Opening download URL");
    window.open(downloadUrl, "_blank");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1>Upload Test</h1>
      <p>End-to-end sanity check for R2 presigned upload + finalize + download.</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Project ID
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="uuid"
          style={{ display: "block", width: "100%", padding: 6 }}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        File
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ display: "block", marginTop: 4 }}
        />
      </label>

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button onClick={handleUpload} disabled={busy}>
          {busy ? "Uploading..." : "Upload"}
        </button>
        <button onClick={handleDownload} disabled={!lastDocumentId || busy}>
          Download last
        </button>
      </div>

      <h2 style={{ marginTop: 24 }}>Log</h2>
      <pre
        style={{
          background: "#111",
          color: "#eee",
          padding: 12,
          minHeight: 160,
          whiteSpace: "pre-wrap",
        }}
      >
        {log.map((l) => `[${l.ts}] ${l.text}`).join("\n")}
      </pre>
    </main>
  );
}
