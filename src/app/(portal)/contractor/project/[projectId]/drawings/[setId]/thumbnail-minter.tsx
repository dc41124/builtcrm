"use client";

// Lazy client-side thumbnail generation. On first visit to a sheet index
// where any sheet lacks a thumbnail_key, we pick the first N missing
// sheets, render each to an offscreen <canvas> via react-pdf at 240px,
// capture a PNG blob, and run the GET/PUT/POST handshake against
// /api/drawings/sheets/[sheetId]/thumbnail. Batched sequentially to avoid
// overloading the browser or racing the presign TTL.
//
// The PDF source URL is passed in as a prop so we don't re-presign per
// sheet — one presign covers the whole set. If the URL's TTL expires
// mid-queue, we just give up and let the next visit finish the job.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

type PdfPageProps = {
  pageNumber: number;
  width: number;
  onRenderSuccess?: () => void;
};

const PdfDocument = dynamic(
  async () => {
    const mod = await import("react-pdf");
    const { pdfjs } = mod;
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    }
    return mod.Document;
  },
  { ssr: false },
);

const PdfPage = dynamic<PdfPageProps>(
  async () => (await import("react-pdf")).Page,
  { ssr: false },
);

const THUMB_WIDTH = 240;
const BATCH_PER_VISIT = 8;

export function ThumbnailMinter(props: {
  sourceUrl: string | null;
  pendingSheets: Array<{ id: string; pageIndex: number }>;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<
    { id: string; pageIndex: number } | null
  >(null);
  const queueRef = useRef<Array<{ id: string; pageIndex: number }>>(
    props.pendingSheets.slice(0, BATCH_PER_VISIT),
  );
  const processedRef = useRef<Set<string>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortedRef = useRef(false);

  useEffect(
    () => () => {
      abortedRef.current = true;
    },
    [],
  );

  useEffect(() => {
    if (!props.sourceUrl || queueRef.current.length === 0) return;
    if (current) return;
    const next = queueRef.current.shift();
    if (next) setCurrent(next);
  }, [current, props.sourceUrl]);

  async function onPageRendered() {
    if (abortedRef.current || !current) return;
    const canvas = wrapRef.current?.querySelector("canvas") as
      | HTMLCanvasElement
      | null;
    if (!canvas) return;
    if (processedRef.current.has(current.id)) return;
    processedRef.current.add(current.id);
    try {
      // 1. Presign the PUT URL for this sheet's thumbnail.
      const presignRes = await fetch(
        `/api/drawings/sheets/${current.id}/thumbnail?action=presign`,
      );
      if (!presignRes.ok) throw new Error(`presign ${presignRes.status}`);
      const { uploadUrl, storageKey } = (await presignRes.json()) as {
        uploadUrl: string;
        storageKey: string;
      };

      // 2. Canvas → PNG blob → PUT to R2.
      const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });
      if (!blob) throw new Error("toBlob returned null");
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      if (!putRes.ok) throw new Error(`put ${putRes.status}`);

      // 3. Notify the API so the DB row picks up the thumbnail_key.
      const notifyRes = await fetch(
        `/api/drawings/sheets/${current.id}/thumbnail`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storageKey }),
        },
      );
      if (!notifyRes.ok) throw new Error(`notify ${notifyRes.status}`);
    } catch (err) {
      // Swallow + log — a failed thumbnail is non-fatal; the placeholder
      // still shows and the next visit will retry.
      console.warn("thumbnail mint failed", err);
    }
    // Move on.
    if (abortedRef.current) return;
    const next = queueRef.current.shift();
    if (next) {
      setCurrent(next);
    } else {
      setCurrent(null);
      // All done — refresh so the loader presigns the new thumbnails.
      router.refresh();
    }
  }

  if (!props.sourceUrl || !current) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: "fixed",
        top: -9999,
        left: -9999,
        width: THUMB_WIDTH,
        height: THUMB_WIDTH * 1.3,
        visibility: "hidden",
      }}
    >
      <PdfDocument file={props.sourceUrl}>
        <PdfPage
          pageNumber={current.pageIndex + 1}
          width={THUMB_WIDTH}
          onRenderSuccess={onPageRendered}
        />
      </PdfDocument>
    </div>
  );
}
