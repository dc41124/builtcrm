"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { DocumentRow } from "@/domain/loaders/project-home";
import type { LinkableItem } from "@/domain/loaders/documents";
import {
  CATEGORY_UPLOAD_DEFAULTS,
  RESIDENTIAL_HIDDEN_CATEGORIES,
  RESIDENTIAL_RAIL,
  type DocumentCategory,
} from "@/lib/document-categories";
import { type PortalType } from "@/lib/portal-colors";

type PortalVariant = PortalType;

type Props = {
  portal: PortalVariant;
  projectId: string;
  projectName: string;
  currentUserId: string;
  canWrite: boolean;
  canManageAnyDoc: boolean;
  documents: DocumentRow[];
  linkableItems: LinkableItem[];
};

// Rail taxonomy for contractor / subcontractor / commercial portals. Maps
// one-to-one onto the Postgres document_category enum; the residential
// portal uses RESIDENTIAL_RAIL (from lib/document-categories) which
// collapses drawings+specifications and hides back-office buckets.
type CategoryDef = {
  id: DocumentCategory;
  label: string;
  group: "Construction" | "Administration" | null;
  icon:
    | "drawing"
    | "spec"
    | "doc"
    | "contract"
    | "shield"
    | "permit"
    | "folder"
    | "receipt";
};

const CATEGORIES: CategoryDef[] = [
  { id: "drawings", label: "Drawings / Plans", group: "Construction", icon: "drawing" },
  { id: "specifications", label: "Specifications", group: "Construction", icon: "spec" },
  { id: "submittal", label: "Submittals", group: "Construction", icon: "doc" },
  { id: "photos", label: "Photos", group: "Construction", icon: "folder" },
  { id: "contracts", label: "Contracts", group: "Administration", icon: "contract" },
  { id: "permits", label: "Permits", group: "Administration", icon: "permit" },
  { id: "compliance", label: "Compliance / Insurance", group: "Administration", icon: "shield" },
  { id: "billing_backup", label: "Billing Backup", group: "Administration", icon: "receipt" },
  { id: "other", label: "Other", group: null, icon: "folder" },
];

// Residential-flavored label for the technical rail entries. The top-level
// "Plans & Specs" merge is handled in grouped[]/filter(); this map is only
// used when `portal === "residential"` to soften Administration-side text.
const RESIDENTIAL_CATEGORY_LABEL: Partial<Record<DocumentCategory, string>> = {
  contracts: "Contracts",
  permits: "Permits",
  photos: "Photos",
  other: "Other",
};

// File-extension → coloured icon chip. Matches the prototype's dwg/pdf/doc/xls/img buckets.
function extBucket(title: string, storageKey: string): "dwg" | "pdf" | "doc" | "xls" | "img" {
  const name = (storageKey || title).toLowerCase();
  const ext = name.split(".").pop() ?? "";
  if (ext === "dwg" || ext === "dxf") return "dwg";
  if (ext === "pdf") return "pdf";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "xls";
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "img";
  return "doc";
}

const EXT_COLOR: Record<ReturnType<typeof extBucket>, { bg: string; c: string; label: string }> = {
  dwg: { bg: "#e8f1fa", c: "#3178b9", label: "DWG" },
  pdf: { bg: "#fdeaea", c: "#c93b3b", label: "PDF" },
  doc: { bg: "#eeedfb", c: "#5b4fc7", label: "DOC" },
  xls: { bg: "#edf7f1", c: "#1e6b46", label: "XLS" },
  img: { bg: "#edf7f1", c: "#2d8a5e", label: "IMG" },
};

function visibilityStyle(v: string): { bg: string; c: string; label: string } {
  switch (v) {
    case "project_wide":
      return { bg: "var(--ac-s)", c: "var(--ac-t)", label: "Project-Wide" };
    case "internal_only":
      return { bg: "var(--s2)", c: "var(--t3)", label: "Internal" };
    case "client_visible":
      return { bg: "var(--ok-s)", c: "var(--ok-t)", label: "Client-Visible" };
    case "subcontractor_scoped":
      return { bg: "var(--in-s)", c: "var(--in-t)", label: "Sub-Scoped" };
    case "phase_scoped":
      return { bg: "var(--s2)", c: "var(--t3)", label: "Phase-Scoped" };
    case "scope_scoped":
      return { bg: "var(--s2)", c: "var(--t3)", label: "Scope-Scoped" };
    default:
      return { bg: "var(--s2)", c: "var(--t3)", label: v };
  }
}

