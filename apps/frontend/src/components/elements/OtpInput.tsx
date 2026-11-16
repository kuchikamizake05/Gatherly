"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Isian kode 6 digit. Pita 10 (A3, B3, D2, G1) dan pita 20 (kode autentikator).
 * - Pindah otomatis ke kotak berikutnya, Backspace kembali ke kotak sebelumnya.
 * - Tempel kode utuh dari email langsung terisi semua.
 * - Keyboard angka di mobile dan isi otomatis dari SMS/email (autocomplete one-time-code).
 * - error: kotak bergaris merah. Halaman mengosongkan value dan memanggil focus ulang.
 */

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Dipanggil saat 6 digit lengkap. */
  onComplete?: (value: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Ubah nilai ini untuk memindahkan fokus ke kotak pertama, misalnya setelah kode salah. */
  focusKey?: number;
};

export function OtpInput({ value, onChange, onComplete, length = 6, error, disabled, autoFocus = true, focusKey }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus || focusKey !== undefined) refs.current[Math.min(value.length, length - 1)]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };

  return (
    <div className="flex w-full justify-between gap-2 md:gap-3" role="group" aria-label="Kode verifikasi 6 digit">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={error || undefined}
          className={cn(
            "h-14 w-full min-w-0 rounded-md border bg-background text-center text-2xl font-extrabold text-foreground outline-none transition-[border-color,box-shadow] duration-150",
            "focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground",
            error ? "border-danger ring-1 ring-danger" : "border-border-strong",
            disabled && "cursor-not-allowed bg-surface-2",
          )}
          onChange={(e) => {
            const input = e.target.value.replace(/\D/g, "");
            if (input.length > 1) return set(value.slice(0, i) + input);
            const chars = digits.slice();
            chars[i] = input;
            set(chars.join(""));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              set(value.slice(0, i - 1));
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            set(e.clipboardData.getData("text"));
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
