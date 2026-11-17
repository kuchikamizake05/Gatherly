import { cookies } from "next/headers";

import { CITY_COOKIE } from "@/modules/events/city";

import { eventsApi } from "@/modules/events/api";
import { HomeView } from "@/modules/events/components/HomeView";

/** Beranda dan Jelajahi. Pita 03. Dirender di server supaya cepat dan terindeks. */
export default async function HomePage() {
  // Cookie diteruskan supaya status "disimpan" di kartu sesuai akun yang sedang masuk.
  const jar = await cookies();
  const cookie = jar.toString() || undefined;
  // Kota pilihan pembeli (lihat modules/events/city.ts). Kosong berarti semua kota.
  const city = jar.get(CITY_COOKIE)?.value || undefined;
  const [featured, thisWeek, affordable] = await Promise.all([
    eventsApi.list({ city, sort: "date_asc", limit: 7 }, cookie),
    eventsApi.list({ city, date: "week", sort: "date_asc", limit: 4 }, cookie),
    eventsApi.list({ city, maxPrice: 50000, sort: "price_asc", limit: 4 }, cookie),
  ]);
  return <HomeView city={city} featured={featured.data} thisWeek={thisWeek.data} affordable={affordable.data} />;
}
