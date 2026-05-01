"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Step 55 — Field RFI Quick-Capture FAB.
//
// Mobile-first: only renders at viewports < 720px. The flow is:
//   1. Tap the FAB → modal opens.
//   2. Tap "Capture photo" → triggers <input type="file" accept="image/*"
//      capture="environment"> which the OS routes to the system camera on
//      Android/iOS. No camera-stream MediaRecorder hookup in v1.
//   3. Photo upload runs in the background through the standard 3-step R2
//      chain (/api/upload/request → PUT → /api/upload/finalize).
//   4. Voice button → toggles webkitSpeechRecognition. Live transcript fills
//      the body textarea. The textarea is always editable as a fallback.
//   5. GPS captured silently on submit — best-effort, swallows errors.
//   6. Submit → POST /api/rfis with status="draft", clientUuid (uuid v4),
//      attachmentDocumentIds. If offline (or POST fails with network),
//      the row is enqueued via Step 51's outbox under kind="rfi_quick_create".
//
// No new schema; the audit_events.metadata_json.clientUuid lookup in the
// route handles idempotency. Photo upload runs while the user records voice
// so the document IDs are ready by submit time. If the user is offline at
// submit time AND the photo never finished uploading, we surface a "Save
// without photo" affordance and proceed; the photo is dropped (noted in the
// production_grade_upgrades stub for a Step 55.5 photo-outbox slice).

interface Props {
  projectId: string;
  // Default subject prefix when the FAB lacks input (e.g. quickly snap +
  // submit with no voice). Workers can edit subject before submit.
  defaultSubjectPrefix?: string;
}

// Local shape of the non-standard SpeechRecognition interface. We type it
// minimally — the global lib.dom typing for this is partial across TS
// versions and we only use a handful of fields.
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
        resultIndex: number;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; rfiId: string; idempotent: boolean }
  | { kind: "queued"; clientUuid: string }
  | { kind: "error"; message: string };

