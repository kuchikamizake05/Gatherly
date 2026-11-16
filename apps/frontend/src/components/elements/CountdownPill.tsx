"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Pil hitung mundur tiket ditahan. Komponen "Countdown" di pita 02.
 * Dipakai di checkout (pita 05) dan kartu menunggu bayar di Tiketku (pita 07 C).
 *
 * serverTime menyamakan jam perangkat dengan jam server (OrderDTO.serverTime),
 * supaya hitungan tidak meleset bila jam ponsel pengguna salah.
 */

type CountdownPillProps = {
  expiresAt: string;
  serverTime?: string;
  label?: string;
  onExpire?: () => void;
  className?: string;
};

function remainingMs(expiresAt: string, offset: number) {
  return Math.max(0, new Date(expiresAt).getTime() - (Date.now() + offset));
}

function format(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}.${String(s).padStart(2, "0")}`;
}

export function CountdownPill({ expiresAt, serverTime, label = "Tiket ditahan untuk Anda", onExpire, className }: CountdownPillProps) {
  const offset = useRef(serverTime ? new Date(serverTime).getTime() - Date.now() : 0);
  const [ms, setMs] = useState(() => remainingMs(expiresAt, offset.current));
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = remainingMs(expiresAt, offset.current);
      setMs(left);
      if (left === 0 && !fired.current) {
        fired.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, onExpire]);

  return (
    <div
      className={cn(
        "inline-flex h-11 w-fit self-start items-center gap-2.5 rounded-full bg-warning-tint pr-2 pl-3.5 text-warning-ink",
        className,
      )}
    >
      <Timer className="size-[18px] shrink-0" aria-hidden />
      <span className="text-sm font-semibold">{label}</span>
      <span
        className="flex h-[30px] items-center rounded-full bg-background px-2.5 text-[15px] font-extrabold tabular-nums"
        role="timer"
        aria-label={`Sisa waktu ${Math.ceil(ms / 60000)} menit`}
      >
        {format(ms)}
      </span>
    </div>
  );
}
