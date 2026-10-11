import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_TOKEN } from "@/lib/constants/cookies";
import { isValidAuthToken } from "@/lib/auth-cookie";
import { AuthGuard } from "@/components/providers/auth-guard";

/**
 * Layout grup route Live Mode (layar penuh). Sengaja di luar grup `(portal)`: tidak ada sidebar,
 * PortalDataProvider, maupun portal.css. Pengamannya sama dengan portal: tanpa cookie token
 * yang valid -> redirect ke /sign-in di server, lalu AuthGuard memeriksa sesi di klien.
 * Provider query/auth sudah dipasang di root layout.
 */
export default async function LiveGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isValidAuthToken((await cookies()).get(COOKIE_TOKEN)?.value))
    redirect("/sign-in");
  return <AuthGuard>{children}</AuthGuard>;
}
