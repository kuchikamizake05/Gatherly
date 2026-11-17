"use client";

import { format, parse } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FORMAT = "yyyy-MM-dd'T'HH:mm";

/**
 * Pengganti input datetime-local: tanggal lewat Calendar (shadcn) di popover, jam lewat input jam.
 * Nilai tetap berformat datetime-local ("2026-11-20T19:00"), jadi skema form tidak berubah.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
  min,
  placeholder = "Pilih tanggal",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  /** Tanggal paling awal yang bisa dipilih. */
  min?: Date;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parse(value.slice(0, 16), FORMAT, new Date()) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const time = date ? format(date, "HH:mm") : "";

  const emit = (day: Date | null, hhmm: string) => {
    if (!day) return onChange("");
    const [h, m] = (hhmm || "09:00").split(":").map(Number);
    const next = new Date(day);
    next.setHours(h ?? 0, m ?? 0, 0, 0);
    onChange(format(next, FORMAT));
  };

  return (
    <div className="flex gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onBlur?.();
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={cn(
              "flex h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-background px-3.5 text-left text-[15px] outline-none focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:bg-surface-2 aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger",
              !date && "text-text-tertiary",
            )}
          >
            <CalendarDays className="size-[18px] shrink-0 text-text-tertiary" />
            <span className="truncate">
              {date
                ? format(date, "EEE, d MMM yyyy", { locale: localeId })
                : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={localeId}
            selected={date ?? undefined}
            defaultMonth={date ?? min ?? undefined}
            disabled={min ? { before: min } : undefined}
            onSelect={(day) => {
              emit(day ?? null, time);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        aria-label="Jam"
        value={time}
        disabled={disabled || !date}
        aria-invalid={invalid}
        onChange={(e) => emit(date, e.target.value)}
        onBlur={onBlur}
        className="w-28 shrink-0 [&::-webkit-calendar-picker-indicator]:hidden"
      />
    </div>
  );
}
