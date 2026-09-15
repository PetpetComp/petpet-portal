import type { Meta, Paginated, ApiResponse } from "@/types/common";

export function ok<T>(data: T, message = "OK"): ApiResponse<T> {
  return { success: true, message, data };
}

export function paginate<T>(items: T[]): Paginated<T> {
  const meta: Meta = {
    currentPage: 1,
    perPage: items.length,
    total: items.length,
    lastPage: 1,
  };
  return { success: true, message: "OK", data: { items, meta } };
}

export function delay<T>(value: T, ms = 150): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function buildUrl(base: string, params?: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "")
      query.set(key, String(value));
  }
  return query.size ? base + "?" + query.toString() : base;
}
export async function collectRows<T extends Record<string, unknown>>(
  fetchPage: (
    params: import("@/types/api").ListParams,
  ) => Promise<import("@/types/api").ListResponse<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 1000; page++) {
    const response = await fetchPage({ per_page: 100, page });
    if (Array.isArray(response.data)) return [...rows, ...response.data];
    if (!Array.isArray(response.data?.items))
      throw new Error("The API returned an invalid list.");
    rows.push(...response.data.items);
    if (page >= (response.data.meta?.last_page ?? 1)) return rows;
  }
  throw new Error(
    "The server returned too many pages. Please narrow the query.",
  );
}
