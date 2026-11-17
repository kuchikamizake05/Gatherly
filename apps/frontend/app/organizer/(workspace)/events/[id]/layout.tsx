import type { ReactNode } from "react";
import { ManageEventTabs } from "@/modules/organizer-events/components/ManageEventTabs";

/**
 * Kelola acara. Tab: Ringkasan, Pesanan, Peserta, Tiket, Panitia (pita 17).
 * TODO: kepala halaman (judul acara, tombol Lihat halaman, Ubah acara, menu titik tiga) dan tab bergaris bawah.
 */
export default function ManageEventLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ManageEventTabs>{children}</ManageEventTabs>;
}