function linkStyle(t: string): { bg: string; c: string } {
  switch (t) {
    case "rfi":
      return { bg: "var(--in-s)", c: "var(--in-t)" };
    case "change_order":
      return { bg: "var(--wr-s)", c: "var(--wr-t)" };
    case "approval":
      return { bg: "var(--ac-s)", c: "var(--ac-t)" };
    case "compliance_record":
      return { bg: "var(--dg-s)", c: "var(--dg-t)" };
    case "draw_request":
      return { bg: "var(--ok-s)", c: "var(--ok-t)" };
    default:
      return { bg: "var(--s2)", c: "var(--t3)" };
  }
}

function linkLabel(t: string, id: string): string {
  switch (t) {
    case "rfi":
      return `RFI · ${id.slice(0, 6)}`;
    case "change_order":
      return `CO · ${id.slice(0, 6)}`;
    case "approval":
      return `Approval · ${id.slice(0, 6)}`;
    case "compliance_record":
      return "Compliance";
    case "draw_request":
      return `Draw · ${id.slice(0, 6)}`;
    case "document":
      return "Supersedes";
    default:
      return t;
  }
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Icon({ name }: { name: string }) {
  const p = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2 } as const;
  switch (name) {
    case "folder":
      return <svg {...p}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>;
    case "drawing":
      return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></svg>;
    case "spec":
      return <svg {...p}><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><path d="M10 12h4" /><path d="M10 16h4" /></svg>;
    case "doc":
      return <svg {...p}><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "contract":
      return <svg {...p}><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" /><path d="M14 2v6h6" /></svg>;
    case "shield":
      return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>;
    case "permit":
      return <svg {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>;
    case "receipt":
      return <svg {...p}><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2l-1 2-3-2-3 2-3-2-3 2-3-2z" /><path d="M8 8h8" /><path d="M8 12h8" /></svg>;
    case "upload":
      return <svg {...p} strokeWidth={2.4}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>;
    case "download":
      return <svg {...p} strokeWidth={2.4}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
    case "x":
      return <svg {...p} strokeWidth={2.4}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case "search":
      return <svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case "check":
      return <svg {...p} strokeWidth={2.4}><polyline points="20 6 9 17 4 12" /></svg>;
    case "dots":
      return <svg {...p} strokeWidth={2.4}><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /><circle cx="5" cy="12" r="1.2" /></svg>;
    default:
      return null;
  }
}

const UPLOAD_CATEGORY_OPTIONS: Array<{ value: DocumentCategory; label: string }> =
  CATEGORIES.filter((c) => c.id !== "other").map((c) => ({
    value: c.id,
    label: c.label,
  }));

const VISIBILITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "project_wide", label: "Project-Wide (All Members)" },
  { value: "internal_only", label: "Internal Only (Contractor Team)" },
  { value: "client_visible", label: "Client-Visible" },
  { value: "subcontractor_scoped", label: "Subcontractor-Scoped" },
];

const AUDIENCE_FOR_VISIBILITY: Record<string, string> = {
  project_wide: "mixed",
  internal_only: "contractor",
  client_visible: "client",
  subcontractor_scoped: "subcontractor",
};

