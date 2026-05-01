"use client";

// Step 61 — Custom fields admin UI.
//
// contractor_admin manages definitions per entity type (project, sub,
// document, RFI). contractor_pm sees the list read-only. The UI is
// modeled after the API Keys settings page (header → entity tabs →
// list with row actions → create/edit modal).
//
// Reorder is a simple "Move up / Move down" pair of buttons rather
// than drag-and-drop. The DnD libraries we'd otherwise pull in
// (react-dnd, dnd-kit) are 10-30KB each for what amounts to a
// rarely-used admin surface; arrows match other settings pages and
// are perfectly adequate.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  CUSTOM_FIELD_ENTITY_REGISTRY,
  type CustomFieldEntityType,
} from "@/lib/custom-fields/registry";
import { slugifyKey } from "@/lib/custom-fields/normalize";

type FieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "boolean";

export type DefinitionRow = {
  id: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  description: string | null;
  fieldType: FieldType;
  optionsJson: unknown;
  isRequired: boolean;
  orderIndex: number;
  isActive: boolean;
  archivedAtIso: string | null;
  createdAtIso: string;
};

type Option = { value: string; label: string };

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

const FIELD_TYPE_COPY: Record<FieldType, { label: string; desc: string }> = {
  text: { label: "Text", desc: "Free-form short text." },
  number: { label: "Number", desc: "Integer or decimal." },
  date: { label: "Date", desc: "Calendar date (YYYY-MM-DD)." },
  select: { label: "Select", desc: "One choice from a defined list." },
  multi_select: { label: "Multi-select", desc: "Many choices from a list." },
  boolean: { label: "Yes / No", desc: "True or false toggle." },
};

const I = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
  ),
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
  ),
  arrowUp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m-7 7 7-7 7 7" /></svg>
  ),
  arrowDown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m-7-7 7 7 7-7" /></svg>
  ),
  restore: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
  ),
};

// ────────────────────────────────────────────────────────────────────

