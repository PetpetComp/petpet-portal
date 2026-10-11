import { RequirePermission } from "@/components/common/can";
import { PERMISSION } from "@/lib/auth/permissions";

/** Halaman Roles & access butuh `user.view` (sama dengan `GET /auth/permissions`). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission={PERMISSION.USER_VIEW}>
      {children}
    </RequirePermission>
  );
}
