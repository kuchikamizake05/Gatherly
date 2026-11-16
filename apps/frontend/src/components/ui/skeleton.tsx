import { cn } from "@/lib/utils";

/** Kerangka shimmer. Bentuknya mengikuti konten asli supaya tata letak tidak melompat. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
