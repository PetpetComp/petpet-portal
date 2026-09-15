import { COOKIE_TOKEN } from "@/lib/constants/cookies";
import { getCookie, removeCookie } from "@/lib/utils";

export function isValidAuthToken(
  token: string | undefined | null,
): token is string {
  return (
    !!token?.trim() && !["undefined", "null", "mock-token"].includes(token)
  );
}
export function getAuthToken(): string | undefined {
  const token = getCookie(COOKIE_TOKEN);
  return isValidAuthToken(token) ? token : undefined;
}
export function setAuthToken(token: string, expiresIn: number): void {
  if (
    !isValidAuthToken(token) ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error("Invalid authentication response.");
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_TOKEN}=${encodeURIComponent(token)}; Max-Age=${Math.floor(expiresIn)}; Path=/; SameSite=Lax${secure}`;
}
export function removeAuthToken(): void {
  removeCookie(COOKIE_TOKEN);
}
