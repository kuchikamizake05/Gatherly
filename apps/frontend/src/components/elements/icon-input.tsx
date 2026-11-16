"use client";

import { forwardRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Input dengan ikon di kiri dan elemen opsional di kanan, sesuai komponen Input di pita 02
 * (ikon 18 px, jarak 14 px). PasswordInput menambahkan tombol tampilkan atau sembunyikan.
 * Dipakai di semua form masuk (pita 10, 11, 14, 20) dan form lain yang butuh ikon.
 */

type IconInputProps = React.ComponentProps<typeof Input> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

export const IconInput = forwardRef<HTMLInputElement, IconInputProps>(function IconInput(
  { leading, trailing, className, ...props },
  ref,
) {
  return (
    <div className="relative w-full">
      {leading && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-foreground [&_svg]:size-[18px]">
          {leading}
        </span>
      )}
      <Input ref={ref} className={cn(leading && "pl-11", trailing && "pr-12", className)} {...props} />
      {trailing && <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<IconInputProps, "type" | "trailing">>(
  function PasswordInput({ leading = <Lock />, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <IconInput
        ref={ref}
        type={visible ? "text" : "password"}
        leading={leading}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
            aria-pressed={visible}
            className="press flex size-9 items-center justify-center rounded-md text-text-tertiary [@media(hover:hover)]:hover:text-foreground"
          >
            {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        }
        {...props}
      />
    );
  },
);
