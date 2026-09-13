import type { ReactNode } from "react";

interface PageHeadingProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeading({ title, description, actions }: PageHeadingProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold break-words">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
