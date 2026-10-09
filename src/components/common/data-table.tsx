"use client";
import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
export interface Sort {
  key: string;
  direction: 1 | -1;
}
export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;
  /** Adds an input/select under the header for this column. */
  filter?: { type: "text" } | { type: "select"; options: string[] };
}

/**
 * Pass when `rows` is already one page from the API (server mode).
 * `page` is 0-based here (matches `usePaginatedList`); the footer converts it.
 */
export interface ServerPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  loading?: boolean;
}
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  actions,
  label = "Records",
  server: serverPagination,
  filters = {},
  onFilterChange,
  sort: controlledSort,
  onSortChange,
}: {
  rows: T[];
  columns: Column<T>[];
  actions?: (row: T) => ReactNode;
  label?: string;
  server?: ServerPagination;
  filters?: Record<string, string>;
  /** Leave undefined while the API has no such filter: inputs show disabled. */
  onFilterChange?: (key: string, value: string) => void;
  /**
   * Server mode only: the API owns ordering, so sorting just this page would
   * mislead. Sort buttons stay disabled until `onSortChange` is given.
   */
  sort?: Sort;
  onSortChange?: (sort: Sort) => void;
}) {
  const [page, setPage] = useState(1);
  const server = !!serverPagination;
  const [localSort, setLocalSort] = useState<Sort>({ key: "", direction: 1 });
  const sort = server ? (controlledSort ?? localSort) : localSort;
  const sortLocked = server && !onSortChange;
  const column = columns.find((item) => item.key === sort.key);
  // Server mode: rows arrive already ordered by the API, never re-sort them here.
  const sorted =
    !server && column?.value
      ? [...rows].sort(
          (a, b) =>
            String(column.value!(a)).localeCompare(
              String(column.value!(b)),
              undefined,
              { numeric: true },
            ) * sort.direction,
        )
      : rows;
  function changeSort(key: string) {
    const next: Sort = {
      key,
      direction: sort.key === key ? (-sort.direction as 1 | -1) : 1,
    };
    if (server) onSortChange?.(next);
    else setLocalSort(next);
  }
  const perPage = PAGE_SIZE_OPTIONS[0];
  const visible = server
    ? sorted
    : sorted.slice((page - 1) * perPage, page * perPage);
  const hasFilters = columns.some((col) => col.filter);
  return (
    <div
      className="data-table"
      aria-busy={serverPagination?.loading || undefined}
    >
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
                      disabled={sortLocked}
                      title={
                        sortLocked
                          ? "Sorting not supported by the API yet"
                          : undefined
                      }
                      onClick={() => changeSort(col.key)}
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
            {hasFilters && (
              <tr className="bg-[#faf8fd]">
                {columns.map((col) => (
                  <th key={col.key} className="!py-2 !font-normal normal-case">
                    {col.filter && (
                      <FilterControl
                        column={col}
                        value={filters[col.key] ?? ""}
                        onChange={onFilterChange}
                      />
                    )}
                  </th>
                ))}
                {actions && <th />}
              </tr>
            )}
          </thead>
          <tbody>
            {visible.map((row) => (
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
      {serverPagination ? (
        <Pagination
          page={serverPagination.page + 1}
          perPage={serverPagination.pageSize}
          total={serverPagination.total}
          onPageChange={(p) => serverPagination.onPageChange(p - 1)}
          onPerPageChange={serverPagination.onPageSizeChange}
          perPageOptions={PAGE_SIZE_OPTIONS}
        />
      ) : (
        <Pagination
          page={page}
          perPage={perPage}
          total={rows.length}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function FilterControl<T>({
  column,
  value,
  onChange,
}: {
  column: Column<T>;
  value: string;
  onChange?: (key: string, value: string) => void;
}) {
  const filter = column.filter!;
  const inactive = !onChange;
  const shared = {
    "aria-label": `Filter ${column.label}`,
    disabled: inactive,
    title: inactive ? "Filter not supported by the API yet" : undefined,
    className:
      "border-input min-h-9 w-full rounded-[10px] border bg-white px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50",
    value,
    onChange: (e: { target: { value: string } }) =>
      onChange?.(column.key, e.target.value),
  };
  return filter.type === "select" ? (
    <select {...shared}>
      <option value="">All</option>
      {filter.options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  ) : (
    <input type="text" placeholder={column.label} {...shared} />
  );
}
