import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_TOKEN } from "@/lib/constants/cookies";
import { isValidAuthToken } from "@/lib/auth-cookie";
import { AuthGuard } from "@/components/providers/auth-guard";
import { PortalDataProvider } from "@/components/providers/portal-data-provider";
import { PortalShell } from "@/components/layouts/portal-shell";
import "./portal.css";
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isValidAuthToken((await cookies()).get(COOKIE_TOKEN)?.value))
    redirect("/sign-in");
  return (
    <AuthGuard>
      <PortalDataProvider>
        <PortalShell>{children}</PortalShell>
      </PortalDataProvider>
    </AuthGuard>
  );
}
