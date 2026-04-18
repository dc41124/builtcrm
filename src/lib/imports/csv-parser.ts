// Minimal RFC 4180 CSV parser — inline to avoid adding papaparse as a dep.
// Handles:
//   - quoted fields with embedded commas, newlines, and doubled quotes
//   - \r\n, \n, and \r line endings
//   - trailing newline at EOF (optional)
//   - empty trailing fields
// Edge cases that fall through gracefully:
//   - BOM (stripped from the first cell)
//   - mixed quoting within a single field (treated literally)
// Not supported (intentional, to keep scope small):
//   - alternate delimiters (always comma)
//   - header-aware type coercion (caller owns the types)
//
// Returns a CsvTable: header row + an array of data rows, both as string[].

export type CsvTable = {
  header: string[];
  rows: string[][];
};

export class CsvParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(`CSV parse error on line ${line}: ${message}`);
    this.name = "CsvParseError";
  }
}

export function parseCsv(input: string): CsvTable {
  // Strip UTF-8 BOM if present.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let line = 1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // Doubled quote → literal quote; otherwise end of quoted field.
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
        if (c === "\n") line++;
      }
      continue;
    }

    // Not in quotes
    if (c === '"') {
      // Opening quote must be at the start of a field.
      if (field.length === 0) {
        inQuotes = true;
      } else {
        // Treat stray quotes literally — lenient fallback.
        field += c;
      }
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") {
      // CR or CRLF — end of row.
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (text[i + 1] === "\n") i++;
      line++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      line++;
      continue;
    }
    field += c;
  }

  if (inQuotes) {
    throw new CsvParseError("unterminated quoted field", line);
  }
  // Flush the final field if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) {
    return { header: [], rows: [] };
  }

  const header = rows[0].map((h) => h.trim());
  const data = rows.slice(1).filter((r) => r.some((cell) => cell.length > 0));
  return { header, rows: data };
}
