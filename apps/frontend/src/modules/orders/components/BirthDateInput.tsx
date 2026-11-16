"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Tanggal lahir tiga kotak DD / MM / YYYY (pita 05 A1). Nilai keluar sebagai "YYYY-MM-DD",
 * atau string tidak lengkap seperti "2005-03-" saat belum selesai diisi, supaya validasi bisa membedakan.
 * Pindah otomatis ke kotak berikutnya setelah dua digit.
 */
export function BirthDateInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}) {
  const [y0, m0, d0] = (value || "--").split("-");
  const [parts, setParts] = useState({ d: d0 ?? "", m: m0 ?? "", y: y0 ?? "" });
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const [y, m, d] = (value || "--").split("-");
    setParts((p) => (p.d === (d ?? "") && p.m === (m ?? "") && p.y === (y ?? "") ? p : { d: d ?? "", m: m ?? "", y: y ?? "" }));
  }, [value]);

  const set = (key: "d" | "m" | "y", raw: string) => {
    const max = key === "y" ? 4 : 2;
    const v = raw.replace(/\D/g, "").slice(0, max);
    const next = { ...parts, [key]: v };
    setParts(next);
    onChange(next.d || next.m || next.y ? `${next.y}-${next.m}-${next.d}` : "");
    if (v.length === max && key === "d") mRef.current?.focus();
    if (v.length === max && key === "m") yRef.current?.focus();
  };

  const box = cn(
    "h-12 min-w-0 rounded-md border bg-background text-center text-[15px] font-medium outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground",
    invalid ? "border-danger" : "border-border-strong",
  );

  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr_auto_1.6fr] items-center gap-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onBlur?.();
      }}
    >
      <input id={id} inputMode="numeric" autoComplete="bday-day" aria-label="Tanggal" placeholder="DD" value={parts.d} onChange={(e) => set("d", e.target.value)} aria-invalid={invalid || undefined} className={box} />
      <span className="text-text-tertiary" aria-hidden>
        /
      </span>
      <input ref={mRef} inputMode="numeric" autoComplete="bday-month" aria-label="Bulan" placeholder="MM" value={parts.m} onChange={(e) => set("m", e.target.value)} aria-invalid={invalid || undefined} className={box} />
      <span className="text-text-tertiary" aria-hidden>
        /
      </span>
      <input ref={yRef} inputMode="numeric" autoComplete="bday-year" aria-label="Tahun" placeholder="YYYY" value={parts.y} onChange={(e) => set("y", e.target.value)} aria-invalid={invalid || undefined} className={box} />
    </div>
  );
}
