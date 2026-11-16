"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useCheckIn, useScanHistory } from "@/modules/check-in/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  // Kamera (qr-scanner) + cari manual. Hitungan hadir dari meta riwayat, polling 5 detik.
  const history = useScanHistory(id);
  const checkIn = useCheckIn(id);
  void checkIn;
  return <RouteStub title="Scan tiket" band="19" scenario="A sampai D. Pindai, hasil, cari manual" queries={{ history: history }} />;
}
