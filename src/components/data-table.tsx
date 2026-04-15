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
    <>
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
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style>{`
        .bc-tbl-wrap{width:100%;overflow-x:auto}
        .bc-tbl{width:100%;border-collapse:collapse;font-size:13px}
        .bc-tbl thead{background:var(--sh)}
        .bc-th{padding:10px 14px;text-align:left;font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--s3);white-space:nowrap;user-select:none}
        .bc-th-sortable{cursor:pointer}
        .bc-th-sortable:hover{color:var(--t2)}
        .bc-th-inner{display:inline-flex;align-items:center;gap:6px}
        .bc-sort{opacity:.5;display:inline-flex;align-items:center;line-height:0}
        .bc-sort-asc,.bc-sort-desc{opacity:1;color:var(--t1)}
        .bc-sort-desc svg{transform:rotate(180deg)}
        .bc-tbl tbody tr{border-bottom:1px solid var(--s3);transition:background var(--df) var(--e)}
        .bc-tbl tbody tr:last-child{border-bottom:none}
        .bc-tbl tbody tr:hover{background:var(--sh)}
        .bc-tr-clickable{cursor:pointer}
        .bc-td{padding:12px 14px;font-family:var(--fb);font-size:13px;font-weight:520;color:var(--t1);vertical-align:middle}
        .bc-ct-id{font-family:var(--fm);font-size:12.5px;font-weight:580;color:var(--t2)}
        .bc-ct-currency{font-family:var(--fd);font-size:13px;font-weight:680;letter-spacing:-.01em;color:var(--t1)}
        .bc-al-left{text-align:left}
        .bc-al-right{text-align:right}
        .bc-al-center{text-align:center}
      `}</style>
    </>
  );
}
