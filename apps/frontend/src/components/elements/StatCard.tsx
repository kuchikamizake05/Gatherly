import type { ReactNode } from "react";

// Organizer/admin summary metrics, design bands 15 and 17.
export function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-background p-4 md:p-5">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 break-words text-[26px] leading-tight font-extrabold tracking-tight tabular-nums md:text-[30px]">
        {value}
      </p>
      {caption && (
        <p className="mt-2 text-xs leading-relaxed text-text-secondary">
          {caption}
        </p>
      )}
    </div>
  );
}
