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
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import styles from "./login.module.css";

export function LoginForm() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

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
    </form>
  );
}
