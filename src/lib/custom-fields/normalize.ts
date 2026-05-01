// Step 61 — Custom-field value normalization + validation.
//
// One coercion path per field type. Inputs come from form posts (always
// strings or string[]) and from import CSVs (always strings). We coerce
// to the canonical wire shape stored in `value_json`:
//   text          → string
//   number        → number
//   date          → ISO-8601 date string (YYYY-MM-DD)
//   select        → string (must match one of the option values)
//   multi_select  → string[] (each must match an option value)
//   boolean       → boolean

import type {
  customFieldDefinitions,
  customFieldTypeEnum,
} from "@/db/schema/customFields";

export type CustomFieldType = (typeof customFieldTypeEnum.enumValues)[number];

export type CustomFieldOption = { value: string; label: string };

/** A subset of the `custom_field_definitions` row shape — the part needed
 *  by the validator. We don't pull the whole drizzle row type because
 *  callers (CSV importer, action layer, drop-in component) build this
 *  shape from various sources. */
export type DefinitionForValidation = {
  key: string;
  label: string;
  fieldType: CustomFieldType;
  optionsJson: unknown;
  isRequired: boolean;
};

export type NormalizationResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------

/** Best-effort cast from "unknown" raw input → typed value the wire format
 *  expects. Returns a tagged result so callers can collect per-field errors
 *  without throwing. */
export function normalizeCustomFieldValue(
  def: DefinitionForValidation,
  raw: unknown,
): NormalizationResult {
  // Empty / nullish handling. We treat undefined, null, and "" the same:
  // missing. Required check fires here.
  if (raw === undefined || raw === null || raw === "") {
    if (def.isRequired) {
      return { ok: false, error: `${def.label} is required` };
    }
    return { ok: true, value: null };
  }

  switch (def.fieldType) {
    case "text": {
      if (typeof raw !== "string") {
        return { ok: false, error: `${def.label} must be a string` };
      }
      return { ok: true, value: raw.trim() };
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) {
        return { ok: false, error: `${def.label} must be a number` };
      }
      return { ok: true, value: n };
    }
    case "date": {
      // Accept YYYY-MM-DD or any value `new Date()` parses; canonicalize
      // to YYYY-MM-DD UTC.
      const str = typeof raw === "string" ? raw.trim() : String(raw);
      const d = new Date(str);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, error: `${def.label} must be a date (YYYY-MM-DD)` };
      }
      return { ok: true, value: d.toISOString().slice(0, 10) };
    }
    case "select": {
      const options = optionValues(def);
      const v = String(raw).trim();
      if (options.length > 0 && !options.includes(v)) {
        return {
          ok: false,
          error: `${def.label} must be one of: ${options.join(", ")}`,
        };
      }
      return { ok: true, value: v };
    }
    case "multi_select": {
      const options = optionValues(def);
      const arr = Array.isArray(raw)
        ? raw.map((x) => String(x).trim()).filter(Boolean)
        : String(raw)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
      if (options.length > 0) {
        const bad = arr.filter((v) => !options.includes(v));
        if (bad.length > 0) {
          return {
            ok: false,
            error: `${def.label} contains invalid values: ${bad.join(", ")}`,
          };
        }
      }
      return { ok: true, value: arr };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      const s = String(raw).trim().toLowerCase();
      if (["true", "1", "yes", "y", "t"].includes(s)) {
        return { ok: true, value: true };
      }
      if (["false", "0", "no", "n", "f"].includes(s)) {
        return { ok: true, value: false };
      }
      return { ok: false, error: `${def.label} must be true or false` };
    }
  }
}

/** Pull the option values out of a definition's options_json. Tolerant
 *  shape: array of strings OR array of {value, label}. */
export function optionValues(def: DefinitionForValidation): string[] {
  if (!Array.isArray(def.optionsJson)) return [];
  return def.optionsJson
    .map((o) => {
      if (typeof o === "string") return o;
      if (o && typeof o === "object" && "value" in o) {
        return String((o as { value: unknown }).value);
      }
      return null;
    })
    .filter((v): v is string => v !== null);
}

export function optionLabels(
  def: DefinitionForValidation,
): CustomFieldOption[] {
  if (!Array.isArray(def.optionsJson)) return [];
  return def.optionsJson
    .map((o): CustomFieldOption | null => {
      if (typeof o === "string") return { value: o, label: o };
      if (o && typeof o === "object" && "value" in o) {
        const value = String((o as { value: unknown }).value);
        const label =
          "label" in o && typeof (o as { label: unknown }).label === "string"
            ? (o as { label: string }).label
            : value;
        return { value, label };
      }
      return null;
    })
    .filter((o): o is CustomFieldOption => o !== null);
}

// ---------------------------------------------------------------------------
// Slug helper for the admin "Create field" form. Keys are lowercase
// snake_case, max 60 chars, [a-z0-9_]. Generated from the label as a
// default; admins can override.
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// Type-only re-export so callers can `import type { customFieldDefinitions }`
// without paying for the runtime symbol. Drizzle's generated row inference
// flows through this.
export type { customFieldDefinitions };
