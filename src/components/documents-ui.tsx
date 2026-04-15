"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DocumentRow } from "@/domain/loaders/project-home";

const VISIBILITY_OPTIONS = [
  "internal_only",
  "client_visible",
  "subcontractor_scoped",
  "project_wide",
  "phase_scoped",
  "scope_scoped",
] as const;

const AUDIENCE_OPTIONS = [
  "internal",
  "contractor",
  "subcontractor",
  "client",
  "commercial_client",
  "residential_client",
  "mixed",
] as const;

type PresignResponse = {
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
};

async function presignAndPut(
  projectId: string,
  file: File,
  documentType: string,
): Promise<string> {
  const presignRes = await fetch("/api/upload/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      documentType,
    }),
  });
  if (!presignRes.ok) throw new Error("presign_failed");
  const presign = (await presignRes.json()) as PresignResponse;
  const putRes = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers,
    body: file,
  });
  if (!putRes.ok) throw new Error("put_failed");
  return presign.storageKey;
}

export function DocumentsPanel({
  projectId,
  documents,
  currentUserId,
  canWrite,
}: {
  projectId: string;
  documents: DocumentRow[];
  currentUserId: string;
  canWrite: boolean;
}) {
  const router = useRouter();

  // Group by documentType for a light category feel without building a
  // full tree. Superseded rows are hidden by default but one click away.
  const [showSuperseded, setShowSuperseded] = useState(false);
  const visible = useMemo(
    () => documents.filter((d) => showSuperseded || !d.isSuperseded),
    [documents, showSuperseded],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const d of visible) {
      const arr = map.get(d.documentType) ?? [];
      arr.push(d);
      map.set(d.documentType, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  async function download(docId: string) {
    const res = await fetch(`/api/files/${docId}`);
    if (!res.ok) return;
    const body = (await res.json()) as { downloadUrl: string };
    window.open(body.downloadUrl, "_blank", "noopener");
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={showSuperseded}
            onChange={(e) => setShowSuperseded(e.target.checked)}
          />{" "}
          Show superseded versions
        </label>
      </div>
      {canWrite && <UploadDocumentForm projectId={projectId} />}
      {grouped.length === 0 ? (
        <p>No documents yet.</p>
      ) : (
        grouped.map(([type, docs]) => (
          <section key={type} style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 4 }}>{type}</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {docs.map((d) => (
                <DocumentRowItem
                  key={d.id}
                  doc={d}
                  currentUserId={currentUserId}
                  canWrite={canWrite}
                  onDownload={() => download(d.id)}
                  onRefresh={() => router.refresh()}
                  projectId={projectId}
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function DocumentRowItem({
  doc,
  currentUserId,
  canWrite,
  onDownload,
  onRefresh,
  projectId,
}: {
  doc: DocumentRow;
  currentUserId: string;
  canWrite: boolean;
  onDownload: () => void;
  onRefresh: () => void;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const canEditThis =
    canWrite && !doc.isSuperseded && doc.uploadedByUserId === currentUserId;
  // Contractors can also edit. We don't know the caller's role here — the
  // server enforces it, and the UI just lets them try. If the server
  // rejects, we surface the error.
  const canTryEdit = canWrite && !doc.isSuperseded;

  return (
    <li
      style={{
        borderTop: "1px solid var(--s3)",
        padding: "8px 0",
        opacity: doc.isSuperseded ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <strong>{doc.title}</strong>
        <span style={{ fontSize: 12, color: "var(--t2)" }}>
          [{doc.documentStatus}]
        </span>
        <span style={{ fontSize: 12, color: "var(--t2)" }}>
          · {doc.visibilityScope} / {doc.audienceScope}
        </span>
        <span style={{ fontSize: 12, color: "var(--t3)" }}>
          · {doc.uploadedByName ?? "—"} ·{" "}
          {new Date(doc.createdAt).toISOString().slice(0, 10)}
        </span>
        {doc.isSuperseded && (
          <span style={{ color: "darkorange", fontSize: 12 }}>
            (superseded)
          </span>
        )}
      </div>
      <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
        <button type="button" onClick={onDownload}>
          Download
        </button>
        {canTryEdit && (
          <button type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
        )}
        {canTryEdit && (
          <SupersedeButton
            docId={doc.id}
            projectId={projectId}
            onDone={onRefresh}
          />
        )}
      </div>
      {editing && (
        <EditDocumentForm
          doc={doc}
          onDone={() => {
            setEditing(false);
            onRefresh();
          }}
          // Used only to gate the "restore" affordance — not a trust boundary.
          mayBeOwner={canEditThis}
        />
      )}
      {doc.links.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--t2)" }}>
          Linked:{" "}
          {doc.links
            .filter((l) => l.linkedObjectType !== "project")
            .map((l, idx) => (
              <span key={idx}>
                {l.linkRole}→{l.linkedObjectType}:{l.linkedObjectId.slice(0, 8)}
                {idx < doc.links.length - 1 ? "; " : ""}
              </span>
            ))}
        </div>
      )}
    </li>
  );
}

function EditDocumentForm({
  doc,
  onDone,
  mayBeOwner: _mayBeOwner,
}: {
  doc: DocumentRow;
  onDone: () => void;
  mayBeOwner: boolean;
}) {
  const [title, setTitle] = useState(doc.title);
  const [documentType, setDocumentType] = useState(doc.documentType);
  const [visibilityScope, setVisibilityScope] = useState(doc.visibilityScope);
  const [audienceScope, setAudienceScope] = useState(doc.audienceScope);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        documentType,
        visibilityScope,
        audienceScope,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "update_failed");
      return;
    }
    onDone();
  }

  async function archive() {
    if (!window.confirm("Archive this document?")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentStatus: "archived" }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "archive_failed");
      return;
    }
    onDone();
  }

  return (
    <div style={{ marginTop: 6, display: "grid", gap: 4, maxWidth: 480 }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
      />
      <input
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        placeholder="Document type"
      />
      <select
        value={visibilityScope}
        onChange={(e) => setVisibilityScope(e.target.value)}
      >
        {VISIBILITY_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <select
        value={audienceScope}
        onChange={(e) => setAudienceScope(e.target.value)}
      >
        {AUDIENCE_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={archive} disabled={pending}>
          Archive
        </button>
      </div>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </div>
  );
}

function SupersedeButton({
  docId,
  projectId,
  onDone,
}: {
  docId: string;
  projectId: string;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const storageKey = await presignAndPut(projectId, file, "supersede");
      const res = await fetch(`/api/documents/${docId}/supersede`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey, title: file.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "supersede_failed");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <label style={{ cursor: "pointer", fontSize: 12 }}>
      <input
        type="file"
        style={{ display: "none" }}
        onChange={onChange}
        disabled={pending}
      />
      <span
        style={{
          border: "1px solid var(--s3)",
          padding: "2px 8px",
          borderRadius: 4,
        }}
      >
        {pending ? "Uploading..." : "Supersede"}
      </span>
      {error && <span style={{ color: "crimson" }}> {error}</span>}
    </label>
  );
}

function UploadDocumentForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("general");
  const [visibilityScope, setVisibilityScope] = useState("project_wide");
  const [audienceScope, setAudienceScope] = useState("contractor");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("no_file");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const storageKey = await presignAndPut(projectId, file, documentType);
      const res = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey,
          title: title || file.name,
          documentType,
          visibilityScope,
          audienceScope,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "finalize_failed");
      }
      setFile(null);
      setTitle("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "grid",
        gap: 6,
        maxWidth: 520,
        border: "1px dashed var(--s3)",
        padding: 10,
        marginTop: 8,
      }}
    >
      <strong>Upload Document</strong>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (defaults to filename)"
      />
      <input
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value)}
        placeholder="Document type (e.g. drawing, submittal, coi)"
      />
      <label>
        Visibility{" "}
        <select
          value={visibilityScope}
          onChange={(e) => setVisibilityScope(e.target.value)}
        >
          {VISIBILITY_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Audience{" "}
        <select
          value={audienceScope}
          onChange={(e) => setAudienceScope(e.target.value)}
        >
          {AUDIENCE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending || !file}>
        {pending ? "Uploading..." : "Upload"}
      </button>
      {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
    </form>
  );
}
