export type SortDir = "asc" | "desc";

export type SelectItem = { value: string; label: string };

export interface Meta {
  currentPage: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type Paginated<T> = ApiResponse<{ items: T[]; meta: Meta }>;

export interface AuditFields {
  createdDate: string;
  createdBy: string;
  updatedDate: string;
  updatedBy: string;
}
