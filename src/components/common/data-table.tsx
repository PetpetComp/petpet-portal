"use client";
import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  actions,
  label = "Records",
}: {
  rows: T[];
  columns: Column<T>[];
  actions?: (row: T) => ReactNode;
  label?: string;
}) {
  const [sort, setSort] = useState({ key: "", direction: 1 });
  const [page, setPage] = useState(0);
  const column = columns.find((item) => item.key === sort.key);
  const sorted = column?.value
    ? [...rows].sort(
        (a, b) =>
          String(column.value!(a)).localeCompare(
            String(column.value!(b)),
            undefined,
            { numeric: true },
          ) * sort.direction,
      )
    : rows;
  const lastPage = Math.max(0, Math.ceil(rows.length / 8) - 1);
  const currentPage = Math.min(page, lastPage);
  return (
    <div className="data-table">
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  aria-sort={
                    sort.key === col.key
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.value ? (
                    <button
                      className="sort-button"
                      onClick={() =>
                        setSort({
                          key: col.key,
                          direction: sort.key === col.key ? -sort.direction : 1,
                        })
                      }
                    >
                      {col.label}
                      {sort.key === col.key ? (
                        sort.direction === 1 ? (
                          <ArrowUp size={13} />
                        ) : (
                          <ArrowDown size={13} />
                        )
                      ) : (
                        <ArrowUpDown size={13} />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(currentPage * 8, currentPage * 8 + 8).map((row) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : col.value?.(row)}
                  </td>
                ))}
                {actions && (
                  <td>
                    <div className="row-actions">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty-state">
            <SearchX size={28} />
            <strong>No records found</strong>
            <span>No matching records.</span>
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {rows.length ? currentPage * 8 + 1 : 0}-
          {Math.min((currentPage + 1) * 8, rows.length)} of {rows.length}{" "}
          records
        </span>
        <div className="row-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={!currentPage}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span>
            {currentPage + 1} / {lastPage + 1}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={currentPage >= lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
