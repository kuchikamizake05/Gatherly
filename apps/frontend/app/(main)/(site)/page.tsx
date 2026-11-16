import { RouteStub } from "@/components/elements/route-stub";
import { eventsApi } from "@/modules/events/api";

/** Data katalog diperbarui tiap 60 detik. */
export const revalidate = 60;

/** Beranda dan jelajahi. Server Component supaya cepat dan terindeks. */
export default async function HomePage() {
  const events = await eventsApi.list({ sort: "date_asc", limit: 12 });
  return <RouteStub title="Jelajahi acara" band="03" scenario="A. Layar utama" pendingIssue="#3 B10" data={{ events }} />;
}
