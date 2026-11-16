import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, WifiOff, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Kotak pesan di dalam halaman atau form. Komponen "Alert" di pita 02.
 * Dipakai untuk error form (pita 10, 11, 13), peringatan, dan info.
 * Untuk keadaan halaman penuh pakai StateView, untuk pesan sesaat pakai toast.
 */

type Tone = "danger" | "warning" | "success" | "info" | "offline";

const TONE: Record<Tone, { box: string; icon: LucideIcon }> = {
  danger: { box: "bg-danger-tint text-danger-ink", icon: CircleAlert },
  warning: { box: "bg-warning-tint text-warning-ink", icon: TriangleAlert },
  success: { box: "bg-success-tint text-success-ink", icon: CircleCheck },
  info: { box: "bg-info-tint text-info-ink", icon: Info },
  offline: { box: "bg-info-tint text-info-ink", icon: WifiOff },
};

type AlertProps = {
  tone?: Tone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function Alert({ tone = "danger", title, children, action, className }: AlertProps) {
  const { box, icon: Icon } = TONE[tone];
  return (
    <div
      role={tone === "danger" || tone === "warning" || tone === "offline" ? "alert" : "status"}
      className={cn("flex w-full gap-3 rounded-lg p-4", box, className)}
    >
      <Icon className="mt-px size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[15px] font-bold">{title}</p>
        {children && <div className="text-sm leading-relaxed opacity-90">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
