import { cookies } from "next/headers";

import { eventsApi } from "@/modules/events/api";
import { HomeView } from "@/modules/events/components/HomeView";

/** Beranda dan Jelajahi. Pita 03. Dirender di server supaya cepat dan terindeks. */
export default async function HomePage() {
  // Cookie diteruskan supaya status "disimpan" di kartu sesuai akun yang sedang masuk.
  const cookie = (await cookies()).toString() || undefined;
  const [featured, thisWeek, affordable] = await Promise.all([
    eventsApi.list({ sort: "date_asc", limit: 7 }, cookie),
    eventsApi.list({ date: "week", sort: "date_asc", limit: 4 }, cookie),
    eventsApi.list({ maxPrice: 50000, sort: "price_asc", limit: 4 }, cookie),
  ]);
  return <HomeView featured={featured.data} thisWeek={thisWeek.data} affordable={affordable.data} />;
}
