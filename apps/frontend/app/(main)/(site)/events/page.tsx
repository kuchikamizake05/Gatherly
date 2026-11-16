import { Suspense } from "react";

import { EventSearchResults } from "@/modules/events/components/EventSearchResults";

/** Hasil pencarian, filter, dan kategori. Pita 03. Filter dibaca dari URL, jadi dibungkus Suspense. */
export default function EventsPage() {
  return (
    <Suspense>
      <EventSearchResults />
    </Suspense>
  );
}
