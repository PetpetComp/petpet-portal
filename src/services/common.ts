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
