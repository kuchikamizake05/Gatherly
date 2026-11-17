"use client";

import {
  forwardRef,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Download, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Penampil dokumen. Pita 21 F2: admin memeriksa KTP dan dokumen legalitas.
 * Layar gelap penuh dengan perbesar, perkecil, putar, unduh, dan tutup. Gambar dan PDF.
 * Keyboard: + dan - untuk zoom, R untuk putar, Esc untuk menutup.
 *
 * <DocumentViewer
 *   open={open} onOpenChange={setOpen}
 *   file={{ name: "ktp-rafi-pratama.jpg", url, type: "image/jpeg" }}
 *   caption="Foto KTP penanggung jawab, 820 KB"
 *   footer="Data pribadi hanya untuk verifikasi dan tidak dibagikan."
 * />
 */

type ViewerFile = { name: string; url: string; type: string };

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const ControlButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { label: string }
>(function ControlButton({ label, children, ...props }, ref) {
  return (
    <button
      type="button"
      aria-label={label}
      ref={ref}
      {...props}
      className="press flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors disabled:opacity-40 [@media(hover:hover)]:hover:bg-white/20"
    >
      {children}
    </button>
  );
});

export function DocumentViewer({
  open,
  onOpenChange,
  file,
  caption,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: ViewerFile | null;
  caption?: ReactNode;
  footer?: ReactNode;
}) {
  const [zoom, setZoom] = useState(2);
  const [rotation, setRotation] = useState(0);
  const [failed, setFailed] = useState(false);
  const isPdf = file?.type === "application/pdf";
  useEffect(() => {
    setZoom(2);
    setRotation(0);
    setFailed(false);
  }, [file?.url, open]);

  const zoomOut = () => setZoom((z) => Math.max(0, z - 1));
  const zoomIn = () => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1));
  const rotate = () => setRotation((r) => (r + 90) % 360);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={(e) => {
            if (isPdf) return;
            if (e.key === "+" || e.key === "=") zoomIn();
            if (e.key === "-") zoomOut();
            if (e.key.toLowerCase() === "r") rotate();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-inverse text-inverse-foreground outline-none md:inset-[4vh] md:mx-auto md:max-w-[1000px] md:rounded-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <div className="flex items-center justify-between gap-4 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-4 md:px-5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogPrimitive.Title className="truncate text-[15px] font-extrabold">
                {file?.name ?? "Dokumen"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-xs font-medium text-white/70">
                {caption ?? "Pratinjau dokumen pengajuan"}
              </DialogPrimitive.Description>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isPdf && (
                <>
                  <ControlButton
                    label="Perkecil"
                    onClick={zoomOut}
                    disabled={zoom === 0}
                  >
                    <ZoomOut className="size-[18px]" aria-hidden />
                  </ControlButton>
                  <ControlButton
                    label="Perbesar"
                    onClick={zoomIn}
                    disabled={zoom === ZOOMS.length - 1}
                  >
                    <ZoomIn className="size-[18px]" aria-hidden />
                  </ControlButton>
                  <ControlButton label="Putar" onClick={rotate}>
                    <RotateCw className="size-[18px]" aria-hidden />
                  </ControlButton>
                </>
              )}
              {file && (
                <a
                  href={file.url}
                  download={file.name}
                  aria-label="Unduh"
                  className="press flex size-11 items-center justify-center rounded-full bg-white/10 text-white [@media(hover:hover)]:hover:bg-white/20"
                >
                  <Download className="size-[18px]" aria-hidden />
                </a>
              )}
              <DialogPrimitive.Close asChild>
                <ControlButton label="Tutup">
                  <X className="size-[18px]" aria-hidden />
                </ControlButton>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div
            className={cn(
              "relative flex min-h-0 flex-1 items-center justify-center overflow-auto",
              !isPdf && "p-6",
            )}
          >
            {failed ? (
              <p role="alert" className="p-6 text-center text-sm">
                Dokumen gagal dimuat. Tutup lalu coba buka kembali.
              </p>
            ) : !file ? null : isPdf ? (
              <iframe
                title={file.name}
                src={file.url}
                className="size-full bg-white md:rounded-b-none"
              />
            ) : (
              <Image
                src={file.url}
                alt={file.name}
                width={1000}
                height={700}
                unoptimized
                onError={() => setFailed(true)}
                draggable={false}
                className="max-h-full max-w-full rounded-lg object-contain transition-transform duration-200 ease-out select-none"
                style={{
                  transform: `scale(${ZOOMS[zoom]}) rotate(${rotation}deg)`,
                }}
              />
            )}
          </div>

          {footer && (
            <p className="px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] text-[13px] font-medium text-white/70 md:px-5">
              {footer}
            </p>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
