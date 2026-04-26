// Orchestrates the "upload is done, now extract" step of the drawings
// pipeline. Fetches the source PDF from R2, runs text extraction, writes
// drawing_sheets rows, and transitions the set to 'ready'. Called inline
// from the finalize route today; can be fronted by a Trigger.dev task
// later without changing the function signature.

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { and, desc, eq, ne } from "drizzle-orm";

import { drawingSets, drawingSheets } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { r2, R2_BUCKET } from "@/lib/storage";

import { extractSheetsFromPdf, loadPdfFromBuffer } from "./extract";

export async function processDrawingSet(
  setId: string,
  callerOrgId: string,
): Promise<{
  sheetCount: number;
  autoDetectedCount: number;
}> {
  const [set] = await withTenant(callerOrgId, (tx) =>
    tx
      .select()
      .from(drawingSets)
      .where(eq(drawingSets.id, setId))
      .limit(1),
  );
  if (!set) throw new Error(`drawing set not found: ${setId}`);
  if (!set.sourceFileKey) {
    throw new Error(`drawing set ${setId} has no sourceFileKey`);
  }

  await withTenant(callerOrgId, (tx) =>
    tx
      .update(drawingSets)
      .set({ processingStatus: "processing" })
      .where(eq(drawingSets.id, setId)),
  );

  try {
    // Pull the PDF bytes from R2 into memory. For multi-hundred-MB sheet
    // sets we would stream + chunk; 20–50 sheet PDFs are typically
    // 20–60 MB which comfortably fits in a serverless function's heap.
    const obj = await r2.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: set.sourceFileKey }),
    );
    if (!obj.Body) throw new Error("r2 returned empty body");
    const buf = Buffer.from(await obj.Body.transformToByteArray());
    const doc = await loadPdfFromBuffer(new Uint8Array(buf));

    const sheets = await extractSheetsFromPdf(doc);

    await withTenant(callerOrgId, async (tx) => {
      // Previous set in the same family (for change-detection marker). We
      // don't do real diff yet — that lives in the viewer's compare mode.
      // Here we just flag a sheet as "changed" when a sheet with the same
      // sheet_number existed on the prior set. The UI reads this as "this
      // sheet changed between versions" — rough but actionable in the
      // index view.
      let priorSheetNumbers: Set<string> | null = null;
      if (set.supersedesId) {
        const priorRows = await tx
          .select({ sheetNumber: drawingSheets.sheetNumber })
          .from(drawingSheets)
          .where(eq(drawingSheets.setId, set.supersedesId));
        priorSheetNumbers = new Set(priorRows.map((r) => r.sheetNumber));
      }

      const rows = sheets.map((s) => ({
        setId: set.id,
        pageIndex: s.pageIndex,
        sheetNumber: s.sheetNumber,
        sheetTitle: s.sheetTitle,
        discipline: s.discipline,
        autoDetected: s.autoDetected,
        changedFromPriorVersion: priorSheetNumbers
          ? priorSheetNumbers.has(s.sheetNumber)
          : false,
      }));

      if (rows.length > 0) {
        await tx.insert(drawingSheets).values(rows);
      }

      await tx
        .update(drawingSets)
        .set({
          processingStatus: "ready",
          sheetCount: sheets.length,
          processingError: null,
        })
        .where(eq(drawingSets.id, setId));

      // Now that we're ready, demote any prior current set in the same
      // family. Done after the new set's sheets are written so readers
      // never see a window with no current set.
      if (set.status === "current") {
        await tx
          .update(drawingSets)
          .set({ status: "superseded" })
          .where(
            and(
              eq(drawingSets.projectId, set.projectId),
              eq(drawingSets.family, set.family),
              eq(drawingSets.status, "current"),
              ne(drawingSets.id, set.id),
            ),
          );
      }
    });

    return {
      sheetCount: sheets.length,
      autoDetectedCount: sheets.filter((s) => s.autoDetected).length,
    };
  } catch (err) {
    await withTenant(callerOrgId, (tx) =>
      tx
        .update(drawingSets)
        .set({
          processingStatus: "failed",
          processingError:
            err instanceof Error ? err.message : "unknown extraction error",
        })
        .where(eq(drawingSets.id, setId)),
    );
    throw err;
  }
}

// Compute the next version number for a (projectId, family) chain. Used
// by the create route; returns 1 for the first set in a family, else
// max(version)+1.
export async function nextVersionFor(
  projectId: string,
  family: string,
  callerOrgId: string,
): Promise<{ nextVersion: number; currentSetId: string | null }> {
  const [latest] = await withTenant(callerOrgId, (tx) =>
    tx
      .select({ id: drawingSets.id, version: drawingSets.version })
      .from(drawingSets)
      .where(
        and(eq(drawingSets.projectId, projectId), eq(drawingSets.family, family)),
      )
      .orderBy(desc(drawingSets.version))
      .limit(1),
  );
  if (!latest) return { nextVersion: 1, currentSetId: null };
  return { nextVersion: latest.version + 1, currentSetId: latest.id };
}
