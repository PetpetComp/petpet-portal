import { getCookie, removeCookie } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const TOKEN_COOKIE = "session";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown> | FormData;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getCookie(TOKEN_COOKIE);
  const isForm = options.body instanceof FormData;

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      body: isForm
        ? (options.body as FormData)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new ApiError(0, "Network error. Please check your connection.");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const message = typeof data.message === "string" ? data.message : undefined;

  if (res.status === 401) {
    if (token && typeof window !== "undefined") {
      removeCookie(TOKEN_COOKIE);
      window.location.href = "/sign-in";
    }
    throw new ApiError(
      401,
      message ?? "Session expired. Please sign in again.",
    );
  }

  if (res.status === 422) {
    const errors = data.errors as Record<string, string[]> | undefined;
    const detail = errors ? Object.values(errors).flat().join(" ") : undefined;
    throw new ApiError(422, detail ?? message ?? "Validation failed.", errors);
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      message ?? `Request failed (${res.status}).`,
    );
  }

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, "body">) =>
    request<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "POST", body }),
  put: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "PUT", body }),
  patch: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "PATCH", body }),
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, "body">) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
