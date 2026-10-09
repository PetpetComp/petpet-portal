"use client";

import { useState, type FormEvent } from "react";

import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { useSignIn } from "@clerk/nextjs";
import type { OAuthStrategy } from "@clerk/nextjs/types";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import styles from "./login.module.css";

export function LoginForm() {
  const { login } = useAuth();
  const { signIn } = useSignIn();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [ssoPending, setSsoPending] = useState<OAuthStrategy | null>(null);
  const [error, setError] = useState("");

  async function handleSso(strategy: OAuthStrategy) {
    if (pending || ssoPending) return;
    setError("");
    setSsoPending(strategy);
    try {
      await signIn.sso({
        strategy,
        redirectUrl: "/sso-callback",
        redirectCallbackUrl: "/sso-callback",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start SSO sign-in. Please try again.",
      );
      setSsoPending(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await login(email, password);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to sign in. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} aria-busy={pending}>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <div className={styles.inputWrap}>
          <UserRound size={18} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="Enter your email"
            required
            disabled={pending}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <div className={styles.inputWrap}>
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            disabled={pending}
            aria-describedby={error ? "login-error" : undefined}
          />
          <button
            className={styles.reveal}
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            disabled={pending}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error && (
        <p id="login-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" className={styles.submit} disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle
              size={18}
              className={styles.spinner}
              aria-hidden="true"
            />{" "}
            Signing in...
          </>
        ) : (
          <>
            Sign in <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </Button>
      <p className={styles.demo}>
        Use the email and password registered with Petpet.
      </p>
      <div className={styles.divider}>or</div>
      <button
        type="button"
        className={styles.sso}
        onClick={() => handleSso("oauth_google")}
        disabled={pending || ssoPending !== null}
      >
        {ssoPending === "oauth_google" ? (
          <LoaderCircle
            size={18}
            className={styles.spinner}
            aria-hidden="true"
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
            />
          </svg>
        )}
        Continue with Google
      </button>
    </form>
  );
}
