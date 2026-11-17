import type { ReactNode } from "react";

// Organizer and admin page headings, design bands 15 and 17.
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </header>
  );
}
