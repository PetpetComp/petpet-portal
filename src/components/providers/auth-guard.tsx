"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, token, error, refreshSession } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !isAuthenticated && !token) router.replace("/sign-in");
  }, [loading, isAuthenticated, token, router]);
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        <p role="status">Loading your account...</p>
      </main>
    );
  if (error && token)
    return (
      <main className="grid min-h-screen place-content-center gap-4 p-8">
        <p role="alert">{error}</p>
        <Button onClick={() => void refreshSession()}>Try again</Button>
      </main>
    );
  if (!isAuthenticated) return null;
  return children;
}
