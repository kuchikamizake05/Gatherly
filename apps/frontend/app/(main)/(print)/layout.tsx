import type { ReactNode } from "react";

import { RequireBuyer } from "@/components/layout/Guards";

/** Halaman cetak (PDF e-tiket dan bukti pembayaran). Tanpa navbar dan footer, butuh login peserta. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <RequireBuyer>{children}</RequireBuyer>;
}
