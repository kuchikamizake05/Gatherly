import { Suspense } from "react";

import { CheckoutAttendees } from "@/modules/orders/components/CheckoutAttendees";

/** Data peserta. Pita 05 A1. /checkout?event=<slug>&ticket=<id>&qty=<n> */
export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutAttendees />
    </Suspense>
  );
}
