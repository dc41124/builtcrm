"use client";

import { useMemo, useState, type ReactNode } from "react";

export type DataTableAlign = "left" | "right" | "center";
export type DataTableCellType = "text" | "id" | "currency";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  sortable?: boolean;
  align?: DataTableAlign;
  cellType?: DataTableCellType;
  width?: string | number;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
};

type SortState = { id: string; dir: "asc" | "desc" } | null;

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  className = "",
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sort, columns]);

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable || !col.sortValue) return;
    setSort((prev) => {
      if (prev?.id !== col.id) return { id: col.id, dir: "asc" };
      if (prev.dir === "asc") return { id: col.id, dir: "desc" };
      return null;
    });
  };

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={`bc-tbl-wrap ${className}`}>
      <table className="bc-tbl">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sort?.id === col.id;
              return (
                <th
                  key={col.id}
                  className={`bc-th bc-al-${col.align ?? "left"} ${col.sortable ? "bc-th-sortable" : ""}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => toggleSort(col)}
                  aria-sort={isSorted ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <span className="bc-th-inner">
                    {col.header}
                    {col.sortable && (
                      <span className={`bc-sort ${isSorted ? `bc-sort-${sort!.dir}` : ""}`} aria-hidden>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 4 2-2 2 2"/><path d="m3 6 2 2 2-2"/></svg>
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => (
            <tr
              key={rowKey(row, idx)}
              className={onRowClick ? "bc-tr-clickable" : ""}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={`bc-td bc-al-${col.align ?? "left"} bc-ct-${col.cellType ?? "text"}`}
                  data-label={typeof col.header === "string" ? col.header : undefined}
                >
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
