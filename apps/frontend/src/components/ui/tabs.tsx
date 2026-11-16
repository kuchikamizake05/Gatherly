"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Tab bergaris bawah sesuai komponen Tab di desain. Tanpa garis abu-abu panjang di bawah grup.
 * Angka opsional: <TabsTrigger value="berjalan" count={4}>Berjalan</TabsTrigger>
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex max-w-full items-center gap-6 overflow-x-auto [scrollbar-width:none]", className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  count,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "group inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent py-3 text-base font-semibold text-text-secondary",
        "data-[state=active]:border-foreground data-[state=active]:font-extrabold data-[state=active]:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-surface-2 px-2 text-xs font-bold text-text-secondary group-data-[state=active]:bg-inverse group-data-[state=active]:text-inverse-foreground">
          {count}
        </span>
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
