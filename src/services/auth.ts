import type { ApiResponse } from "@/types/common";
import type { Session, SignInPayload } from "@/types/auth";
// import { apiClient } from "@/lib/api-client";
// import { ENDPOINTS } from "@/lib/constants/endpoints";
import { delay, ok } from "@/services/common";

const MOCK_SESSION: Session = {
  token: "mock-token",
  user: {
    id: "USR-2026-0001",
    username: "lifta",
    name: "Lifta Annisa",
    email: "lifta@example.com",
    role: "Race PIC",
  },
};

export const authService = {
  signIn: (_payload: SignInPayload): Promise<ApiResponse<Session>> =>
    // return apiClient.post<ApiResponse<Session>>(ENDPOINTS.auth.signIn, { ..._payload });
    delay(ok(MOCK_SESSION, "Signed in")),

  signOut: (): Promise<void> =>
    // return apiClient.post<void>(ENDPOINTS.auth.signOut);
    delay<void>(undefined),

  me: (): Promise<ApiResponse<Session["user"]>> =>
    // return apiClient.get<ApiResponse<Session["user"]>>(ENDPOINTS.auth.me);
    delay(ok(MOCK_SESSION.user)),
};
