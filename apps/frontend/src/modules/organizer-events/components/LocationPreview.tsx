"use client";

import { MapPin } from "lucide-react";

import { useDebounced } from "@/hooks/use-debounced";

/**
 * Pratinjau peta lokasi acara di editor. Memakai kueri yang sama dengan peta di halaman detail acara
 * (nama tempat dan alamat), jadi organizer melihat lokasi persis seperti yang dilihat peserta.
 */
export function LocationPreview({
  venueName,
  address,
}: {
  venueName: string;
  address: string;
}) {
  const query = useDebounced(
    [venueName.trim(), address.trim()].filter(Boolean).join(", "),
    800,
  );
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Pratinjau lokasi</p>
      <div className="relative h-[200px] w-full overflow-hidden rounded-xl bg-surface-2 md:h-[260px]">
        {query.length >= 4 ? (
          <iframe
            title="Pratinjau peta lokasi acara"
            src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-text-secondary">
            <MapPin className="size-5" aria-hidden />
            Isi nama tempat dan alamat untuk melihat lokasi di peta.
          </div>
        )}
      </div>
      <p className="text-xs text-text-secondary">
        Peta ini sama dengan yang tampil di halaman acara. Bila titiknya kurang
        tepat, lengkapi nama tempat atau alamat.
      </p>
    </div>
  );
}
