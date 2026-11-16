import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full rounded-md border border-border-strong bg-background px-3.5 py-3 text-[15px] leading-relaxed transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-text-tertiary focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:bg-surface-2 aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
