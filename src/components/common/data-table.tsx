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
import { Select } from "@/components/ui/form-controls";
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;
}
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
function getPageNumbers(current: number, last: number): (number | "...")[] {
  if (last <= 6) return Array.from({ length: last + 1 }, (_, i) => i);
  const pages = new Set([0, last, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 0 && p <= last).sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("...");
    result.push(p);
  });
  return result;
}
export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
}
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  actions,
  label = "Records",
  server,
}: {
  rows: T[];
  columns: Column<T>[];
  actions?: (row: T) => ReactNode;
  label?: string;
  server?: ServerPagination;
}) {
  const [sort, setSort] = useState({ key: "", direction: 1 });
  const [localPage, setLocalPage] = useState(0);
  const [localPageSize, setLocalPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const column = server
    ? undefined
    : columns.find((item) => item.key === sort.key);
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
  const pageSize = server ? server.pageSize : localPageSize;
  const totalRows = server ? server.total : rows.length;
  const lastPage = Math.max(0, Math.ceil(totalRows / pageSize) - 1);
  const currentPage = server
    ? Math.min(server.page, lastPage)
    : Math.min(localPage, lastPage);
  const pageRows = server
    ? sorted
    : sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  function goToPage(next: number) {
    if (server) server.onPageChange(next);
    else setLocalPage(next);
  }
  function changePageSize(size: number) {
    if (server) server.onPageSizeChange(size);
    else setLocalPageSize(size);
    goToPage(0);
  }
  return (
    <div className="data-table" aria-busy={server?.loading || undefined}>
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
                  {col.value && !server ? (
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
            {pageRows.map((row) => (
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
        {!pageRows.length && (
          <div className="empty-state">
            <SearchX size={28} />
            <strong>No records found</strong>
            <span>No matching records.</span>
          </div>
        )}
      </div>
      <div className="table-footer">
        <div className="table-footer-info">
          <span>
            {totalRows ? currentPage * pageSize + 1 : 0}-
            {Math.min((currentPage + 1) * pageSize, totalRows)} of{" "}
            {totalRows} records
          </span>
          <label className="page-size-control">
            Rows per page
            <Select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="row-actions page-numbers">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={!currentPage}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          {getPageNumbers(currentPage, lastPage).map((entry, index) =>
            entry === "..." ? (
              <span key={`ellipsis-${index}`} className="page-ellipsis">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className="page-number"
                aria-current={entry === currentPage ? "page" : undefined}
                onClick={() => goToPage(entry)}
              >
                {entry + 1}
              </button>
            ),
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={currentPage >= lastPage}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
