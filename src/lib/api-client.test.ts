import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./api-client";
import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  isValidAuthToken,
} from "./auth-cookie";
import { COOKIE_TOKEN } from "./constants/cookies";
import { USER_SERVICES } from "@/services/user-management";
afterEach(() => {
  removeAuthToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Omdem-style API client", () => {
  it("calls the configured backend directly using the token cookie as a Bearer header", async () => {
    setAuthToken("test-token", 3600);
    const request = vi
      .fn()
      .mockResolvedValue(Response.json({ success: true, data: [] }));
    vi.stubGlobal("fetch", request);
    await USER_SERVICES.list({ q: "Jane & Doe", page: 2, per_page: 15 });
    const [url, options] = request.mock.calls[0];
    const base = (
      process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
      "https://petpet-service.onrender.com/api"
    ).replace(/\/$/, "");
    expect(url).toBe(base + "/users?q=Jane+%26+Doe&page=2&per_page=15");
    expect(options.headers.get("Authorization")).toBe("Bearer test-token");
    expect(options.credentials).toBe("omit");
    expect(url).not.toContain("/api/backend/");
  });
  it("preserves FormData boundaries and request options", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal("fetch", request);
    const body = new FormData();
    body.append("name", "Petpet");
    const controller = new AbortController();
    await apiClient.postForm("/upload", body, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-Test": "upload" },
    });
    const options = request.mock.calls[0][1];
    expect(options.body).toBe(body);
    expect(options.headers.has("Content-Type")).toBe(false);
    expect(options.headers.get("X-Test")).toBe("upload");
    expect(options.signal).toBe(controller.signal);
  });
  it("clears expired tokens on unauthorized responses", async () => {
    window.history.replaceState({}, "", "/sign-in");
    setAuthToken("expired-token", 3600);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "Expired." }, { status: 401 }),
        ),
    );
    await expect(apiClient.get("/auth/me")).rejects.toThrow("Expired.");
    expect(getAuthToken()).toBeUndefined();
  });
  it("does not attach an old token to login and preserves server validation errors", async () => {
    setAuthToken("old-token", 3600);
    const request = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { errors: { email: ["Enter a valid email."] } },
          { status: 422 },
        ),
      );
    vi.stubGlobal("fetch", request);
    await expect(
      apiClient.post("/auth/login", { email: "invalid", password: "test" }),
    ).rejects.toMatchObject({
      status: 422,
      errors: { email: ["Enter a valid email."] },
    });
    expect(request.mock.calls[0][1].headers.has("Authorization")).toBe(false);
  });
  it("handles rate limits and cookie expiry from the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({}, { status: 429, headers: { "Retry-After": "30" } }),
        ),
    );
    await expect(apiClient.post("/auth/login")).rejects.toThrow("30 seconds");
    expect(() => setAuthToken("token", -1)).toThrow(
      "Invalid authentication response",
    );
    expect(isValidAuthToken("undefined")).toBe(false);
    document.cookie = COOKIE_TOKEN + "=null; path=/";
    expect(getAuthToken()).toBeUndefined();
  });
});
