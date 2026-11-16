import * as React from "react";

import { cn } from "@/lib/utils";

/** Kotak input sesuai komponen Input di desain: tinggi 48, radius md, garis border-strong. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full min-w-0 rounded-md border border-border-strong bg-background px-3.5 text-[15px] text-foreground transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-text-tertiary",
        "focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-tertiary",
        "aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger",
        "file:border-0 file:bg-transparent file:text-sm file:font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
