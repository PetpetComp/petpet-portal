export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
}

export interface SignInPayload {
  username: string;
  password: string;
}

export interface Session {
  token: string;
  user: AuthUser;
}
