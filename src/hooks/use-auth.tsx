"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AUTH_SERVICES } from "@/services/auth";
import { ApiError } from "@/lib/api-client";
import { getAuthToken, removeAuthToken, setAuthToken } from "@/lib/auth-cookie";
import type { AuthState, SignUpPayload } from "@/types/auth";
import type { UserRecord } from "@/types/api";
const anonymous: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  roles: [],
  permissions: [],
};
function authenticated(profile: UserRecord, token: string): AuthState {
  return {
    ...anonymous,
    token,
    isAuthenticated: true,
    user: {
      id: profile.uuid,
      username: profile.username,
      email: profile.email,
      name:
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        profile.username,
      role: profile.roles?.map((role) => role.name).join(", ") || "Member",
    },
    roles: profile.roles?.map((role) => role.code) ?? [],
    permissions: profile.permissions ?? [],
  };
}
async function readSession(): Promise<AuthState> {
  const token = getAuthToken();
  if (!token) return anonymous;
  try {
    return authenticated((await AUTH_SERVICES.me()).data, token);
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      removeAuthToken();
      return anonymous;
    }
    return {
      ...anonymous,
      token,
      error:
        cause instanceof Error ? cause.message : "Unable to load your account.",
    };
  }
}
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (payload: SignUpPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    ...anonymous,
    loading: true,
  });
  useEffect(() => {
    let active = true;
    const expireSession = () => {
      active = false;
      setState(anonymous);
      router.replace("/sign-in");
      router.refresh();
    };
    window.addEventListener("petpet:session-expired", expireSession);
    readSession().then((session) => {
      if (active) setState(session);
    });
    return () => {
      active = false;
      window.removeEventListener("petpet:session-expired", expireSession);
    };
  }, [router]);
  const refreshSession = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    setState(await readSession());
  }, []);
  async function login(email: string, password: string) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await AUTH_SERVICES.login(email, password);
      setAuthToken(response.data.access_token, response.data.expires_in);
      const profile = await AUTH_SERVICES.me();
      setState(authenticated(profile.data, response.data.access_token));
      router.replace("/competition");
      router.refresh();
    } catch (cause) {
      removeAuthToken();
      setState({
        ...anonymous,
        error: cause instanceof Error ? cause.message : "Login failed.",
      });
      throw cause;
    }
  }
  async function register(payload: SignUpPayload) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await AUTH_SERVICES.register(payload);
      setAuthToken(response.data.access_token, response.data.expires_in);
      const profile = await AUTH_SERVICES.me();
      setState(authenticated(profile.data, response.data.access_token));
      router.replace("/competition");
      router.refresh();
    } catch (cause) {
      removeAuthToken();
      setState({
        ...anonymous,
        error: cause instanceof Error ? cause.message : "Registration failed.",
      });
      throw cause;
    }
  }
  async function logout() {
    try {
      await AUTH_SERVICES.logout();
    } finally {
      removeAuthToken();
      setState(anonymous);
      router.replace("/sign-in");
      router.refresh();
    }
  }
  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshSession,
        hasRole: (role) =>
          (Array.isArray(role) ? role : [role]).some((code) =>
            state.roles.includes(code),
          ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
