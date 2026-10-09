"use client";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Permission } from "@/lib/auth/permissions";

/** Renders children only when the user holds the permission. UX only; the API enforces it. */
export function Can({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return can(permission) ? children : null;
}

/** Page guard: shows a friendly 403 instead of the page. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { can } = useAuth();
  return can(permission) ? children : <Forbidden />;
}

export function Forbidden() {
  return (
    <div
      role="alert"
      className="mx-auto mt-16 grid max-w-md justify-items-center gap-3 text-center"
    >
      <span className="bg-primary-soft text-primary-dark grid size-14 place-items-center rounded-2xl">
        <ShieldAlert size={26} />
      </span>
      <h1 className="font-display text-2xl font-semibold">No access</h1>
      <p className="text-muted-foreground">
        Your account doesn&apos;t have permission to open this page. If you
        think this is a mistake, ask an organization owner or an administrator.
      </p>
    </div>
  );
}
