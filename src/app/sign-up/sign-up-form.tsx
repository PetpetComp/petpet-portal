"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  AtSign,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

import styles from "./sign-up.module.css";

export function SignUpForm() {
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const firstName = String(data.get("first_name") ?? "").trim();
    const lastName = String(data.get("last_name") ?? "").trim();
    const username = String(data.get("username") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirm_password") ?? "");
    if (!firstName || !username || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setPending(true);
    try {
      await register({
        first_name: firstName,
        last_name: lastName || undefined,
        username,
        email,
        password,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create your account. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} aria-busy={pending}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="first_name">First name</label>
          <div className={styles.inputWrap}>
            <UserRound size={18} aria-hidden="true" />
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              placeholder="Jane"
              required
              disabled={pending}
              aria-describedby={error ? "sign-up-error" : undefined}
            />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="last_name">Last name</label>
          <div className={styles.inputWrap}>
            <UserRound size={18} aria-hidden="true" />
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              placeholder="Doe"
              disabled={pending}
            />
          </div>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="username">Username</label>
        <div className={styles.inputWrap}>
          <AtSign size={18} aria-hidden="true" />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="janedoe"
            required
            disabled={pending}
            aria-describedby={error ? "sign-up-error" : undefined}
          />
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <div className={styles.inputWrap}>
          <Mail size={18} aria-hidden="true" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="jane@example.com"
            required
            disabled={pending}
            aria-describedby={error ? "sign-up-error" : undefined}
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
            autoComplete="new-password"
            placeholder="Create a password"
            required
            disabled={pending}
            aria-describedby={error ? "sign-up-error" : undefined}
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
      <div className={styles.field}>
        <label htmlFor="confirm_password">Confirm password</label>
        <div className={styles.inputWrap}>
          <LockKeyhole size={18} aria-hidden="true" />
          <input
            id="confirm_password"
            name="confirm_password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            required
            disabled={pending}
            aria-describedby={error ? "sign-up-error" : undefined}
          />
        </div>
      </div>
      {error && (
        <p id="sign-up-error" role="alert" className={styles.error}>
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
            Creating account...
          </>
        ) : (
          <>
            Create account <ArrowRight size={18} aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  );
}
