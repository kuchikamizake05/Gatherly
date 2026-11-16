"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Pilihan dengan kolom cari. Tampil seperti Input (komponen Input di pita 02) dengan panah di kanan.
 * Dipakai untuk daftar panjang: provinsi, kabupaten dan kota (RegionFields), bank, dan sejenisnya.
 * Keyboard: panah atas/bawah memindah sorotan, Enter memilih, Esc menutup.
 *
 * <Combobox id="bank" options={banks} value={bank} onChange={setBank} placeholder="Pilih bank" />
 */

export type ComboboxOption = { value: string; label: string; hint?: string };

type ComboboxProps = {
  id?: string;
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  leading?: ReactNode;
  className?: string;
};

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Combobox({
  id,
  options,
  value,
  onChange,
  onBlur,
  placeholder = "Pilih",
  searchPlaceholder = "Cari",
  emptyText = "Tidak ada yang cocok",
  disabled,
  invalid,
  leading,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => normalize(`${o.label} ${o.value}`).includes(q));
  }, [options, query]);

  const choose = (o: ComboboxOption) => {
    onChange(o.value);
    setOpen(false);
  };

  const move = (delta: number) => {
    setActive((i) => {
      const next = Math.max(0, Math.min(filtered.length - 1, i + delta));
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
      return next;
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        } else onBlur?.();
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center gap-2.5 rounded-md border bg-background px-3.5 text-left text-[15px] transition-[border-color,box-shadow] duration-150 outline-none",
            "focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-tertiary",
            invalid ? "border-danger" : open ? "border-foreground" : "border-border-strong",
            className,
          )}
        >
          {leading && <span className="shrink-0 [&_svg]:size-[18px]">{leading}</span>}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-text-tertiary")}>{selected?.label ?? placeholder}</span>
          <ChevronDown className={cn("size-[18px] shrink-0 transition-transform duration-150", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center gap-2 border-b border-border px-3.5">
          <Search className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), move(1));
              else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
              else if (e.key === "Enter" && filtered[active]) (e.preventDefault(), choose(filtered[active]));
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-controls={listId}
            aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-tertiary"
          />
        </div>
        {filtered.length === 0 ? (
          <p className="px-3.5 py-4 text-sm text-text-secondary">{emptyText}</p>
        ) : (
          <ul ref={listRef} id={listId} role="listbox" className="max-h-[280px] overflow-y-auto p-1.5">
            {filtered.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.5 text-[15px]",
                    i === active && "bg-surface",
                    isSelected && "font-bold",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    {o.label}
                    {o.hint && <span className="block text-[13px] font-normal text-text-tertiary">{o.hint}</span>}
                  </span>
                  {isSelected && <Check className="size-4 shrink-0" aria-hidden />}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
