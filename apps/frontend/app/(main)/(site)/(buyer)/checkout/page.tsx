"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useEvent } from "@/modules/events/hooks";
import { useCreateOrder } from "@/modules/orders/hooks";

function PageContent() {
  const search = useSearchParams();
  // Dibuka dari tombol Beli tiket: /checkout?event=<slug>&ticket=<ticketTypeId>&qty=<n>
  const event = useEvent(search.get("event") ?? "");
  const createOrder = useCreateOrder();
  void createOrder; // Panggil saat Lanjut ke pembayaran. Pakai crypto.randomUUID() sebagai Idempotency-Key.
  return <RouteStub title="Data peserta" band="05" scenario="A1. Data peserta" queries={{ event: event }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
