"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import imageCompression from "browser-image-compression";
import { FileImage, FileText, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Unggah berkas. Pita 13 F (dokumen pengajuan), juga poster acara (16) dan logo organizer.
 * - Seret ke area atau pilih berkas. Gambar dikompres dulu di browser (browser-image-compression).
 * - Batas: gambar 1 MB, PDF 2 MB (bisa diubah lewat props).
 * - Progres, batalkan, dan error ukuran atau format.
 * Komponen ini hanya UI. Pemanggil memberi fungsi upload yang mengunggah ke backend.
 *
 * <FileUpload
 *   label="Foto KTP penanggung jawab"
 *   accept={["image/jpeg", "image/png", "application/pdf"]}
 *   hint="JPG, PNG, atau PDF. Gambar maksimal 1 MB, PDF maksimal 2 MB."
 *   value={ktp} onChange={setKtp}
 *   upload={(file, { onProgress, signal }) => applicationsApi.uploadDocument(file, { onProgress, signal })}
 * />
 */

export type UploadedFile = { id: string; name: string; size: number; type: string; url?: string };

export type UploadFn = (file: File, opts: { onProgress: (percent: number) => void; signal: AbortSignal }) => Promise<UploadedFile>;

type FileUploadProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** MIME yang diterima. Bawaan: JPG, PNG, WEBP, dan PDF. */
  accept?: string[];
  maxImageBytes?: number;
  maxPdfBytes?: number;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  upload: UploadFn;
  disabled?: boolean;
  /** Pesan error dari form, misalnya "Unggah foto KTP". */
  error?: string;
  id?: string;
};

const MB = 1024 * 1024;
const DEFAULT_ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const LABEL: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
};

/** 820 KB, 2,4 MB */
export function formatBytes(bytes: number) {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MB).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

const extension = (name: string) => name.split(".").pop()?.toUpperCase() ?? "";

const formatList = (types: string[]) => {
  const names = [...new Set(types.map((t) => LABEL[t] ?? t))];
  return names.length > 1 ? `${names.slice(0, -1).join(", ")}, atau ${names[names.length - 1]}` : names[0];
};

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; name: string; percent: number }
  | { kind: "error"; name: string; message: string };

/** Baris berkas: ikon, nama, keterangan, dan aksi di kanan. Dipakai juga di tampilan admin (pita 21). */
export function FileRow({
  name,
  note,
  tone = "neutral",
  progress,
  isPdf,
  action,
  className,
}: {
  name: string;
  note?: ReactNode;
  tone?: "neutral" | "danger";
  progress?: number;
  isPdf?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = isPdf ? FileText : FileImage;
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border-strong px-3.5 py-3", className)}>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          tone === "danger" ? "bg-danger-tint text-danger" : "bg-surface-2 text-foreground",
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-sm font-bold">{name}</span>
        {progress !== undefined ? (
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span className="block h-full rounded-full bg-foreground transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </span>
        ) : (
          note && <span className={cn("text-[13px] font-medium", tone === "danger" ? "text-danger-ink" : "text-text-secondary")}>{note}</span>
        )}
      </span>
      {action}
    </div>
  );
}

export function FileUpload({
  label,
  hint,
  accept = DEFAULT_ACCEPT,
  maxImageBytes = 1 * MB,
  maxPdfBytes = 2 * MB,
  value,
  onChange,
  upload,
  disabled,
  error,
  id,
}: FileUploadProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  const start = async (raw: File) => {
    const isPdf = raw.type === "application/pdf";
    if (!accept.includes(raw.type)) {
      const ext = extension(raw.name) || "ini";
      setStatus({ kind: "error", name: raw.name, message: `Format ${ext} belum didukung. Gunakan ${formatList(accept)}.` });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: "uploading", name: raw.name, percent: 0 });

    let file = raw;
    // Gambar dikompres dulu, supaya foto dari kamera ponsel tetap masuk batas 1 MB.
    if (!isPdf && raw.size > maxImageBytes) {
      try {
        const blob = await imageCompression(raw, {
          maxSizeMB: (maxImageBytes / MB) * 0.95,
          maxWidthOrHeight: 2400,
          useWebWorker: true,
          signal: controller.signal,
          onProgress: (p) => setStatus({ kind: "uploading", name: raw.name, percent: Math.round(p * 0.3) }),
        });
        file = new File([blob], raw.name, { type: blob.type || raw.type });
      } catch {
        if (controller.signal.aborted) return;
      }
    }

    const limit = isPdf ? maxPdfBytes : maxImageBytes;
    if (file.size > limit) {
      setStatus({ kind: "error", name: raw.name, message: `Ukuran berkas ${formatBytes(raw.size)}. Maksimal ${formatBytes(limit)}.` });
      return;
    }

    try {
      const done = await upload(file, {
        signal: controller.signal,
        onProgress: (p) => setStatus({ kind: "uploading", name: raw.name, percent: isPdf ? p : 30 + Math.round(p * 0.7) }),
      });
      setStatus({ kind: "idle" });
      onChange(done);
    } catch {
      if (controller.signal.aborted) return;
      setStatus({ kind: "error", name: raw.name, message: "Berkas gagal diunggah. Periksa koneksi Anda, lalu coba lagi." });
    }
  };

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) start(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus({ kind: "idle" });
  };

  const removeButton = (onClick: () => void, labelText: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={labelText}
      className="press flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary [@media(hover:hover)]:hover:bg-surface"
    >
      <X className="size-[18px]" aria-hidden />
    </button>
  );

  let content: ReactNode;
  if (status.kind === "uploading") {
    content = <FileRow name={status.name} progress={status.percent} isPdf={status.name.toLowerCase().endsWith(".pdf")} action={removeButton(cancel, "Batalkan unggahan")} />;
  } else if (status.kind === "error") {
    content = (
      <FileRow
        name={status.name}
        tone="danger"
        note={status.message}
        action={removeButton(() => setStatus({ kind: "idle" }), "Hapus berkas")}
      />
    );
  } else if (value) {
    content = (
      <FileRow
        name={value.name}
        note={`${formatBytes(value.size)}, terunggah`}
        isPdf={value.type === "application/pdf"}
        action={!disabled && removeButton(() => onChange(null), "Hapus berkas")}
      />
    );
  } else {
    content = (
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-foreground bg-primary-tint" : error ? "border-danger bg-surface" : "border-border-strong bg-surface [@media(hover:hover)]:hover:border-foreground",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="size-5" aria-hidden />
        <span className="text-sm font-bold">Seret berkas ke sini atau pilih berkas</span>
        {hint && <span className="text-[13px] font-medium text-text-tertiary">{hint}</span>}
      </label>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <span className="text-sm font-semibold" id={`${inputId}-label`}>
        {label}
      </span>
      {content}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept.join(",")}
        disabled={disabled}
        aria-labelledby={`${inputId}-label`}
        onChange={(e) => pick(e.target.files)}
        className="sr-only"
      />
      {error && status.kind === "idle" && <p className="text-[13px] text-danger-ink" role="alert">{error}</p>}
    </div>
  );
}
