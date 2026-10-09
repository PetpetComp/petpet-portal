import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// Only the pages that use Clerk (Google sign-in and its callback) go through
// Clerk. Everything else uses our own API token, so it skips the Clerk
// handshake and its scripts.
export const config = {
  matcher: ["/sign-in(.*)", "/sso-callback(.*)", "/__clerk/:path*"],
};
