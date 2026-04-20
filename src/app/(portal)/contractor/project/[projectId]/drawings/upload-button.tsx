"use client";

// Thin client wrapper that owns the modal open/close state + renders the
// upload-set CTA. Lives next to the server-rendered sets page so that
// page can stay fully server-rendered while still surfacing a modal
// experience matching docs/specs/builtcrm_drawings_module.jsx.

import { useState } from "react";

import { UploadModal } from "./upload-modal";

export function UploadSetButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="dr-btn primary"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Upload Set
      </button>
      {open ? (
        <UploadModal
          projectId={projectId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
