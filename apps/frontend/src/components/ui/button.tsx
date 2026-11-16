import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Sesuai komponen Button/* di pita 02 Design system. */
const buttonVariants = cva(
  "press inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-button font-bold transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-danger/30 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground [@media(hover:hover)]:hover:bg-primary-hover",
        secondary: "bg-inverse text-inverse-foreground [@media(hover:hover)]:hover:bg-neutral-800",
        outline:
          "border border-border-strong bg-background text-foreground [@media(hover:hover)]:hover:bg-surface",
        ghost: "bg-transparent text-foreground [@media(hover:hover)]:hover:bg-surface-2",
        danger: "bg-danger-tint text-danger-ink [@media(hover:hover)]:hover:brightness-95",
        dangerSolid: "bg-danger text-white [@media(hover:hover)]:hover:bg-red-700",
        link: "h-auto rounded-none px-0 text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline",
      },
      size: {
        default: "h-11 px-[18px] text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        sm: "h-9 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11 border border-border-strong bg-background [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-9 border border-border-strong bg-background [&_svg:not([class*='size-'])]:size-4",
      },
      block: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Spinner di dalam tombol, tombol dikunci. Isi label dengan teks proses, misalnya "Menyimpan". */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
