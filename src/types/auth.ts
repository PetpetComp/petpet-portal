import type { ApiResponse } from "./common";
import type { UserRecord } from "./api";
import type { AccessProfile } from "@/lib/auth/access";
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
}
export interface SignInPayload {
  email: string;
  password: string;
}
export interface SignUpPayload {
  first_name: string;
  last_name?: string;
  username: string;
  email: string;
  password: string;
}
export type LoginResponse = ApiResponse<{
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserRecord;
}>;
export type MeResponse = ApiResponse<UserRecord>;
export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  roles: string[];
  permissions: string[];
  memberships: AccessProfile["memberships"];
  assignments: AccessProfile["assignments"];
}
export interface Session {
  user: AuthUser;
}
