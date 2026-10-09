import { ClerkProvider } from "@clerk/nextjs";

/**
 * Clerk is only used to sign in with Google and swap that session for our own
 * API token, so it loads on the auth pages only (see src/proxy.ts).
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