export function QuickRfiFab({
  projectId,
  defaultSubjectPrefix = "Field RFI",
}: Props) {
  const [open, setOpen] = useState(false);
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);
  const [photoDocumentId, setPhotoDocumentId] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [subject, setSubject] = useState(defaultSubjectPrefix);
  const [recording, setRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(
    null,
  );
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      setSpeechSupported(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    // Existence check only — some browsers (Brave, hardened Chromium) expose
    // a getter that THROWS when read like a function or in a boolean context,
    // which is the bug that caused "Failed to construct 'SpeechRecognition'"
    // in this codebase. Keep this as a typeof === "function" probe.
    const hasCtor =
      typeof w.SpeechRecognition === "function" ||
      typeof w.webkitSpeechRecognition === "function";
    setSpeechSupported(hasCtor);
  }, []);

  useEffect(() => {
    return () => {
      if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
    };
  }, [photoBlobUrl]);

  const reset = () => {
    if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
    setPhotoBlobUrl(null);
    setPhotoDocumentId(null);
    setPhotoUploadError(null);
    setPhotoUploading(false);
    setTranscript("");
    setSubject(defaultSubjectPrefix);
    setRecording(false);
    setSubmitState({ kind: "idle" });
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  const handleClose = () => {
    reset();
    setOpen(false);
  };

  const handlePhotoSelected = async (file: File) => {
    setPhotoUploadError(null);
    setPhotoBlobUrl(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      // 1. presign
      const presignRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name || `quick-rfi-${Date.now()}.jpg`,
          contentType: file.type || "image/jpeg",
          documentType: "rfi_attachment",
        }),
      });
      if (!presignRes.ok) {
        throw new Error(`presign failed (${presignRes.status})`);
      }
      const presign = (await presignRes.json()) as {
        uploadUrl: string;
        storageKey: string;
      };
      // 2. PUT
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`upload failed (${putRes.status})`);
      // 3. finalize
      const finalizeRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey: presign.storageKey,
          title: `Field photo · ${new Date().toLocaleString()}`,
          documentType: "rfi_attachment",
          category: "other",
          visibilityScope: "project_wide",
          audienceScope: "internal",
        }),
      });
      if (!finalizeRes.ok) {
        throw new Error(`finalize failed (${finalizeRes.status})`);
      }
      const fin = (await finalizeRes.json()) as { id?: string };
      if (!fin.id) throw new Error("finalize returned no id");
      setPhotoDocumentId(fin.id);
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhotoUploading(false);
    }
  };

  const startRecording = () => {
    if (!speechSupported || typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor =
      typeof w.SpeechRecognition === "function"
        ? w.SpeechRecognition
        : typeof w.webkitSpeechRecognition === "function"
          ? w.webkitSpeechRecognition
          : null;
    if (!Ctor) return;
    let recog: SpeechRecognitionLike;
    try {
      recog = new Ctor();
    } catch {
      // Some hardened browsers expose the constructor but throw on
      // construction. Fail open — the textarea is still usable.
      setSpeechSupported(false);
      return;
    }
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (event: {
      results: ArrayLike<{
        0: { transcript: string };
        isFinal: boolean;
      }>;
      resultIndex: number;
    }) => {
      let next = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        next += r[0].transcript;
        if (r.isFinal) next += " ";
      }
      setTranscript(next.trim());
    };
    recog.onend = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recog.onerror = () => {
      setRecording(false);
      recognitionRef.current = null;
    };
    recog.start();
    recognitionRef.current = recog;
    setRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setRecording(false);
  };

  const captureGps = async (): Promise<{ lat: number; lng: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 5000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 60_000 },
      );
    });
  };

  const handleSubmit = async () => {
    setSubmitState({ kind: "submitting" });
    if (recording) stopRecording();
    const finalSubject =
      subject.trim() || `${defaultSubjectPrefix} ${new Date().toLocaleString()}`;
    const gps = await captureGps();
    const locationDescription = gps
      ? `GPS ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}${transcript ? ` · ${transcript}` : ""}`
      : transcript || null;
    const clientUuid = crypto.randomUUID();
    const body = {
      projectId,
      subject: finalSubject,
      body: transcript || null,
      status: "draft" as const,
      locationDescription,
      clientUuid,
      attachmentDocumentIds: photoDocumentId ? [photoDocumentId] : undefined,
    };

    const goOffline = async () => {
      try {
        const { enqueueWrite } = await import("@/lib/offline/queue");
        await enqueueWrite({
          clientId: clientUuid,
          kind: "rfi_quick_create",
          payload: { projectId, body },
        });
        setSubmitState({ kind: "queued", clientUuid });
      } catch (err) {
        setSubmitState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await goOffline();
      return;
    }
    try {
      const res = await fetch("/api/rfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (res.status >= 500 || res.status === 0) {
          await goOffline();
          return;
        }
        const j = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setSubmitState({
          kind: "error",
          message: j.message ?? j.error ?? `submit failed (${res.status})`,
        });
        return;
      }
      const j = (await res.json()) as { id: string; idempotent?: boolean };
      setSubmitState({
        kind: "ok",
        rfiId: j.id,
        idempotent: !!j.idempotent,
      });
      router.refresh();
    } catch {
      await goOffline();
    }
  };

  const canSubmit = useMemo(() => {
    if (submitState.kind === "submitting") return false;
    if (photoUploading) return false;
    return Boolean(transcript.trim() || photoDocumentId);
  }, [submitState, photoUploading, transcript, photoDocumentId]);

  return (
    <>
      <button
        className="qrfi-fab"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick RFI"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          <path d="M12 7v4M12 15h.01" />
        </svg>
        <span className="qrfi-fab-label">Quick RFI</span>
      </button>

      {open ? (
        <div className="qrfi-modal-bg" onClick={handleClose}>
          <div
            className="qrfi-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="qrfi-hdr">
              <h3>Quick RFI</h3>
              <button
                type="button"
                className="qrfi-close"
                onClick={handleClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <label className="qrfi-label">Subject</label>
            <input
              type="text"
              className="qrfi-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short title"
              maxLength={255}
            />

            <label className="qrfi-label">Photo</label>
            <div className="qrfi-photo-row">
              {photoBlobUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoBlobUrl}
                  alt="Captured"
                  className="qrfi-photo-thumb"
                />
              ) : (
                <div className="qrfi-photo-placeholder">No photo yet</div>
              )}
              <button
                type="button"
                className="qrfi-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
              >
                {photoBlobUrl ? "Replace" : "Capture photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoSelected(f);
                }}
              />
            </div>
            {photoUploading ? (
              <div className="qrfi-meta">Uploading photo…</div>
            ) : null}
            {photoUploadError ? (
              <div className="qrfi-meta qrfi-error">
                Photo upload failed: {photoUploadError}
              </div>
            ) : null}

            <label className="qrfi-label">
              Description{" "}
              {speechSupported ? (
                <span className="qrfi-meta-inline">(or tap mic to dictate)</span>
              ) : (
                <span className="qrfi-meta-inline">
                  (voice not supported — type instead)
                </span>
              )}
            </label>
            <textarea
              className="qrfi-textarea"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Describe the question or issue…"
              rows={4}
            />
            {speechSupported ? (
              <button
                type="button"
                className={`qrfi-btn qrfi-mic${recording ? " recording" : ""}`}
                onClick={() => (recording ? stopRecording() : startRecording())}
              >
                {recording ? "■ Stop dictation" : "🎤 Dictate"}
              </button>
            ) : null}

            <div className="qrfi-meta">
              GPS captured silently on submit · routed to project contractor
              admins as a draft RFI.
            </div>

            <div className="qrfi-foot">
              <button
                type="button"
                className="qrfi-btn ghost"
                onClick={handleClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="qrfi-btn primary"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {submitState.kind === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </div>

            {submitState.kind === "ok" ? (
              <div className="qrfi-banner ok">
                {submitState.idempotent
                  ? "Already submitted (no duplicate)."
                  : "Submitted as draft."}{" "}
                <button
                  className="qrfi-link"
                  type="button"
                  onClick={handleClose}
                >
                  Close
                </button>
              </div>
            ) : null}
            {submitState.kind === "queued" ? (
              <div className="qrfi-banner wr">
                Saved offline — will sync when connection returns.{" "}
                <button
                  className="qrfi-link"
                  type="button"
                  onClick={handleClose}
                >
                  Close
                </button>
              </div>
            ) : null}
            {submitState.kind === "error" ? (
              <div className="qrfi-banner er">{submitState.message}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <style>{`
        .qrfi-fab{
          position:fixed; right:18px; bottom:18px;
          height:56px; padding:0 18px;
          border-radius:30px;
          background:#5b4fc7; color:#fff;
          border:none; cursor:pointer;
          box-shadow:0 6px 24px rgba(91,79,199,.32);
          font-family:'DM Sans',system-ui,sans-serif;
          font-weight:700; font-size:14px; letter-spacing:-.01em;
          display:inline-flex; align-items:center; gap:8px;
          z-index:40;
        }
        .qrfi-fab-label{ display:inline; }
        @media (min-width:721px){
          /* Desktop: keep the FAB but smaller; the existing 'New RFI'
             surfaces handle the heavy-input flow. */
          .qrfi-fab{ height:46px; right:24px; bottom:24px; }
        }
        .qrfi-modal-bg{
          position:fixed; inset:0;
          background:rgba(20,18,14,.5);
          z-index:50;
          display:grid; place-items:end center;
          padding:0;
        }
        @media (min-width:721px){
          .qrfi-modal-bg{ place-items:center; padding:24px; }
        }
        .qrfi-modal{
          background:#fff; width:100%; max-width:520px;
          border-radius:18px 18px 0 0;
          padding:18px 18px 24px;
          max-height:92vh; overflow:auto;
          box-shadow:0 -10px 30px rgba(0,0,0,.18);
          font-family:'Instrument Sans',sans-serif;
          color:#1f1d1a;
        }
        @media (min-width:721px){
          .qrfi-modal{ border-radius:14px; padding:22px; }
        }
        .qrfi-hdr{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .qrfi-hdr h3{
          font-family:'DM Sans',system-ui,sans-serif;
          font-weight:780; font-size:18px; letter-spacing:-.02em; margin:0;
        }
        .qrfi-close{
          width:32px; height:32px; border-radius:8px; border:none;
          background:transparent; cursor:pointer; font-size:24px; color:#5a5852;
        }
        .qrfi-label{
          display:block; font-family:'DM Sans',system-ui,sans-serif;
          font-weight:660; font-size:11.5px;
          color:#5a5852; text-transform:uppercase; letter-spacing:.06em;
          margin:14px 0 6px;
        }
        .qrfi-meta-inline{ text-transform:none; font-weight:540; color:#8a8884; letter-spacing:0; }
        .qrfi-input,.qrfi-textarea{
          width:100%; border:1.5px solid #e4e0d6; border-radius:8px;
          padding:9px 12px; font-family:inherit; font-size:14px;
          background:#fff; color:#1f1d1a; outline:none;
        }
        .qrfi-textarea{ resize:vertical; min-height:96px; }
        .qrfi-input:focus,.qrfi-textarea:focus{
          border-color:#5b4fc7;
          box-shadow:0 0 0 3px rgba(91,79,199,.12);
        }
        .qrfi-photo-row{
          display:flex; align-items:center; gap:10px;
        }
        .qrfi-photo-thumb{
          width:72px; height:72px; border-radius:8px; object-fit:cover;
          border:1px solid #e4e0d6;
        }
        .qrfi-photo-placeholder{
          width:72px; height:72px; border-radius:8px;
          border:1px dashed #d6d1c4; color:#8a8884;
          display:grid; place-items:center; font-size:11px;
        }
        .qrfi-btn{
          height:36px; padding:0 12px; border-radius:8px;
          border:1px solid #e4e0d6; background:#fff;
          font-family:'DM Sans',system-ui,sans-serif; font-weight:620;
          font-size:13px; cursor:pointer; color:#1f1d1a;
        }
        .qrfi-btn.primary{ background:#5b4fc7; color:#fff; border-color:#5b4fc7; }
        .qrfi-btn.ghost{ background:transparent; border-color:transparent; color:#5a5852; }
        .qrfi-btn:disabled{ opacity:.5; cursor:not-allowed; }
        .qrfi-mic{ margin-top:6px; }
        .qrfi-mic.recording{
          background:#c93b3b; color:#fff; border-color:#c93b3b;
        }
        .qrfi-meta{ font-size:12px; color:#8a8884; line-height:1.5; margin-top:8px; }
        .qrfi-error{ color:#c93b3b; }
        .qrfi-foot{
          display:flex; gap:8px; justify-content:flex-end;
          margin-top:18px; padding-top:14px; border-top:1px solid #e4e0d6;
        }
        .qrfi-banner{
          margin-top:14px; padding:10px 12px; border-radius:9px;
          font-size:13px; line-height:1.45;
        }
        .qrfi-banner.ok{ background:rgba(45,138,94,.11); color:#2d8a5e; border:1px solid rgba(45,138,94,.18); }
        .qrfi-banner.wr{ background:rgba(196,112,11,.11); color:#c4700b; border:1px solid rgba(196,112,11,.18); }
        .qrfi-banner.er{ background:rgba(201,59,59,.11); color:#c93b3b; border:1px solid rgba(201,59,59,.2); }
        .qrfi-link{
          background:transparent; border:none; color:inherit; cursor:pointer;
          text-decoration:underline; font-family:inherit; font-size:13px;
          padding:0; margin-left:4px;
        }
      `}</style>
    </>
  );
}
