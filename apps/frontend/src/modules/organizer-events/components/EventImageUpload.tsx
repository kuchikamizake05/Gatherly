"use client";
import Image from "next/image";
import { FileUpload } from "@/components/elements/FileUpload";
import { organizerEventsApi } from "../api";

export function EventImageUpload({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (assetId: string, url: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {value && (
        <Image
          src={value}
          alt={label}
          width={360}
          height={240}
          unoptimized
          className="max-h-60 w-auto rounded-lg object-contain"
        />
      )}
      <FileUpload
        label={label}
        accept={["image/jpeg", "image/png", "image/webp"]}
        hint="JPG, PNG, atau WEBP maksimal 1 MB."
        disabled={disabled}
        value={
          value
            ? {
                id: value,
                name: label,
                type: "image/jpeg",
                size: 0,
                url: value,
              }
            : null
        }
        onChange={(file) => onChange(file?.id ?? "", file?.url ?? "")}
        upload={async (file, { onProgress, signal }) => {
          const result = await organizerEventsApi.uploadPoster(
            file,
            signal,
            onProgress,
          );
          if (signal.aborted) throw new Error("Unggahan dibatalkan.");
          onProgress(100);
          return {
            id: result.data.assetId,
            name: file.name,
            size: file.size,
            type: file.type,
            url: result.data.url,
          };
        }}
      />
    </div>
  );
}
