import type { ReactNode } from "react";

import { RequireBuyer } from "@/components/layout/Guards";

/** Semua halaman di grup ini butuh login peserta. */
export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <RequireBuyer>{children}</RequireBuyer>;
}
