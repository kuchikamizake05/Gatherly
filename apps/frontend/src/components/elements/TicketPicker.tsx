"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateShort, formatRupiah, formatTime } from "@/lib/format";
import type { TicketType } from "@/modules/events/types";

/**
 * Pilihan jenis tiket dengan stepper jumlah. Komponen "Ticket Option" dan "Stepper" di pita 02.
 * Dipakai di kartu tiket detail acara dan lembar Pilih tiket di mobile (pita 04 B, E, F).
 *
 * Batas per pesanan berlaku untuk total semua jenis tiket (default 4).
 */

export type TicketSelection = Record<string, number>;

export function Stepper({
  value,
  onChange,
  canIncrease,
  label,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  canIncrease: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 0}
        aria-label={`Kurangi ${label}`}
        className="press flex size-[34px] items-center justify-center rounded-full border border-border-strong bg-background disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-4 text-center text-base font-extrabold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || !canIncrease}
        aria-label={`Tambah ${label}`}
        className="press flex size-[34px] items-center justify-center rounded-full bg-inverse text-inverse-foreground disabled:opacity-25"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function statusNote(t: TicketType) {
  switch (t.status) {
    case "sold_out":
      return "Habis terjual";
    case "not_open":
      return `Dijual mulai ${formatDateShort(t.salesStartsAt).replace(/ \d{4}$/, "")}, ${formatTime(t.salesStartsAt)}`;
    case "stopped":
      return "Tidak tersedia";
    case "closed":
      return "Penjualan ditutup";
    default:
      return t.remaining !== undefined ? `Sisa ${t.remaining} tiket` : null;
  }
}

type TicketPickerProps = {
  ticketTypes: TicketType[];
  value: TicketSelection;
  onChange: (next: TicketSelection) => void;
  maxPerOrder?: number;
  /** Kunci semua kontrol, misalnya saat pesanan sedang diproses atau luring. */
  disabled?: boolean;
  className?: string;
};

export function selectionTotal(ticketTypes: TicketType[], value: TicketSelection) {
  const quantity = Object.values(value).reduce((sum, n) => sum + n, 0);
  const amount = ticketTypes.reduce((sum, t) => sum + (value[t.id] ?? 0) * t.price, 0);
  return { quantity, amount };
}

export function TicketPicker({ ticketTypes, value, onChange, maxPerOrder = 4, disabled, className }: TicketPickerProps) {
  const { quantity } = selectionTotal(ticketTypes, value);
  const atLimit = quantity >= maxPerOrder;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {ticketTypes.map((t) => {
        const qty = value[t.id] ?? 0;
        const buyable = t.status === "on_sale";
        const remaining = t.remaining ?? Number.POSITIVE_INFINITY;
        const note = statusNote(t);
        return (
          <div
            key={t.id}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg border bg-background p-4 transition-colors",
              qty > 0 ? "border-foreground bg-primary-tint" : "border-border-strong",
              !buyable && "bg-surface",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cn("text-base font-bold", !buyable && "text-text-secondary")}>{t.name}</span>
              <span className="text-[15px] font-bold text-text-secondary">
                {t.price === 0 ? "Gratis" : formatRupiah(t.price)}
              </span>
              {note && <span className="text-[13px] text-text-tertiary">{note}</span>}
            </div>
            {buyable && (
              <Stepper
                label={t.name}
                value={qty}
                disabled={disabled}
                canIncrease={!atLimit && qty < remaining}
                onChange={(next) => onChange({ ...value, [t.id]: Math.max(0, next) })}
              />
            )}
          </div>
        );
      })}
      {atLimit && (
        <p className="text-[13px] font-semibold text-warning-ink" role="status">
          Sudah {maxPerOrder} tiket, batas per pesanan
        </p>
      )}
    </div>
  );
}
