import { getAuthToken, removeAuthToken } from "@/lib/auth-cookie";
import { ENDPOINTS } from "@/lib/constants/endpoints";

const BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
  "https://petpet-service.onrender.com/api"
).replace(/\/$/, "");
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
const messages: Record<number, string> = {
  400: "Bad request. Please check your input.",
  401: "Session expired. Please sign in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  405: "Method not allowed.",
  409: "Data conflict. This entry may already exist.",
  422: "Validation failed. Please check your input.",
  500: "Internal server error. Please try again later.",
  502: "Service temporarily unavailable. Please try again.",
  503: "Service temporarily unavailable. Please try again.",
  504: "Request timed out. Please try again.",
};
async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (token && endpoint !== ENDPOINTS.auth.login)
    headers.set("Authorization", `Bearer ${token}`);
  const isForm = options.body instanceof FormData;
  if (isForm) headers.delete("Content-Type");
  else if (options.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(BASE_URL + endpoint, {
      ...options,
      headers,
      credentials: "omit",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(60000),
      body: isForm
        ? (options.body as FormData)
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    throw new ApiError(
      0,
      cause instanceof Error && cause.name === "TimeoutError"
        ? "Request timed out. Please try again."
        : "Network error. Please check your connection.",
    );
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    if (response.status === 401 && token && endpoint !== ENDPOINTS.auth.login) {
      removeAuthToken();
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("petpet:session-expired"));
    }
    const errors = data?.errors as Record<string, string[]> | undefined;
    let message = errors
      ? Object.values(errors).flat().join(" ")
      : data?.message;
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      message =
        seconds > 0
          ? `Too many attempts. Please try again in ${seconds} seconds.`
          : "Too many attempts. Please wait a moment before trying again.";
    }
    throw new ApiError(
      response.status,
      message ||
        messages[response.status] ||
        `Request failed (${response.status}).`,
      errors,
    );
  }
  if (data === null)
    throw new ApiError(502, "The server returned an invalid response.");
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
  postForm: <T>(
    endpoint: string,
    body: FormData,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "POST", body }),
  patch: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "PATCH", body }),
  put: <T>(
    endpoint: string,
    body?: Record<string, unknown>,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>(endpoint, { ...options, method: "PUT", body }),
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, "body">) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),
};
