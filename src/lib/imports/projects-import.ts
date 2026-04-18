// Projects CSV import — validation + field mapping.
//
// The shape is: a user uploads a CSV with arbitrary column names, then maps
// each target field to a source column index. This module owns the target
// field catalog + per-field validation, returning a ValidatedImport with
// invalid rows separated from the clean ones. Routes decide whether to
// commit (insertion is all-or-nothing, so presence of any invalid row
// blocks the commit).

import type { CsvTable } from "./csv-parser";

// Every target field maps to a column in the `projects` table. Required
// fields block insertion if missing; optional fields default to null.
export type ProjectImportField =
  | "name"
  | "projectCode"
  | "projectType"
  | "projectStatus"
  | "currentPhase"
  | "startDate"
  | "targetCompletionDate"
  | "contractValue"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "stateProvince"
  | "postalCode"
  | "country";

export const PROJECT_FIELD_CATALOG: ReadonlyArray<{
  field: ProjectImportField;
  label: string;
  required: boolean;
  synonyms: readonly string[];
}> = [
  { field: "name", label: "Project name", required: true, synonyms: ["name", "project_name", "project name", "title"] },
  { field: "projectCode", label: "Project code", required: false, synonyms: ["code", "project_code", "project code", "number"] },
  { field: "projectType", label: "Project type", required: false, synonyms: ["type", "project_type", "project type"] },
  { field: "projectStatus", label: "Status", required: false, synonyms: ["status", "project_status", "state"] },
  { field: "currentPhase", label: "Phase", required: false, synonyms: ["phase", "current_phase", "stage"] },
  { field: "startDate", label: "Start date", required: false, synonyms: ["start_date", "start date", "start", "kickoff"] },
  { field: "targetCompletionDate", label: "Target completion", required: false, synonyms: ["target_completion", "target_completion_date", "target", "end_date", "end date", "completion_date"] },
  { field: "contractValue", label: "Contract value ($)", required: false, synonyms: ["contract_value", "contract value", "value", "budget", "amount"] },
  { field: "addressLine1", label: "Address line 1", required: false, synonyms: ["address", "address_line_1", "street", "addr1"] },
  { field: "addressLine2", label: "Address line 2", required: false, synonyms: ["address_line_2", "addr2", "suite"] },
  { field: "city", label: "City", required: false, synonyms: ["city"] },
  { field: "stateProvince", label: "State / province", required: false, synonyms: ["state", "province", "state_province", "state/province"] },
  { field: "postalCode", label: "Postal code", required: false, synonyms: ["postal_code", "zip", "zip_code", "postal"] },
  { field: "country", label: "Country (3-letter)", required: false, synonyms: ["country", "country_code"] },
];

export type FieldMapping = Partial<Record<ProjectImportField, number>>;

// Attempt to match each target field to a header column by lowercasing + synonym
// lookup. Returns a best-effort mapping the UI can show and the user can tweak.
export function autoDetectMapping(header: readonly string[]): FieldMapping {
  const norm = header.map((h) => h.trim().toLowerCase());
  const mapping: FieldMapping = {};
  for (const entry of PROJECT_FIELD_CATALOG) {
    const idx = norm.findIndex((h) => entry.synonyms.includes(h));
    if (idx >= 0) mapping[entry.field] = idx;
  }
  return mapping;
}

// Validated row shape ready for insertion. Fields not mapped/empty are null.
export type ValidatedProjectRow = {
  name: string;
  projectCode: string | null;
  projectType: string | null;
  projectStatus: "draft" | "active" | "on_hold" | "closed" | "archived";
  currentPhase: "preconstruction" | "phase_1" | "phase_2" | "phase_3" | "closeout";
  startDate: Date | null;
  targetCompletionDate: Date | null;
  contractValueCents: number | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
};

export type RowError = { rowNum: number; field: ProjectImportField | "_row"; message: string };

export type ValidatedImport = {
  totalRows: number;
  validRows: ValidatedProjectRow[];
  invalidRows: Array<{ rowNum: number; raw: string[]; errors: RowError[] }>;
};

const VALID_STATUSES = new Set([
  "draft",
  "active",
  "on_hold",
  "closed",
  "archived",
]);
const VALID_PHASES = new Set([
  "preconstruction",
  "phase_1",
  "phase_2",
  "phase_3",
  "closeout",
]);

