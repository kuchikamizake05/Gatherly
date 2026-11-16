"use client";

import { useState, type ReactNode } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TelegramIcon, WhatsAppIcon, XIcon } from "@/components/elements/BrandIcons";

/**
 * Pilihan bagikan acara. Pita 04 D3.
 * Di ponsel (layar sentuh) memakai lembar bagikan bawaan perangkat bila tersedia.
 */
export function ShareMenu({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.href.split("?")[0];
  const text = `${title} di Gatherly`;

  const copy = async () => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      toast("Tautan acara disalin", { icon: <Link2 className="size-[18px]" /> });
    } catch {
      toast.error("Gagal menyalin tautan. Salin dari kolom alamat browser.");
    }
  };

  const options = [
    { label: "Salin tautan", icon: <Link2 className="size-[18px]" />, onClick: copy },
    { label: "Kirim lewat WhatsApp", icon: <WhatsAppIcon />, href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    { label: "Kirim lewat Telegram", icon: <TelegramIcon />, href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: "Bagikan ke X", icon: <XIcon />, href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  ];

  return (
    <Popover
      open={open}
      onOpenChange={async (next) => {
        if (next && navigator.share && window.matchMedia("(pointer: coarse)").matches) {
          try {
            await navigator.share({ title: text, url });
          } catch {
            /* dibatalkan pengguna */
          }
          return;
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-2">
        <ul className="flex flex-col">
          {options.map((o) => (
            <li key={o.label}>
              {o.href ? (
                <a
                  href={o.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="press flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold [@media(hover:hover)]:hover:bg-surface"
                >
                  {o.icon}
                  {o.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={o.onClick}
                  className="press flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold [@media(hover:hover)]:hover:bg-surface"
                >
                  {o.icon}
                  {o.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
