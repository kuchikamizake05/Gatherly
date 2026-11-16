"use client";

import { useEffect, useState } from "react";
import { CircleCheck, CircleAlert, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUsernameCheck } from "@/modules/applications/hooks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Username akun organizer dengan cek ketersediaan 0,5 detik setelah berhenti mengetik. Pita 13 E.
 * Format: 4 sampai 30 huruf kecil, angka, titik, atau garis bawah.
 */

export const USERNAME_RE = /^[a-z0-9._]{4,30}$/;

export type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid";

export function UsernameField({
  value,
  onChange,
  onBlur,
  onStateChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onStateChange?: (s: UsernameState) => void;
  error?: string;
  disabled?: boolean;
}) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), 500);
    return () => window.clearTimeout(t);
  }, [value]);

  const valid = USERNAME_RE.test(debounced);
  const check = useUsernameCheck(debounced, valid && !disabled);
  const typing = value !== debounced;

  const state: UsernameState = !value
    ? "idle"
    : !typing && !valid
      ? "invalid"
      : typing || check.isFetching
        ? "checking"
        : check.data?.available
          ? "available"
          : check.data
            ? "taken"
            : "idle";

  useEffect(() => onStateChange?.(state), [state, onStateChange]);

  const message =
    error ??
    (state === "invalid"
      ? "Gunakan 4 sampai 30 huruf kecil, angka, titik, atau garis bawah"
      : state === "taken"
        ? `Username sudah dipakai.${check.data?.suggestions.length ? ` Coba ${check.data.suggestions.slice(0, 2).join(" atau ")}` : ""}`
        : null);
  const bad = !!error || state === "invalid" || state === "taken";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="username">Username</Label>
      <div className="relative">
        <Input
          id="username"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ""))}
          onBlur={onBlur}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="kolektifsawah"
          aria-invalid={bad || undefined}
          aria-describedby="username-status"
          className="pr-11"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2" aria-hidden>
          {state === "checking" && <Loader2 className="size-[18px] animate-spin text-text-tertiary" />}
          {state === "available" && !error && <CircleCheck className="size-[18px] text-success" />}
          {bad && <CircleAlert className="size-[18px] text-danger" />}
        </span>
      </div>
      <p
        id="username-status"
        aria-live="polite"
        className={cn("text-[13px]", bad ? "text-danger-ink" : state === "available" ? "font-semibold text-success-ink" : "text-text-tertiary")}
      >
        {message ??
          (state === "checking"
            ? "Memeriksa ketersediaan…"
            : state === "available"
              ? "Username tersedia"
              : "Dipakai untuk masuk ke organizer.gatherly.xyz.")}
      </p>
    </div>
  );
}