function getCell(row: readonly string[], idx: number | undefined): string | null {
  if (idx == null) return null;
  const v = row[idx];
  if (v == null) return null;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseCsvDate(v: string): Date | null {
  // Accept ISO (2026-04-17) or common US (04/17/2026, 4/17/2026). Reject
  // anything else so junk doesn't silently land as "Invalid Date".
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (us) {
    const [, mm, dd, yyyy] = us;
    const d = new Date(
      `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T00:00:00Z`,
    );
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseCsvDollars(v: string): number | null {
  // Strip $, commas, whitespace. Require numeric.
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function validateProjectsImport(
  table: CsvTable,
  mapping: FieldMapping,
): ValidatedImport {
  const validRows: ValidatedProjectRow[] = [];
  const invalidRows: Array<{
    rowNum: number;
    raw: string[];
    errors: RowError[];
  }> = [];

  // Required-field check on the mapping itself — rejects the whole file if
  // the user didn't pick a column for `name`.
  const rowFromMappingErrors: RowError[] = [];
  for (const entry of PROJECT_FIELD_CATALOG) {
    if (entry.required && mapping[entry.field] == null) {
      rowFromMappingErrors.push({
        rowNum: 0,
        field: entry.field,
        message: `${entry.label} is required — map it to a column before preview.`,
      });
    }
  }
  if (rowFromMappingErrors.length > 0) {
    return {
      totalRows: table.rows.length,
      validRows: [],
      invalidRows: [
        { rowNum: 0, raw: table.header, errors: rowFromMappingErrors },
      ],
    };
  }

  table.rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-based
    const errors: RowError[] = [];

    // Name is required (mapping-checked above; row-level can still be empty).
    const name = getCell(row, mapping.name);
    if (!name) {
      errors.push({
        rowNum,
        field: "name",
        message: "project name is empty",
      });
    }

    // Enum-validated fields default to schema defaults when omitted.
    const statusRaw = getCell(row, mapping.projectStatus)?.toLowerCase() ?? null;
    let projectStatus: ValidatedProjectRow["projectStatus"] = "draft";
    if (statusRaw) {
      if (!VALID_STATUSES.has(statusRaw)) {
        errors.push({
          rowNum,
          field: "projectStatus",
          message: `"${statusRaw}" is not a valid status (expected one of ${Array.from(VALID_STATUSES).join(", ")})`,
        });
      } else {
        projectStatus = statusRaw as ValidatedProjectRow["projectStatus"];
      }
    }

    const phaseRaw = getCell(row, mapping.currentPhase)?.toLowerCase() ?? null;
    let currentPhase: ValidatedProjectRow["currentPhase"] = "preconstruction";
    if (phaseRaw) {
      if (!VALID_PHASES.has(phaseRaw)) {
        errors.push({
          rowNum,
          field: "currentPhase",
          message: `"${phaseRaw}" is not a valid phase (expected one of ${Array.from(VALID_PHASES).join(", ")})`,
        });
      } else {
        currentPhase = phaseRaw as ValidatedProjectRow["currentPhase"];
      }
    }

    // Dates: null if missing; error if present but unparseable.
    let startDate: Date | null = null;
    const startRaw = getCell(row, mapping.startDate);
    if (startRaw) {
      startDate = parseCsvDate(startRaw);
      if (!startDate) {
        errors.push({
          rowNum,
          field: "startDate",
          message: `"${startRaw}" is not a recognizable date (use YYYY-MM-DD or MM/DD/YYYY)`,
        });
      }
    }
    let targetCompletionDate: Date | null = null;
    const targetRaw = getCell(row, mapping.targetCompletionDate);
    if (targetRaw) {
      targetCompletionDate = parseCsvDate(targetRaw);
      if (!targetCompletionDate) {
        errors.push({
          rowNum,
          field: "targetCompletionDate",
          message: `"${targetRaw}" is not a recognizable date (use YYYY-MM-DD or MM/DD/YYYY)`,
        });
      }
    }

    // Contract value: null if missing; error if present but unparseable.
    let contractValueCents: number | null = null;
    const valueRaw = getCell(row, mapping.contractValue);
    if (valueRaw) {
      contractValueCents = parseCsvDollars(valueRaw);
      if (contractValueCents == null) {
        errors.push({
          rowNum,
          field: "contractValue",
          message: `"${valueRaw}" is not a valid dollar amount`,
        });
      }
    }

    const country = getCell(row, mapping.country);
    if (country && country.length > 3) {
      errors.push({
        rowNum,
        field: "country",
        message: `country must be a 3-letter code (got "${country}")`,
      });
    }

    if (errors.length > 0) {
      invalidRows.push({ rowNum, raw: row, errors });
      return;
    }

    validRows.push({
      name: name!,
      projectCode: getCell(row, mapping.projectCode),
      projectType: getCell(row, mapping.projectType),
      projectStatus,
      currentPhase,
      startDate,
      targetCompletionDate,
      contractValueCents,
      addressLine1: getCell(row, mapping.addressLine1),
      addressLine2: getCell(row, mapping.addressLine2),
      city: getCell(row, mapping.city),
      stateProvince: getCell(row, mapping.stateProvince),
      postalCode: getCell(row, mapping.postalCode),
      country,
    });
  });

  return {
    totalRows: table.rows.length,
    validRows,
    invalidRows,
  };
}
