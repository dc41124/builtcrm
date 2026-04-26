import { and, desc, eq, inArray } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import { documents, users } from "@/db/schema";
import { presignDownloadUrl } from "@/lib/storage";

export type PhotoRow = {
  id: string;
  title: string;
  documentType: string;
  uploaderName: string | null;
  createdAt: Date;
  url: string | null;
};

export type PhotoSet = {
  id: string;
  title: string;
  uploaderName: string;
  count: number;
  date: Date;
  dateLabel: string;
  photos: PhotoRow[];
};

export type CommercialPhotosData = {
  sets: PhotoSet[];
  totalCount: number;
  setCount: number;
  lastUploadedAt: Date | null;
  distinctTypes: string[];
};

const PHOTO_DOC_TYPES = ["photo", "photo_log", "progress_photo"];

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function fmtSetDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function loadCommercialProjectPhotos(
  projectId: string,
  callerOrgId: string,
): Promise<CommercialPhotosData> {
  const rows = await withTenant(callerOrgId, (tx) =>
    tx
      .select({
      id: documents.id,
      title: documents.title,
      documentType: documents.documentType,
      storageKey: documents.storageKey,
      createdAt: documents.createdAt,
      uploadedByUserId: documents.uploadedByUserId,
      uploaderName: users.displayName,
      visibilityScope: documents.visibilityScope,
    })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.uploadedByUserId))
      .where(
        and(
          eq(documents.projectId, projectId),
          inArray(documents.documentType, PHOTO_DOC_TYPES),
          eq(documents.documentStatus, "active"),
          inArray(documents.visibilityScope, ["project_wide", "client_visible"]),
        ),
      )
      .orderBy(desc(documents.createdAt)),
  );

  // Presign GET urls for every photo in parallel. If presigning fails for
  // any row (e.g., storage misconfig), fall back to null so the view renders
  // the gradient placeholder instead of a broken image.
  const urlById = new Map<string, string>();
  await Promise.all(
    rows.map(async (r) => {
      try {
        const url = await presignDownloadUrl({
          key: r.storageKey,
          expiresInSeconds: 60 * 10,
        });
        urlById.set(r.id, url);
      } catch {
        // swallow — tile falls back to placeholder
      }
    }),
  );

  const grouped = new Map<
    string,
    {
      key: string;
      uploaderName: string;
      date: Date;
      photos: PhotoRow[];
    }
  >();

  for (const r of rows) {
    const day = dayKey(r.createdAt);
    const uploader = r.uploaderName ?? "Project team";
    const key = `${day}::${uploader}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        key,
        uploaderName: uploader,
        date: r.createdAt,
        photos: [],
      };
      grouped.set(key, group);
    }
    group.photos.push({
      id: r.id,
      title: r.title,
      documentType: r.documentType,
      uploaderName: r.uploaderName,
      createdAt: r.createdAt,
      url: urlById.get(r.id) ?? null,
    });
  }

  const sets: PhotoSet[] = Array.from(grouped.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((g) => ({
      id: g.key,
      title: `${g.photos.length} ${g.photos.length === 1 ? "photo" : "photos"} — ${fmtSetDate(g.date)}`,
      uploaderName: g.uploaderName,
      count: g.photos.length,
      date: g.date,
      dateLabel: fmtSetDate(g.date),
      photos: g.photos,
    }));

  const distinctTypes = Array.from(new Set(rows.map((r) => r.documentType)));

  return {
    sets,
    totalCount: rows.length,
    setCount: sets.length,
    lastUploadedAt: rows[0]?.createdAt ?? null,
    distinctTypes,
  };
}
