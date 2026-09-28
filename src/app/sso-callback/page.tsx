"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";

import { useAuth } from "@/hooks/use-auth";

export default function SsoCallbackPage() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { loginWithSso } = useAuth();
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    (async () => {
      if (!clerk.loaded || hasRun.current) return;
      hasRun.current = true;

      const exchangeAndRedirect = async () => {
        try {
          const token = await clerk.session?.getToken();
          if (!token) throw new Error("Missing Clerk session token.");
          await loginWithSso(token);
        } catch {
          router.replace("/sign-in");
        }
      };

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: async ({ session }) => {
            if (session) await exchangeAndRedirect();
          },
        });
        return;
      }

      if (signUp.status === "complete") {
        await signUp.finalize({
          navigate: async ({ session }) => {
            if (session) await exchangeAndRedirect();
          },
        });
        return;
      }

      if (signIn.existingSession || signUp.existingSession) {
        const sessionId =
          signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
        if (sessionId) {
          await clerk.setActive({ session: sessionId });
          await exchangeAndRedirect();
          return;
        }
      }

      router.replace("/sign-in");
    })();
  }, [clerk, signIn, signUp, loginWithSso, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Signing you in…</p>
      <div id="clerk-captcha" />
    </div>
  );
}