export function CustomFieldsAdminUI({
  orgName: _orgName,
  viewerRole,
  definitions,
}: {
  orgName: string;
  viewerRole: "contractor_admin" | "contractor_pm";
  definitions: DefinitionRow[];
}) {
  const router = useRouter();
  const isAdmin = viewerRole === "contractor_admin";
  const [activeEntity, setActiveEntity] = useState<CustomFieldEntityType>(
    "project",
  );
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<DefinitionRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startRefresh] = useTransition();

  const filtered = useMemo(() => {
    const rows = definitions.filter((d) => d.entityType === activeEntity);
    return showArchived ? rows : rows.filter((d) => d.isActive);
  }, [definitions, activeEntity, showArchived]);

  const activeRows = filtered.filter((d) => d.isActive);
  const archivedCount = definitions.filter(
    (d) => d.entityType === activeEntity && !d.isActive,
  ).length;

  const onCreate = () => {
    setEditing(null);
    setError(null);
    setModal("create");
  };

  const onEdit = (def: DefinitionRow) => {
    setEditing(def);
    setError(null);
    setModal("edit");
  };

  const onArchive = async (def: DefinitionRow) => {
    if (!isAdmin) return;
    if (
      !window.confirm(
        `Archive "${def.label}"?\n\nThe field will hide from forms and list views. Existing values are preserved. You can restore it later.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractor/custom-fields/${def.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? "Failed to archive field.");
        return;
      }
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const onRestore = async (def: DefinitionRow) => {
    if (!isAdmin) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contractor/custom-fields/${def.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactivate: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? "Failed to restore field.");
        return;
      }
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const onMove = async (def: DefinitionRow, dir: -1 | 1) => {
    if (!isAdmin) return;
    const ids = activeRows.map((d) => d.id);
    const idx = ids.indexOf(def.id);
    if (idx === -1) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= ids.length) return;
    const next = [...ids];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setSubmitting(true);
    try {
      const res = await fetch("/api/contractor/custom-fields/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: activeEntity, orderedIds: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? "Failed to reorder fields.");
        return;
      }
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const submitDefinition = async (form: FormSubmitState) => {
    setSubmitting(true);
    setError(null);
    try {
      if (modal === "create") {
        const res = await fetch("/api/contractor/custom-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: activeEntity,
            label: form.label,
            key: form.key,
            description: form.description || null,
            fieldType: form.fieldType,
            options:
              form.fieldType === "select" || form.fieldType === "multi_select"
                ? form.options
                : undefined,
            isRequired: form.isRequired,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.message ?? body.error ?? "Failed to create field.");
          return;
        }
      } else if (modal === "edit" && editing) {
        const res = await fetch(`/api/contractor/custom-fields/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label,
            description: form.description || null,
            options:
              form.fieldType === "select" || form.fieldType === "multi_select"
                ? form.options
                : null,
            isRequired: form.isRequired,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.message ?? body.error ?? "Failed to update field.");
          return;
        }
      }
      setModal(null);
      setEditing(null);
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const css = `
.cf-root{
  --cf-surface-1:#ffffff;
  --cf-surface-2:#f3f4f6;
  --cf-surface-3:#e2e5e9;
  --cf-text-primary:#1a1714;
  --cf-text-secondary:#6b655b;
  --cf-text-tertiary:#9c958a;
  --cf-accent:#5b4fc7;
  --cf-accent-hover:#4f44b3;
  --cf-accent-soft:#eeedfb;
  --cf-accent-text:#4a3fb0;
  --cf-accent-muted:#c7c2ea;
  --cf-success-soft:#edf7f1;
  --cf-success-text:#1e6b46;
  --cf-warning-soft:#fdf4e6;
  --cf-warning-text:#96600f;
  --cf-danger:#c93b3b;
  --cf-danger-soft:#fdeaea;
  --cf-danger-text:#a52e2e;
  --cf-info-soft:#e8f1fa;
  --cf-info-text:#276299;
  --cf-shadow-sm:0 1px 3px rgba(26,23,20,.05);
  --cf-shadow-lg:0 16px 48px rgba(26,23,20,.18);
  font-family:${F.body};
  color:var(--cf-text-primary);
  -webkit-font-smoothing:antialiased;
}
.cf-root *{box-sizing:border-box}
.cf-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

.cf-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.cf-hdr h2{font-family:${F.display};font-size:24px;font-weight:780;letter-spacing:-.035em;margin:0;color:var(--cf-text-primary)}
.cf-hdr p{font-size:13px;color:var(--cf-text-secondary);margin-top:4px;max-width:680px;font-weight:520;line-height:1.5}
.cf-hdr-acts{display:flex;gap:8px;align-items:center;flex-shrink:0}
.cf-btn{height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--cf-surface-3);background:var(--cf-surface-1);color:var(--cf-text-secondary);font-size:12px;font-weight:620;display:inline-flex;align-items:center;gap:8px;font-family:${F.display};white-space:nowrap;transition:all .15s}
.cf-btn:hover{background:var(--cf-surface-2)}
.cf-btn.primary{background:var(--cf-accent);color:#fff;border-color:var(--cf-accent);box-shadow:var(--cf-shadow-sm)}
.cf-btn.primary:hover{background:var(--cf-accent-hover)}
.cf-btn.danger{background:var(--cf-danger);color:#fff;border-color:var(--cf-danger)}
.cf-btn:disabled{opacity:.6;cursor:not-allowed}
.cf-btn-icon{width:14px;height:14px;display:block}
.cf-btn-icon svg{width:100%;height:100%;display:block}

.cf-banner{background:var(--cf-info-soft);border:1px solid #b3d4ee;border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start}
.cf-banner-icon{width:18px;height:18px;color:var(--cf-info-text);flex-shrink:0;margin-top:1px}
.cf-banner-icon svg{width:100%;height:100%;display:block}
.cf-banner-title{font-family:${F.display};font-size:13px;font-weight:680;color:var(--cf-info-text);margin-bottom:4px}
.cf-banner-body{font-size:12.5px;color:var(--cf-text-secondary);line-height:1.55;font-weight:520}

.cf-tabs{display:flex;gap:4px;background:var(--cf-surface-2);border-radius:14px;padding:4px;margin-bottom:8px;width:fit-content;flex-wrap:wrap}
.cf-tab{height:34px;padding:0 14px;border-radius:10px;font-size:12px;font-weight:600;color:var(--cf-text-secondary);background:transparent;display:inline-flex;align-items:center;gap:8px;font-family:${F.display};white-space:nowrap;transition:all .15s}
.cf-tab.active{background:var(--cf-surface-1);color:var(--cf-text-primary);font-weight:650;box-shadow:var(--cf-shadow-sm)}
.cf-tab-cnt{min-width:18px;height:18px;padding:0 6px;border-radius:999px;background:var(--cf-surface-3);color:var(--cf-text-tertiary);font-size:9.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:${F.display}}
.cf-tab.active .cf-tab-cnt{background:var(--cf-accent-soft);color:var(--cf-accent-text)}

.cf-entity-desc{font-size:12.5px;color:var(--cf-text-tertiary);margin:8px 0 16px;font-weight:520;line-height:1.5}

.cf-list{background:var(--cf-surface-1);border:1px solid var(--cf-surface-3);border-radius:18px;box-shadow:var(--cf-shadow-sm);overflow:hidden;margin-bottom:24px}
.cf-list-hdr,.cf-list-row{display:grid;grid-template-columns:minmax(220px,2fr) 1fr 100px 100px 140px;gap:16px;padding:14px 20px;align-items:center}
.cf-list-hdr{padding:12px 20px;border-bottom:1px solid var(--cf-surface-3);background:var(--cf-surface-2);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:var(--cf-text-tertiary);font-family:${F.display}}
.cf-list-row{border-bottom:1px solid var(--cf-surface-3)}
.cf-list-row:last-child{border-bottom:none}
.cf-list-row.archived{opacity:.65}
.cf-empty{padding:48px 20px;text-align:center;color:var(--cf-text-tertiary);font-size:13px}
.cf-name{font-family:${F.display};font-size:13.5px;font-weight:680;letter-spacing:-.01em;color:var(--cf-text-primary)}
.cf-key{font-family:${F.mono};font-size:11px;color:var(--cf-text-tertiary);font-weight:520;margin-top:2px}
.cf-desc{font-size:12px;color:var(--cf-text-secondary);font-weight:520;line-height:1.5}
.cf-pill{height:22px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;font-size:10.5px;font-weight:720;font-family:${F.display};letter-spacing:.01em;text-transform:uppercase;width:fit-content}
.cf-pill.text{background:var(--cf-info-soft);color:var(--cf-info-text);border:1px solid #b3d4ee}
.cf-pill.number{background:var(--cf-accent-soft);color:var(--cf-accent-text);border:1px solid var(--cf-accent-muted)}
.cf-pill.date{background:var(--cf-success-soft);color:var(--cf-success-text);border:1px solid #a7d9be}
.cf-pill.select,.cf-pill.multi_select{background:var(--cf-warning-soft);color:var(--cf-warning-text);border:1px solid #f5d6a0}
.cf-pill.boolean{background:#fdeaea;color:#a52e2e;border:1px solid #f0b8b8}
.cf-flag{font-family:${F.display};font-size:11px;font-weight:680;color:var(--cf-text-tertiary)}
.cf-flag.required{color:var(--cf-danger-text)}
.cf-flag.archived{color:var(--cf-warning-text)}
.cf-row-acts{display:flex;justify-content:flex-end;gap:4px}
.cf-icon-btn{width:28px;height:28px;border-radius:7px;border:1px solid var(--cf-surface-3);background:var(--cf-surface-1);color:var(--cf-text-tertiary);display:grid;place-items:center}
.cf-icon-btn:hover:not(:disabled){background:var(--cf-surface-2);color:var(--cf-text-primary)}
.cf-icon-btn:disabled{opacity:.4;cursor:not-allowed}
.cf-icon-btn.danger:hover:not(:disabled){background:var(--cf-danger-soft);color:var(--cf-danger-text)}
.cf-icon-btn svg{width:14px;height:14px;display:block}

.cf-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cf-archived-toggle{font-size:12px;color:var(--cf-text-secondary);font-weight:520;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.cf-archived-toggle input{accent-color:var(--cf-accent)}

.cf-backdrop{position:fixed;inset:0;background:rgba(20,18,24,.55);backdrop-filter:blur(4px);display:grid;place-items:center;z-index:100;padding:24px}
.cf-modal{background:var(--cf-surface-1);border-radius:18px;box-shadow:var(--cf-shadow-lg);overflow:hidden;border:1px solid var(--cf-surface-3);width:560px;max-width:100%;max-height:90vh;overflow-y:auto}
.cf-modal-hdr{padding:18px 22px;border-bottom:1px solid var(--cf-surface-3);display:flex;align-items:center;justify-content:space-between}
.cf-modal-title{font-family:${F.display};font-size:16px;font-weight:720;letter-spacing:-.02em}
.cf-modal-sub{font-size:12px;color:var(--cf-text-tertiary);margin-top:1px}
.cf-modal-close{width:32px;height:32px;border-radius:8px;color:var(--cf-text-tertiary);display:grid;place-items:center}
.cf-modal-close:hover{background:var(--cf-surface-2)}
.cf-modal-body{padding:22px}
.cf-modal-foot{padding:14px 22px;border-top:1px solid var(--cf-surface-3);background:var(--cf-surface-2);display:flex;justify-content:flex-end;gap:8px}
.cf-label{font-family:${F.display};font-size:12px;font-weight:680;color:var(--cf-text-secondary);display:block;margin-bottom:6px}
.cf-input{width:100%;height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--cf-surface-3);background:var(--cf-surface-1);color:var(--cf-text-primary);font-size:13px;font-family:${F.body};font-weight:520;box-sizing:border-box;outline:none}
.cf-input:focus{border-color:var(--cf-accent);box-shadow:0 0 0 3px var(--cf-accent-soft)}
.cf-input.mono{font-family:${F.mono}}
.cf-textarea{width:100%;min-height:60px;padding:10px 14px;border-radius:10px;border:1px solid var(--cf-surface-3);background:var(--cf-surface-1);color:var(--cf-text-primary);font-size:13px;font-family:${F.body};font-weight:520;box-sizing:border-box;outline:none;resize:vertical}
.cf-textarea:focus{border-color:var(--cf-accent);box-shadow:0 0 0 3px var(--cf-accent-soft)}
.cf-help{font-size:11.5px;color:var(--cf-text-tertiary);margin-top:6px;font-weight:520}
.cf-types{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.cf-type-card{display:flex;align-items:flex-start;gap:8px;padding:10px;border-radius:10px;border:1px solid var(--cf-surface-3);background:var(--cf-surface-1);cursor:pointer}
.cf-type-card.selected{border-color:var(--cf-accent);background:var(--cf-accent-soft)}
.cf-type-card input{margin-top:3px;accent-color:var(--cf-accent)}
.cf-type-name{font-family:${F.display};font-size:13px;font-weight:680}
.cf-type-desc{font-size:11px;color:var(--cf-text-secondary);margin-top:2px;font-weight:520;line-height:1.4}
.cf-options-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.cf-options-row{display:grid;grid-template-columns:1fr 1fr 32px;gap:6px;align-items:center}
.cf-options-add{margin-top:8px;height:32px;padding:0 12px;font-size:12px;font-weight:600;color:var(--cf-accent-text);background:var(--cf-accent-soft);border:1px dashed var(--cf-accent-muted);border-radius:8px;display:inline-flex;align-items:center;gap:6px;font-family:${F.display}}
.cf-checkbox-row{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13px;color:var(--cf-text-secondary);font-weight:520}
.cf-checkbox-row input{accent-color:var(--cf-accent);width:14px;height:14px}
.cf-form-error{font-size:12px;color:var(--cf-danger-text);margin-top:8px;font-weight:580}

@media (max-width:980px){
  .cf-list-hdr,.cf-list-row{grid-template-columns:1fr;gap:6px}
  .cf-list-hdr>div:not(:first-child){display:none}
  .cf-types{grid-template-columns:1fr}
}
`;

  return (
    <div className="cf-root">
      <style>{css}</style>

      <div className="cf-hdr">
        <div>
          <h2>Custom fields</h2>
          <p>
            Define org-wide custom fields per entity type. Fields render
            on create/edit forms after core fields and surface as columns
            on list views. Existing values are preserved when a field is
            archived.
          </p>
        </div>
        <div className="cf-hdr-acts">
          {isAdmin && (
            <button className="cf-btn primary" onClick={onCreate}>
              <span className="cf-btn-icon">{I.plus}</span>
              New custom field
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="cf-banner">
          <div className="cf-banner-icon">{I.info}</div>
          <div style={{ flex: 1 }}>
            <div className="cf-banner-title">Read-only</div>
            <div className="cf-banner-body">
              Only contractor admins can manage custom fields. You can see
              what&apos;s defined here and fill them in when editing entities.
            </div>
          </div>
        </div>
      )}

      <div className="cf-tabs">
        {CUSTOM_FIELD_ENTITY_REGISTRY.map((d) => {
          const count = definitions.filter(
            (def) => def.entityType === d.type && def.isActive,
          ).length;
          return (
            <button
              key={d.type}
              type="button"
              onClick={() => {
                setActiveEntity(d.type);
                setShowArchived(false);
              }}
              className={`cf-tab${activeEntity === d.type ? " active" : ""}`}
            >
              {d.pluralLabel}
              <span className="cf-tab-cnt">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="cf-entity-desc">
        {CUSTOM_FIELD_ENTITY_REGISTRY.find((d) => d.type === activeEntity)?.description}
      </div>

      {archivedCount > 0 && (
        <div className="cf-toolbar">
          <label className="cf-archived-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived ({archivedCount})
          </label>
        </div>
      )}

      <div className="cf-list">
        <div className="cf-list-hdr">
          <div>Field</div>
          <div>Description</div>
          <div>Type</div>
          <div>Required</div>
          <div></div>
        </div>
        {filtered.length === 0 ? (
          <div className="cf-empty">
            No custom fields defined for this entity yet.
            {isAdmin && " Click \"New custom field\" to add one."}
          </div>
        ) : (
          filtered.map((d, idx) => (
            <div
              key={d.id}
              className={`cf-list-row${d.isActive ? "" : " archived"}`}
            >
              <div>
                <div className="cf-name">{d.label}</div>
                <div className="cf-key">{d.key}</div>
              </div>
              <div className="cf-desc">{d.description ?? "—"}</div>
              <div>
                <span className={`cf-pill ${d.fieldType}`}>
                  {FIELD_TYPE_COPY[d.fieldType].label}
                </span>
              </div>
              <div>
                {!d.isActive ? (
                  <span className="cf-flag archived">Archived</span>
                ) : d.isRequired ? (
                  <span className="cf-flag required">Required</span>
                ) : (
                  <span className="cf-flag">Optional</span>
                )}
              </div>
              <div className="cf-row-acts">
                {isAdmin && d.isActive ? (
                  <>
                    <button
                      className="cf-icon-btn"
                      title="Move up"
                      onClick={() => onMove(d, -1)}
                      disabled={submitting || idx === 0}
                    >
                      {I.arrowUp}
                    </button>
                    <button
                      className="cf-icon-btn"
                      title="Move down"
                      onClick={() => onMove(d, 1)}
                      disabled={
                        submitting ||
                        idx === activeRows.length - 1 ||
                        !activeRows.includes(d)
                      }
                    >
                      {I.arrowDown}
                    </button>
                    <button
                      className="cf-icon-btn"
                      title="Edit"
                      onClick={() => onEdit(d)}
                      disabled={submitting}
                    >
                      {I.pencil}
                    </button>
                    <button
                      className="cf-icon-btn danger"
                      title="Archive"
                      onClick={() => onArchive(d)}
                      disabled={submitting}
                    >
                      {I.trash}
                    </button>
                  </>
                ) : isAdmin && !d.isActive ? (
                  <button
                    className="cf-icon-btn"
                    title="Restore"
                    onClick={() => onRestore(d)}
                    disabled={submitting}
                  >
                    {I.restore}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <DefinitionModal
          mode={modal}
          entityType={activeEntity}
          editing={editing}
          onCancel={() => {
            setModal(null);
            setEditing(null);
            setError(null);
          }}
          onSubmit={submitDefinition}
          submitting={submitting}
          error={error}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

type FormSubmitState = {
  label: string;
  key: string;
  description: string;
  fieldType: FieldType;
  options: Option[];
  isRequired: boolean;
};

function DefinitionModal({
  mode,
  entityType,
  editing,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  mode: "create" | "edit";
  entityType: CustomFieldEntityType;
  editing: DefinitionRow | null;
  onCancel: () => void;
  onSubmit: (form: FormSubmitState) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [keyVal, setKeyVal] = useState(editing?.key ?? "");
  const [keyAuto, setKeyAuto] = useState(!editing); // create-mode: auto from label
  const [description, setDescription] = useState(editing?.description ?? "");
  const [fieldType, setFieldType] = useState<FieldType>(
    editing?.fieldType ?? "text",
  );
  const [options, setOptions] = useState<Option[]>(() => {
    const existing = editing?.optionsJson;
    if (Array.isArray(existing)) {
      return existing
        .map((o): Option | null => {
          if (typeof o === "string") return { value: o, label: o };
          if (o && typeof o === "object" && "value" in o) {
            const value = String((o as { value: unknown }).value);
            const lbl =
              "label" in o && typeof (o as { label: unknown }).label === "string"
                ? (o as { label: string }).label
                : value;
            return { value, label: lbl };
          }
          return null;
        })
        .filter((o): o is Option => o !== null);
    }
    return [];
  });
  const [isRequired, setIsRequired] = useState(editing?.isRequired ?? false);

  const needsOptions =
    fieldType === "select" || fieldType === "multi_select";
  const isEdit = mode === "edit";

  const onLabelChange = (next: string) => {
    setLabel(next);
    if (keyAuto && !isEdit) setKeyVal(slugifyKey(next));
  };

  const submit = () => {
    if (!label.trim()) return;
    const submitOptions = needsOptions
      ? options
          .map((o) => ({ value: o.value.trim(), label: o.label.trim() }))
          .filter((o) => o.value && o.label)
      : [];
    onSubmit({
      label: label.trim(),
      key: keyVal.trim() || slugifyKey(label),
      description: description.trim(),
      fieldType,
      options: submitOptions,
      isRequired,
    });
  };

  return (
    <div className="cf-backdrop" onClick={onCancel}>
      <div
        className="cf-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cf-modal-hdr">
          <div>
            <div className="cf-modal-title">
              {isEdit ? "Edit custom field" : "New custom field"}
            </div>
            <div className="cf-modal-sub">
              For{" "}
              {CUSTOM_FIELD_ENTITY_REGISTRY.find((d) => d.type === entityType)?.singularLabel}
            </div>
          </div>
          <button className="cf-modal-close" onClick={onCancel}>
            {I.x}
          </button>
        </div>
        <div className="cf-modal-body">
          <div style={{ marginBottom: 14 }}>
            <label className="cf-label">Label</label>
            <input
              className="cf-input"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="e.g. Project color"
              autoFocus
            />
            <div className="cf-help">Display name shown in forms.</div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="cf-label">Key</label>
            <input
              className="cf-input mono"
              value={keyVal}
              onChange={(e) => {
                setKeyAuto(false);
                setKeyVal(e.target.value);
              }}
              placeholder="auto-generated from label"
              disabled={isEdit}
            />
            <div className="cf-help">
              {isEdit
                ? "Keys can't be changed once a field is created — values reference them."
                : "Stable identifier used in API responses + CSV exports. Lowercase + underscores."}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="cf-label">Description (optional)</label>
            <textarea
              className="cf-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Helper text shown under the input."
              rows={2}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="cf-label">Type</label>
            <div className="cf-types">
              {(Object.keys(FIELD_TYPE_COPY) as FieldType[]).map((t) => {
                const c = FIELD_TYPE_COPY[t];
                const selected = fieldType === t;
                return (
                  <label
                    key={t}
                    className={`cf-type-card${selected ? " selected" : ""}`}
                    style={isEdit ? { opacity: 0.6, cursor: "not-allowed" } : {}}
                  >
                    <input
                      type="radio"
                      checked={selected}
                      onChange={() => !isEdit && setFieldType(t)}
                      disabled={isEdit}
                      name="cf-type"
                    />
                    <div>
                      <div className="cf-type-name">{c.label}</div>
                      <div className="cf-type-desc">{c.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            {isEdit && (
              <div className="cf-help">
                Type can&apos;t be changed once a field has values.
              </div>
            )}
          </div>

          {needsOptions && (
            <div style={{ marginBottom: 14 }}>
              <label className="cf-label">Options</label>
              <div className="cf-options-list">
                {options.map((opt, i) => (
                  <div key={i} className="cf-options-row">
                    <input
                      className="cf-input mono"
                      value={opt.value}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], value: e.target.value };
                        setOptions(next);
                      }}
                      placeholder="value"
                    />
                    <input
                      className="cf-input"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], label: e.target.value };
                        setOptions(next);
                      }}
                      placeholder="display label"
                    />
                    <button
                      className="cf-icon-btn danger"
                      title="Remove"
                      onClick={() =>
                        setOptions(options.filter((_, j) => j !== i))
                      }
                    >
                      {I.trash}
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="cf-options-add"
                onClick={() =>
                  setOptions([...options, { value: "", label: "" }])
                }
              >
                <span style={{ width: 12, height: 12, display: "block" }}>
                  {I.plus}
                </span>
                Add option
              </button>
              <div className="cf-help">
                The value is the stable identifier; the label is what users
                see. Keep values short and stable — changing them retroactively
                breaks existing data.
              </div>
            </div>
          )}

          <label className="cf-checkbox-row">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Required — entity create / edit forms will block submission until
            this field is filled in.
          </label>

          {error && <div className="cf-form-error">{error}</div>}
        </div>
        <div className="cf-modal-foot">
          <button className="cf-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="cf-btn primary"
            onClick={submit}
            disabled={
              submitting ||
              !label.trim() ||
              (needsOptions &&
                options.filter((o) => o.value.trim() && o.label.trim()).length ===
                  0)
            }
          >
            {submitting
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create field"}
          </button>
        </div>
      </div>
    </div>
  );
}
