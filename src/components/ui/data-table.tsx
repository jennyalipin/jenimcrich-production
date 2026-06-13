"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "./cn";

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  /** Stable identifier; also the sort key. */
  key: string;
  header: ReactNode;
  /** Cell renderer for a row. */
  cell: (row: T) => ReactNode;
  /**
   * Providing this makes the column sortable. Return the comparable value
   * (numbers sort numerically, strings naturally; null/undefined sort last).
   */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "center" | "right";
  /** Applied to both th and td (e.g. "w-24", "whitespace-nowrap"). */
  className?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: ReadonlyArray<T>;
  /** Stable React key per row (e.g. the row id). */
  rowKey: (row: T) => string | number;
  /** Makes rows clickable (pointer cursor + Enter/Space via keyboard). */
  onRowClick?: (row: T) => void;
  /** Shown instead of the body when rows is empty — usually an <EmptyState>. */
  empty?: ReactNode;
  initialSort?: { key: string; direction: SortDirection };
  /** Tighter row padding for very dense screens. */
  dense?: boolean;
  /** Accessible table description, e.g. "Candidates". */
  ariaLabel?: string;
  className?: string;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function SortGlyph({ direction }: { direction: SortDirection | null }) {
  return (
    <svg
      width="9"
      height="11"
      viewBox="0 0 9 12"
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-opacity",
        direction === null ? "opacity-0 group-hover:opacity-50" : "opacity-90",
      )}
    >
      <path
        d="M4.5 1l3 3.4h-6L4.5 1z"
        fill="currentColor"
        opacity={direction === "desc" ? 0.3 : 1}
      />
      <path
        d="M4.5 11L1.5 7.6h6L4.5 11z"
        fill="currentColor"
        opacity={direction === "asc" ? 0.3 : 1}
      />
    </svg>
  );
}

/**
 * The ledger table — generic, typed, client-side sortable. Note: column
 * definitions contain functions, so render this from a Client Component
 * (pass plain data down from the server).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  initialSort,
  dense = false,
  ariaLabel,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(
    initialSort ?? null,
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    const getValue = column?.sortValue;
    if (!getValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(getValue(a), getValue(b)));
  }, [rows, columns, sort]);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  const clickable = onRowClick !== undefined;
  const cellPad = dense ? "px-3 py-2" : "px-3 py-[11px]";

  return (
    <div className={cn("overflow-x-auto scrollbar-slim", className)}>
      <table aria-label={ariaLabel} className="w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((column) => {
              const sortable = column.sortValue !== undefined;
              const direction = sort?.key === column.key ? sort.direction : null;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    direction === null
                      ? undefined
                      : direction === "asc"
                        ? "ascending"
                        : "descending"
                  }
                  className={cn(
                    "micro-label px-3 py-2.5 text-slate-500",
                    alignClass[column.align ?? "left"],
                    column.className,
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "group micro-label inline-flex items-center gap-1 rounded outline-none transition-colors hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-primary-soft",
                        direction !== null && "text-slate-800",
                      )}
                    >
                      {column.header}
                      <SortGlyph direction={direction} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {empty ?? (
                  <p className="px-4 py-10 text-center text-[13px] text-slate-500">
                    No records yet.
                  </p>
                )}
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                className={cn(
                  "border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50",
                  clickable &&
                    "cursor-pointer outline-none focus-visible:bg-primary-faint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-soft",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      cellPad,
                      "align-middle text-[13px] text-slate-700",
                      alignClass[column.align ?? "left"],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
