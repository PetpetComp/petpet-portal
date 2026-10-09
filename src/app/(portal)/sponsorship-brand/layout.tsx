import { RequirePermission } from "@/components/common/can";
import { PERMISSION } from "@/lib/auth/permissions";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission={PERMISSION.MASTER_MANAGE}>
      {children}
    </RequirePermission>
  );
}
