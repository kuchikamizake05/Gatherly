"use client";

import { RouteStub } from "@/components/elements/RouteStub";
import { useCreateEvent } from "@/modules/organizer-events/hooks";

export default function Page() {
  // Lima langkah: info, waktu dan tempat, tiket, detail, tinjau dan terbitkan. Draf tersimpan otomatis.
  const create = useCreateEvent();
  return <RouteStub title="Buat acara" band="16" scenario="A. Membuat acara" queries={{ create: { status: create.status, data: create.data } }} />;
}
