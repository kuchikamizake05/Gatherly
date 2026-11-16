import { Check, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Indikator password. Minimal 12 karakter (sama dengan backend).
 * - PasswordLength: empat segmen + teks bantu, untuk form daftar (pita 10 D1, F2).
 * - PasswordRules: segmen + daftar syarat, untuk password baru (pita 11 A3, C3; pita 12; pita 14).
 */

export const PASSWORD_MIN = 12;

const strength = (pw: string) => {
  let score = Math.min(3, Math.floor((pw.length / PASSWORD_MIN) * 3));
  if (pw.length >= PASSWORD_MIN && /[\d\W_]/.test(pw)) score = 4;
  return score;
};

function Segments({ value, tone }: { value: string; tone: "success" | "warning" | "danger" }) {
  const score = strength(value);
  const color = tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-danger";
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cn("h-1 flex-1 rounded-full", i < score ? color : "bg-border")} />
      ))}
    </div>
  );
}

export function PasswordLength({ value }: { value: string }) {
  const short = value.length < PASSWORD_MIN;
  if (!value) return null;
  return (
    <div className="flex flex-col gap-2">
      <Segments value={value} tone={short ? "warning" : "success"} />
      <p className={cn("text-[13px]", short ? "text-warning-ink" : "text-success-ink")} aria-live="polite">
        {short
          ? `${value.length} dari minimal ${PASSWORD_MIN} karakter. Tambahkan ${PASSWORD_MIN - value.length} karakter lagi.`
          : "Panjang password sudah cukup."}
      </p>
    </div>
  );
}

type Rule = { label: string; state: "ok" | "fail" | "hint" };

export function PasswordRules({ value, sameAsOld = false }: { value: string; sameAsOld?: boolean }) {
  const rules: Rule[] = [
    { label: `Minimal ${PASSWORD_MIN} karakter`, state: value.length >= PASSWORD_MIN ? "ok" : value ? "fail" : "hint" },
    { label: "Beda dari password lama", state: sameAsOld ? "fail" : value ? "ok" : "hint" },
    { label: "Disarankan: campur angka atau simbol", state: /[\d\W_]/.test(value) ? "ok" : "hint" },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {value && <Segments value={value} tone={sameAsOld || value.length < PASSWORD_MIN ? "danger" : "success"} />}
      <ul className="flex flex-col gap-1.5">
        {rules.map((r) => (
          <li
            key={r.label}
            className={cn(
              "flex items-center gap-2 text-[13px]",
              r.state === "ok" ? "text-success-ink" : r.state === "fail" ? "text-danger-ink" : "text-text-tertiary",
            )}
          >
            {r.state === "ok" ? <Check className="size-4" /> : r.state === "fail" ? <X className="size-4" /> : <Minus className="size-4" />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
