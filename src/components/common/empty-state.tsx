import type { ComponentType, ReactNode } from "react";
import Link from "next/link";

export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: ComponentType<{
    size?: number;
    className?: string;
    "aria-hidden"?: boolean;
  }>;
  message: ReactNode;
  action?: { label: ReactNode; href: string };
}) {
  return (
    <div className="state-card">
      <Icon size={28} className="state-card-icon" aria-hidden={true} />
      <p>{message}</p>
      {action && (
        <Link href={action.href} className="cta-pill">
          {action.label}
        </Link>
      )}
    </div>
  );
}
