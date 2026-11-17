import * as React from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * Pembungkus label + kontrol + helper/error, sesuai komponen Input di desain.
 *
 * <Field label="Email" htmlFor="email" helper="E-tiket dikirim ke email ini" error={errors.email?.message}>
 *   <Input id="email" aria-invalid={!!errors.email} {...register("email")} />
 * </Field>
 */
type FieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  /** Elemen di kanan label, misalnya tautan "Lupa password?". */
  labelAside?: React.ReactNode;
  className?: string;
  reserveMessageSpace?: boolean;
  children: React.ReactNode;
};

function Field({
  label,
  htmlFor,
  helper,
  error,
  labelAside,
  className,
  children,
  reserveMessageSpace,
}: FieldProps) {
  const messageId = htmlFor ? `${htmlFor}-message` : undefined;
  return (
    <div
      data-slot="field"
      className={cn("flex w-full flex-col gap-1.5", className)}
    >
      {(label || labelAside) && (
        <div className="flex items-center justify-between gap-3">
          {label && <Label htmlFor={htmlFor}>{label}</Label>}
          {labelAside}
        </div>
      )}
      {children}
      <div className={reserveMessageSpace ? "min-h-5" : undefined}>
        {error ? (
          <p
            id={messageId}
            className="flex items-start gap-1.5 text-[13px] text-danger-ink"
            role="alert"
          >
            <CircleAlert
              className="mt-px size-4 shrink-0 text-danger"
              aria-hidden
            />
            {error}
          </p>
        ) : helper ? (
          <p id={messageId} className="text-[13px] text-text-tertiary">
            {helper}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { Field };