export function DocumentsWorkspace({
  portal,
  projectId,
  projectName,
  currentUserId,
  canWrite,
  canManageAnyDoc,
  documents,
  linkableItems,
}: Props) {
  const router = useRouter();

  const [showSuperseded, setShowSuperseded] = useState(false);
  const [selCat, setSelCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [presetFile, setPresetFile] = useState<File | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close row overflow menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".docws-row-menu") && !target.closest(".docws-row-btn")) {
        setOpenMenuId(null);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [openMenuId]);

  // Supersession chain indices keyed off the supersedes_document_id
  // column (Step 22). `olderOf` maps each doc id → the single
  // predecessor it directly supersedes (chain is linear per the
  // partial-unique DB index). `newerOf` is the inverse lookup —
  // predecessor id → successor id — used for the forward walk.
  // `versionInfo` pre-computes (position, total) per doc so the row
  // renderer can show "v3 of 3" without walking the chain inline.
  const { olderOf, newerOf, versionInfo } = useMemo(() => {
    const o = new Map<string, string>();
    const n = new Map<string, string>();
    for (const d of documents) {
      if (d.supersedesDocumentId) {
        o.set(d.id, d.supersedesDocumentId);
        n.set(d.supersedesDocumentId, d.id);
      }
    }
    // For every doc, count its position (1 = oldest root) and the
    // total chain length. Walk ignores docs the current audience
    // can't see, so positions stay consistent within the filtered
    // set. Hop cap defends against corrupt chains.
    const HOP_CAP = 32;
    const pos = new Map<string, { position: number; total: number }>();
    for (const d of documents) {
      // Compute chain total by walking to root, then forward to head.
      const seen = new Set<string>();
      let root = d.id;
      let back = o.get(root);
      while (back && !seen.has(back) && seen.size < HOP_CAP) {
        seen.add(back);
        root = back;
        back = o.get(root);
      }
      // Walk forward from root counting each step until we hit this doc
      // and then continue to the head.
      const fwSeen = new Set<string>([root]);
      let selfPosition = 1;
      let hop = 1;
      let cursor = root;
      if (cursor === d.id) selfPosition = hop;
      let forward = n.get(cursor);
      while (forward && !fwSeen.has(forward) && fwSeen.size < HOP_CAP) {
        fwSeen.add(forward);
        cursor = forward;
        hop += 1;
        if (cursor === d.id) selfPosition = hop;
        forward = n.get(cursor);
      }
      pos.set(d.id, { position: selfPosition, total: hop });
    }
    return { olderOf: o, newerOf: n, versionInfo: pos };
  }, [documents]);

  const visibleDocs = useMemo(
    () => documents.filter((d) => showSuperseded || !d.isSuperseded),
    [documents, showSuperseded],
  );

  const isResidential = portal === "residential";

  // Residential portal hides submittal / compliance / billing_backup rows
  // entirely — they never appear in the rail counts or the main list.
  // The loader already scopes by audience; this is an additional guardrail
  // so a back-office row that somehow passes audience filters still stays
  // out of the homeowner's UI.
  const portalVisibleDocs = useMemo(() => {
    if (!isResidential) return visibleDocs;
    return visibleDocs.filter(
      (d) => !RESIDENTIAL_HIDDEN_CATEGORIES.includes(d.category),
    );
  }, [visibleDocs, isResidential]);

  // Residential rail bundles drawings + specifications under a single
  // "plans_and_specs" tab. Contractor / sub / commercial rails map each
  // rail entry one-to-one to a DocumentCategory. `selCat === "all"` and
  // direct category ids are kept as-is; the "plans_and_specs" id is
  // residential-only.
  const residentialRailIdFor = (cat: DocumentCategory): string | null => {
    for (const entry of RESIDENTIAL_RAIL) {
      if (entry.matchesCategories.includes(cat)) return entry.id;
    }
    return null;
  };

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of portalVisibleDocs) {
      if (isResidential) {
        const railId = residentialRailIdFor(d.category);
        if (!railId) continue;
        counts.set(railId, (counts.get(railId) ?? 0) + 1);
      } else {
        counts.set(d.category, (counts.get(d.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [portalVisibleDocs, isResidential]);

  const filtered = useMemo(() => {
    let list = portalVisibleDocs;
    if (selCat !== "all") {
      if (isResidential) {
        const entry = RESIDENTIAL_RAIL.find((r) => r.id === selCat);
        if (entry) {
          list = list.filter((d) => entry.matchesCategories.includes(d.category));
        } else {
          list = list.filter((d) => d.category === selCat);
        }
      } else {
        list = list.filter((d) => d.category === selCat);
      }
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.documentType.toLowerCase().includes(q),
      );
    }
    return list;
  }, [portalVisibleDocs, selCat, query, isResidential]);

  const selected = useMemo(
    () => documents.find((d) => d.id === selectedId) ?? null,
    [documents, selectedId],
  );

  // Version history: full ordered chain (newest first) by walking the
  // supersedes column in both directions from the selected doc. Linear
  // by construction — partial unique index guarantees one predecessor
  // and one successor per node.
  const versionChain = useMemo(() => {
    if (!selected) return [] as DocumentRow[];
    const byId = new Map(documents.map((d) => [d.id, d] as const));
    const HOP_CAP = 32;

    // Walk forward (newer side) from selected up to the head.
    const forward: DocumentRow[] = [];
    {
      let cursor: string | undefined = newerOf.get(selected.id);
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor) && forward.length < HOP_CAP) {
        seen.add(cursor);
        const row = byId.get(cursor);
        if (!row) break;
        forward.push(row);
        cursor = newerOf.get(row.id);
      }
    }

    // Walk backward (older side) from selected down to the root.
    const backward: DocumentRow[] = [];
    {
      let cursor: string | undefined = olderOf.get(selected.id);
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor) && backward.length < HOP_CAP) {
        seen.add(cursor);
        const row = byId.get(cursor);
        if (!row) break;
        backward.push(row);
        cursor = olderOf.get(row.id);
      }
    }

    // Render order: newest first (forward reversed is still newest
    // first since we walked head-ward; simpler to reverse the final
    // order to newest-first).
    return [...forward.reverse(), selected, ...backward];
  }, [selected, documents, olderOf, newerOf]);

  async function downloadDoc(docId: string) {
    const res = await fetch(`/api/files/${docId}`);
    if (!res.ok) return;
    const body = (await res.json()) as { downloadUrl: string };
    window.open(body.downloadUrl, "_blank", "noopener");
  }

  // Rail structure. Contractor / sub / commercial use the full
  // Construction/Administration grouping. Residential uses a flat five-entry
  // rail (Plans & Specs, Contracts, Photos, Permits, Other) with no group
  // headers — homeowners don't need the taxonomy split.
  type RailEntry = { id: string; label: string; icon: CategoryDef["icon"] };
  const grouped = useMemo(() => {
    if (isResidential) {
      const entries: RailEntry[] = RESIDENTIAL_RAIL.map((r) => {
        // Pick an icon from the first underlying category that has one.
        const firstCat = r.matchesCategories[0];
        const def = CATEGORIES.find((c) => c.id === firstCat);
        return {
          id: r.id,
          label:
            RESIDENTIAL_CATEGORY_LABEL[firstCat] ?? r.label ?? def?.label ?? r.id,
          icon: def?.icon ?? "folder",
        };
      });
      return [{ group: null as string | null, items: entries }];
    }
    const order: Array<{ group: string | null; items: RailEntry[] }> = [];
    const byGroup = new Map<string | null, RailEntry[]>();
    for (const c of CATEGORIES) {
      const arr = byGroup.get(c.group) ?? [];
      arr.push({ id: c.id, label: c.label, icon: c.icon });
      byGroup.set(c.group, arr);
    }
    byGroup.forEach((items, group) => order.push({ group, items }));
    return order;
  }, [isResidential]);

  return (
    <div className={`docws docws-${portal}`}>
      

      <div className="docws-hdr">
        <div>
          <h1>Documents</h1>
          <div className="docws-sub">
            {projectName} · {documents.length} document{documents.length === 1 ? "" : "s"}
          </div>
        </div>
        {canWrite && (
          <button
            type="button"
            className="docws-btn primary"
            onClick={() => setShowUpload((v) => !v)}
          >
            <Icon name="upload" /> Upload Document
          </button>
        )}
      </div>

      {canWrite && !showUpload && (
        <PermanentUploadZone
          onFilePicked={(f) => {
            setPresetFile(f);
            setShowUpload(true);
          }}
        />
      )}

      {showUpload && canWrite && (
        <UploadPanel
          portal={portal}
          projectId={projectId}
          linkableItems={linkableItems}
          presetFile={presetFile}
          onClose={() => {
            setShowUpload(false);
            setPresetFile(null);
          }}
          onDone={() => {
            setShowUpload(false);
            setPresetFile(null);
            router.refresh();
          }}
        />
      )}

      <div className={`docws-db${selected ? " detail" : ""}`}>
        <aside className="docws-cp">
          <div className="docws-cp-hdr">Categories</div>
          <div className="docws-cp-list">
            <button
              type="button"
              className={`docws-ci${selCat === "all" ? " on" : ""}`}
              onClick={() => setSelCat("all")}
            >
              <span className="docws-ci-left"><Icon name="folder" /> <span>All Documents</span></span>
              <span className="docws-ci-ct">{portalVisibleDocs.length}</span>
            </button>
            {grouped.map(({ group, items }) => (
              <div key={group ?? "_"}>
                {group && <div className="docws-cg-lbl">{group}</div>}
                {items.map((c) => {
                  const count = categoryCounts.get(c.id) ?? 0;
                  if (count === 0 && c.id === "other") return null;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`docws-ci${selCat === c.id ? " on" : ""}`}
                      onClick={() => setSelCat(c.id)}
                    >
                      <span className="docws-ci-left"><Icon name={c.icon} /> <span>{c.label}</span></span>
                      <span className="docws-ci-ct">{count}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        <div className="docws-fa">
          <div className="docws-ft">
            <div className="docws-ft-srch-wrap">
              <Icon name="search" />
              <input
                className="docws-ft-srch"
                placeholder="Search documents..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="docws-ft-toggle">
              <input
                type="checkbox"
                checked={showSuperseded}
                onChange={(e) => setShowSuperseded(e.target.checked)}
              />
              Show superseded
            </label>
          </div>
          <div className="docws-fs">
            {filtered.length === 0 ? (
              <div className="docws-empty">No documents match the current filter.</div>
            ) : (
              <table className="docws-ftbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Visibility</th>
                    <th>Linked</th>
                    <th>Uploaded</th>
                    <th className="docws-th-acts">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const ext = extBucket(d.title, d.storageKey);
                    const extColor = EXT_COLOR[ext];
                    const vis = visibilityStyle(d.visibilityScope);
                    const nonProjectLinks = d.links.filter(
                      (l) => l.linkedObjectType !== "project" && l.linkRole !== "supersedes",
                    );
                    return (
                      <tr
                        key={d.id}
                        className={`${selectedId === d.id ? "sel" : ""} ${d.isSuperseded ? "sup" : ""}`}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <td>
                          <div className="docws-fn-cell">
                            <div
                              className="docws-fn-ic"
                              style={{ background: extColor.bg, color: extColor.c }}
                            >
                              {extColor.label}
                            </div>
                            <div className="docws-fn-txt">
                              <div className="docws-fn-title">
                                {d.title}
                                {versionInfo.get(d.id) &&
                                versionInfo.get(d.id)!.total > 1 ? (
                                  <span
                                    className="docws-ver-pill"
                                    title={`Version ${versionInfo.get(d.id)!.position} of ${versionInfo.get(d.id)!.total}`}
                                  >
                                    v{versionInfo.get(d.id)!.position} of{" "}
                                    {versionInfo.get(d.id)!.total}
                                  </span>
                                ) : null}
                              </div>
                              <div className="docws-fn-ext">
                                {CATEGORIES.find((c) => c.id === d.category)?.label ??
                                  d.documentType}
                                {d.isSuperseded ? " · superseded" : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="docws-vis-pl" style={{ background: vis.bg, color: vis.c }}>
                            {vis.label}
                          </span>
                        </td>
                        <td>
                          {nonProjectLinks.length === 0 ? (
                            <span style={{ color: "var(--t3)", fontSize: 12 }}>—</span>
                          ) : (
                            nonProjectLinks.slice(0, 2).map((l, i) => {
                              const lk = linkStyle(l.linkedObjectType);
                              return (
                                <span
                                  key={i}
                                  className="docws-lk-pl"
                                  style={{ background: lk.bg, color: lk.c, marginRight: 4 }}
                                >
                                  {linkLabel(l.linkedObjectType, l.linkedObjectId)}
                                </span>
                              );
                            })
                          )}
                        </td>
                        <td>
                          <div className="docws-f-dt">{formatDate(d.createdAt)}</div>
                          <div className="docws-f-by">{d.uploadedByName ?? "—"}</div>
                        </td>
                        <td className="docws-td-acts">
                          <div className="docws-row-acts">
                            <button
                              type="button"
                              className="docws-row-btn"
                              aria-label="Download"
                              title="Download"
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadDoc(d.id);
                              }}
                            >
                              <Icon name="download" />
                            </button>
                            <div style={{ position: "relative" }}>
                              <button
                                type="button"
                                className="docws-row-btn"
                                aria-label="More actions"
                                title="More actions"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === d.id ? null : d.id);
                                }}
                              >
                                <Icon name="dots" />
                              </button>
                              {openMenuId === d.id ? (
                                <div
                                  className="docws-row-menu"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    className="docws-row-menu-item"
                                    onClick={() => {
                                      setSelectedId(d.id);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    <Icon name="folder" /> View details
                                  </button>
                                  <button
                                    type="button"
                                    className="docws-row-menu-item"
                                    onClick={() => {
                                      downloadDoc(d.id);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    <Icon name="download" /> Download
                                  </button>
                                  {canWrite &&
                                  !d.isSuperseded &&
                                  (canManageAnyDoc ||
                                    d.uploadedByUserId === currentUserId) ? (
                                    <button
                                      type="button"
                                      className="docws-row-menu-item"
                                      onClick={() => {
                                        setSelectedId(d.id);
                                        setOpenMenuId(null);
                                      }}
                                    >
                                      <Icon name="upload" /> Supersede
                                    </button>
                                  ) : null}
                                  {canWrite &&
                                  d.uploadedByUserId === currentUserId &&
                                  !d.isSuperseded ? (
                                    <button
                                      type="button"
                                      className="docws-row-menu-item danger"
                                      onClick={async () => {
                                        setOpenMenuId(null);
                                        if (!window.confirm("Archive this document?")) return;
                                        const res = await fetch(`/api/documents/${d.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ documentStatus: "archived" }),
                                        });
                                        if (res.ok) router.refresh();
                                      }}
                                    >
                                      <Icon name="x" /> Archive
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected && (
          <DetailPanel
            key={selected.id}
            doc={selected}
            versionChain={versionChain}
            canWrite={canWrite}
            canSupersede={
              canWrite &&
              !selected.isSuperseded &&
              (canManageAnyDoc || selected.uploadedByUserId === currentUserId)
            }
            canEditThis={canWrite && !selected.isSuperseded && selected.uploadedByUserId === currentUserId}
            onClose={() => setSelectedId(null)}
            onDownload={() => downloadDoc(selected.id)}
            onRefresh={() => router.refresh()}
            projectId={projectId}
          />
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  doc,
  versionChain,
  canWrite: _canWrite,
  canSupersede,
  canEditThis,
  onClose,
  onDownload,
  onRefresh,
  projectId,
}: {
  doc: DocumentRow;
  versionChain: DocumentRow[];
  canWrite: boolean;
  canSupersede: boolean;
  canEditThis: boolean;
  onClose: () => void;
  onDownload: () => void;
  onRefresh: () => void;
  projectId: string;
}) {
  const ext = extBucket(doc.title, doc.storageKey);
  const extColor = EXT_COLOR[ext];
  const vis = visibilityStyle(doc.visibilityScope);
  const nonProjectLinks = doc.links.filter(
    (l) => l.linkedObjectType !== "project" && l.linkRole !== "supersedes",
  );

  return (
    <aside className="docws-dp">
      <div className="docws-dp-hdr">
        <button type="button" className="docws-dp-close" onClick={onClose}>
          <Icon name="x" />
        </button>
        <div className="docws-dp-ic" style={{ background: extColor.bg, color: extColor.c }}>
          {extColor.label}
        </div>
        <div className="docws-dp-title">{doc.title}</div>
        <div className="docws-dp-ext">{doc.documentType}</div>
        <div className="docws-dp-acts">
          <button type="button" className="docws-btn primary" onClick={onDownload}>
            <Icon name="download" /> Download
          </button>
          {canSupersede && (
            <SupersedeButton
              docId={doc.id}
              projectId={projectId}
              priorUploadedByName={doc.uploadedByName}
              priorUploadedAt={doc.createdAt}
              onDone={onRefresh}
            />
          )}
        </div>
      </div>
      <div className="docws-dp-scroll">
        <div className="docws-ds">
          <div className="docws-ds-title">Properties</div>
          <div className="docws-dr"><span className="docws-dr-k">Type</span><span className="docws-dr-v">{doc.documentType}</span></div>
          <div className="docws-dr">
            <span className="docws-dr-k">Visibility</span>
            <span className="docws-dr-v">
              <span className="docws-vis-pl" style={{ background: vis.bg, color: vis.c }}>{vis.label}</span>
            </span>
          </div>
          <div className="docws-dr"><span className="docws-dr-k">Status</span><span className="docws-dr-v">{doc.documentStatus}</span></div>
          <div className="docws-dr"><span className="docws-dr-k">Uploaded By</span><span className="docws-dr-v">{doc.uploadedByName ?? "—"}</span></div>
          <div className="docws-dr"><span className="docws-dr-k">Date Added</span><span className="docws-dr-v">{formatDate(doc.createdAt)}</span></div>
          <div className="docws-dr"><span className="docws-dr-k">Storage Key</span><span className="docws-dr-v mono">{doc.storageKey}</span></div>
        </div>

        {nonProjectLinks.length > 0 && (
          <div className="docws-ds">
            <div className="docws-ds-title">Linked Items</div>
            {nonProjectLinks.map((l, i) => {
              const lk = linkStyle(l.linkedObjectType);
              return (
                <div key={i} className="docws-dr">
                  <span className="docws-dr-k">{l.linkRole}</span>
                  <span className="docws-dr-v">
                    <span className="docws-lk-pl" style={{ background: lk.bg, color: lk.c }}>
                      {linkLabel(l.linkedObjectType, l.linkedObjectId)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {versionChain.length > 1 && (
          <div className="docws-ds">
            <div className="docws-ds-title">Version History</div>
            <div className="docws-vl">
              {versionChain.map((v, i) => {
                const current = v.id === doc.id && !doc.isSuperseded;
                return (
                  <div key={v.id} className={`docws-vi${current ? " cur" : ""}`}>
                    <div className="docws-vi-dot">
                      <Icon name={current ? "check" : "doc"} />
                    </div>
                    <div>
                      <div className="docws-vi-lbl">
                        Version {versionChain.length - i}
                        {current ? " (Current)" : " (Superseded)"}
                      </div>
                      <div className="docws-vi-meta">
                        {v.uploadedByName ?? "—"} · {formatDate(v.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {canEditThis && (
          <div className="docws-ds">
            <div className="docws-ds-title">Actions</div>
            <ArchiveButton docId={doc.id} onDone={onRefresh} />
          </div>
        )}
      </div>
    </aside>
  );
}

function PermanentUploadZone({
  onFilePicked,
}: {
  onFilePicked: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFilePicked(file);
  }

  return (
    <div
      className={`docws-uz${dragging ? " drag" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFilePicked(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Icon name="upload" />
      <h4>Upload your documents</h4>
      <p>
        Drop files here or click to browse. Insurance certificates, signed
        contracts, tax exemptions, and other owner-provided documents.
      </p>
      <div className="docws-uz-types">
        Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG · Max 50 MB per file
      </div>
    </div>
  );
}

function SupersedeButton({
  docId,
  projectId,
  priorUploadedByName,
  priorUploadedAt,
  onDone,
}: {
  docId: string;
  projectId: string;
  priorUploadedByName: string | null;
  priorUploadedAt: Date;
  onDone: () => void;
}) {
  // Two-step flow: click opens a confirmation card with a prominent
  // "Previous version uploaded by [name] on [date]" banner, then a
  // file picker. Advisor directive — social friction to discourage
  // accidentally versioning someone else's work, without hard-blocking
  // legitimate cases (original uploader is out, PM posts architect's
  // revision, etc.).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      setConfirmOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={onChange}
        disabled={pending}
      />
      <button
        type="button"
        className="docws-btn ghost"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={pending}
      >
        <Icon name="upload" /> Upload new version
      </button>
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,22,30,0.5)",
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              borderRadius: 14,
              padding: "22px 24px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            }}
          >
            <h3
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 16,
                fontWeight: 740,
                margin: "0 0 10px",
                color: "#12141b",
              }}
            >
              Upload a new version
            </h3>
            <div
              style={{
                padding: "12px 14px",
                background: "#f4f6fa",
                border: "1px solid #e6e9ef",
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#64687a",
                  marginBottom: 4,
                }}
              >
                Previous version
              </div>
              <div
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 13,
                  fontWeight: 620,
                  color: "#12141b",
                }}
              >
                Uploaded by {priorUploadedByName ?? "Unknown"}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: "#64687a",
                }}
              >
                {formatDate(priorUploadedAt)}
              </div>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "#4a4f60",
                lineHeight: 1.5,
                margin: "0 0 16px",
              }}
            >
              Your new file will supersede this one. The category and visibility stay the same across the whole version chain.
            </p>
            {error ? (
              <div
                style={{
                  fontSize: 12,
                  color: "#a93930",
                  padding: "8px 10px",
                  background: "#fce5e1",
                  borderRadius: 6,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="docws-btn ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="docws-btn"
                onClick={() => inputRef.current?.click()}
                disabled={pending}
              >
                {pending ? "Uploading…" : "Choose file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ArchiveButton({ docId, onDone }: { docId: string; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    if (!window.confirm("Archive this document?")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/documents/${docId}`, {
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
    <>
      <button type="button" className="docws-btn ghost" onClick={archive} disabled={pending}>
        {pending ? "Archiving…" : "Archive Document"}
      </button>
      {error && <div className="docws-err">{error}</div>}
    </>
  );
}

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

function UploadPanel({
  portal,
  projectId,
  linkableItems,
  presetFile,
  onClose,
  onDone,
}: {
  portal: PortalVariant;
  projectId: string;
  linkableItems: LinkableItem[];
  presetFile?: File | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(presetFile ?? null);
  const [title, setTitle] = useState("");
  // `category` is the first-class enum value; we also echo it to
  // `documentType` so the legacy free-text column keeps a useful label.
  // The server re-derives category from documentType as a fallback, but
  // we always send both so neither side has to guess.
  const [category, setCategory] = useState<DocumentCategory>("drawings");
  const [visibilityScope, setVisibilityScope] = useState<string>(
    portal === "contractor" ? "project_wide" : "subcontractor_scoped",
  );
  // When the category changes, cascade defaults for visibility only if the
  // user hasn't manually overridden it yet. We track that by remembering
  // whether the last visibility value matched the previous category's
  // default — a tiny heuristic, but it's the cleanest way to respect
  // explicit user intent without introducing a separate "touched" flag.
  useEffect(() => {
    const next = CATEGORY_UPLOAD_DEFAULTS[category];
    setVisibilityScope((prev) => {
      const prevWasDefault = Object.values(CATEGORY_UPLOAD_DEFAULTS).some(
        (d) => d.visibilityScope === prev,
      );
      // If user picked something that isn't any category default, leave it.
      return prevWasDefault ? next.visibilityScope : prev;
    });
  }, [category]);
  const [linkKey, setLinkKey] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const storageKey = await presignAndPut(projectId, file, category);
      let sourceObject: { type: string; id: string; linkRole: string } | undefined;
      if (linkKey) {
        const [type, id] = linkKey.split(":");
        if (type && id) {
          sourceObject = { type, id, linkRole: "attachment" };
        }
      }
      const res = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey,
          title: title || file.name,
          documentType: category,
          category,
          visibilityScope,
          audienceScope: AUDIENCE_FOR_VISIBILITY[visibilityScope] ?? "mixed",
          sourceObject,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "finalize_failed");
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="docws-up">
      <h3>Upload Document</h3>
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div
        className={`docws-udz${file ? " picked" : ""}`}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="upload" />
        {file ? (
          <>
            <p>{file.name}</p>
            <span>{(file.size / 1024 / 1024).toFixed(2)} MB · click to change</span>
          </>
        ) : (
          <>
            <p>Drag a file here to upload</p>
            <span>
              or <span className="browse">browse your computer</span> · Max 50 MB per file
            </span>
          </>
        )}
      </div>

      <div className="docws-frow">
        <label className="docws-flbl">Title (defaults to filename)</label>
        <input
          className="docws-finp"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={file?.name ?? "Document title"}
        />
      </div>

      <div className="docws-frow-h">
        <div className="docws-frow">
          <label className="docws-flbl">Category</label>
          <select
            className="docws-fsel"
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          >
            {UPLOAD_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="docws-frow">
          <label className="docws-flbl">Visibility</label>
          <select
            className="docws-fsel"
            value={visibilityScope}
            onChange={(e) => setVisibilityScope(e.target.value)}
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {linkableItems.length > 0 && (
        <div className="docws-frow">
          <label className="docws-flbl">Link to Object (Optional)</label>
          <select
            className="docws-fsel"
            value={linkKey}
            onChange={(e) => setLinkKey(e.target.value)}
          >
            <option value="">None</option>
            {linkableItems.map((l) => (
              <option key={`${l.type}:${l.id}`} value={`${l.type}:${l.id}`}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="docws-facts">
        <button type="button" className="docws-btn cancel" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="docws-btn primary" onClick={submit} disabled={pending || !file}>
          {pending ? "Uploading…" : "Upload File"}
        </button>
      </div>
      {error && <div className="docws-err">{error}</div>}
    </div>
  );
}
