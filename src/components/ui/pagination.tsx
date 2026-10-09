import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Page numbers to show, with null as an ellipsis: [1, null, 4, 5, 6, null, 20]. */
export function pageWindow(page: number, last: number): (number | null)[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= last)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

export interface PaginationProps {
  /** 1-based, same as the API's `current_page`. */
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
  label?: string;
}

export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  perPageOptions = [8, 16, 32],
  label = "records",
}: PaginationProps) {
  const last = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, last);
  const from = total ? (current - 1) * perPage + 1 : 0;
  const to = Math.min(current * perPage, total);
  return (
    <nav
      aria-label="Pagination"
      className="border-border flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"
    >
      <span className="text-muted-foreground">
        Showing {from}–{to} of {total} {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {onPerPageChange && (
          <select
            aria-label="Rows per page"
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="border-input min-h-9 rounded-lg border bg-white px-2 text-sm"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Previous page"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        {pageWindow(current, last).map((p, i) =>
          p === null ? (
            <span
              key={`gap-${i}`}
              aria-hidden
              className="text-muted-foreground px-1"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === current ? "primary" : "ghost"}
              size="icon"
              aria-label={`Page ${p}`}
              aria-current={p === current ? "page" : undefined}
              className={cn("font-mono")}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="secondary"
          size="icon"
          aria-label="Next page"
          disabled={current >= last}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
