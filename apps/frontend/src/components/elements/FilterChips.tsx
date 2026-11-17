"use client";

import { useState, type ReactNode } from "react";
import { Banknote, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Chip filter dan popover rentang harga. Komponen "Chip" di pita 02, dipakai di pita 03 (B dan C).
 * Chip terpilih berwarna ink. Chip yang membuka popover tampak ditekan selama popover terbuka.
 */

type ChipProps = React.ComponentProps<"button"> & {
  selected?: boolean;
  leading?: ReactNode;
  /** Tampilkan panah bawah untuk chip yang membuka pilihan. */
  hasMenu?: boolean;
  /** Tampilkan tombol hapus di chip terpilih. */
  onClear?: () => void;
};

export function Chip({ selected, leading, hasMenu, onClear, className, children, ...props }: ChipProps) {
  return (
    <span className="inline-flex shrink-0">
      <button
        type="button"
        aria-pressed={selected}
        className={cn(
          "press inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors",
          // Saat menu terbuka, chip terpilih tetap gelap supaya teks putihnya terbaca.
          selected
            ? "border-inverse bg-inverse text-inverse-foreground"
            : "border-border-strong bg-background text-foreground data-[state=open]:border-foreground data-[state=open]:bg-surface-2 [@media(hover:hover)]:hover:bg-surface",
          "disabled:cursor-not-allowed disabled:opacity-50",
          onClear && selected && "rounded-r-none pr-2",
          className,
        )}
        {...props}
      >
        {leading}
        {children}
        {hasMenu && <ChevronDown className="size-4" aria-hidden />}
      </button>
      {onClear && selected && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Hapus filter"
          className="press inline-flex h-9 items-center rounded-r-full border border-l-0 border-inverse bg-inverse pr-3 pl-1 text-inverse-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </span>
  );
}

export type PriceRange = { min?: number; max?: number };

/** Label persis seperti di desain (pita 03 C2). */
const QUICK: { label: string; range: PriceRange }[] = [
  { label: "Gratis", range: { min: 0, max: 0 } },
  { label: "< Rp50rb", range: { max: 50000 } },
  { label: "Rp50–150rb", range: { min: 50000, max: 150000 } },
  { label: "> Rp150rb", range: { min: 150000 } },
];

function toNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : undefined;
}

function toText(value?: number) {
  return value === undefined ? "" : value.toLocaleString("id-ID");
}

/** Label chip saat rentang aktif, misalnya "Rp50.000 sampai Rp150.000". */
export function priceRangeLabel({ min, max }: PriceRange) {
  const rp = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
  if (min === 0 && max === 0) return "Gratis";
  if (min !== undefined && max !== undefined) return `${rp(min)} sampai ${rp(max)}`;
  if (min !== undefined) return `Di atas ${rp(min)}`;
  if (max !== undefined) return `Di bawah ${rp(max)}`;
  return "Harga";
}

/** Chip "Harga" dengan popover isian minimum, maksimum, dan pilihan cepat. */
export function PriceFilter({ value, onChange }: { value: PriceRange; onChange: (range: PriceRange) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ min: toText(value.min), max: toText(value.max) });
  const active = value.min !== undefined || value.max !== undefined;

  const apply = (range: PriceRange) => {
    onChange(range);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft({ min: toText(value.min), max: toText(value.max) });
      }}
    >
      <PopoverTrigger asChild>
        <Chip
          selected={active}
          hasMenu={!active}
          leading={<Banknote className="size-4" aria-hidden />}
          onClear={active ? () => onChange({}) : undefined}
        >
          {priceRangeLabel(value)}
        </Chip>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] rounded-lg p-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ min: toNumber(draft.min), max: toNumber(draft.max) });
          }}
        >
          <p className="text-base font-extrabold">Rentang harga tiket</p>
          <div className="grid grid-cols-2 gap-3">
            {(["min", "max"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`price-${key}`}>{key === "min" ? "Minimum" : "Maksimum"}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-text-tertiary">Rp</span>
                  <Input
                    id={`price-${key}`}
                    inputMode="numeric"
                    className="pl-10"
                    value={draft[key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: toText(toNumber(e.target.value)) }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Pilihan cepat</p>
            <div className="flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <Chip key={q.label} className="h-8 text-[13px]" onClick={() => apply(q.range)}>
                  {q.label}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-text-tertiary">Harga yang tampil adalah tiket termurah yang masih tersedia.</p>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => apply({})}>
              Hapus
            </Button>
            <Button type="submit">Terapkan</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
