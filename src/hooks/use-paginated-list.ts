"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { collectRows, fetchPageRows } from "@/services/common";
import type { ListParams, ListResponse } from "@/types/api";

const DEFAULT_PAGE_SIZE = 10;

/**
 * Backs a DataTable with true server-side pagination when there's no active
 * search query. The backend has no search/filter param, so an active query
 * falls back to fetching every row once (cached) and filtering/paginating
 * in memory - the only way search can see matches outside the current page.
 *
 * Callers own `query` and must reset the page to 0 themselves (via the
 * returned `setPage`) whenever they change it, the same way changing the
 * page size already does through the DataTable footer control.
 */
export function usePaginatedList<Raw extends Record<string, unknown>, Row>(
  fetchPage: (params: ListParams) => Promise<ListResponse<Raw>>,
  mapRow: (raw: Raw) => Row,
  query: string,
  matches: (row: Row, query: string) => boolean,
  enabled = true,
) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const allCache = useRef<Row[] | null>(null);

  const fetchCurrentPage = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed) {
      if (!allCache.current) {
        const raw = await collectRows(fetchPage);
        allCache.current = raw.map(mapRow);
      }
      const filtered = allCache.current.filter((row) => matches(row, trimmed));
      return {
        items: filtered.slice(page * pageSize, page * pageSize + pageSize),
        total: filtered.length,
      };
    }
    allCache.current = null;
    const { items, total: serverTotal } = await fetchPageRows(fetchPage, {
      page: page + 1,
      per_page: pageSize,
    });
    return { items: items.map(mapRow), total: serverTotal };
    // fetchPage/mapRow/matches are supplied by the caller as stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, query]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetchCurrentPage()
      .then((result) => {
        if (!active) return;
        setRows(result.items);
        setTotal(result.total);
        setError("");
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Unable to load data.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, fetchCurrentPage, reloadToken]);

  return {
    rows,
    total,
    page,
    pageSize,
    loading: enabled && loading,
    error,
    setPage,
    setPageSize,
    reload: () => {
      setPage(0);
      setReloadToken((value) => value + 1);
    },
  };
}
