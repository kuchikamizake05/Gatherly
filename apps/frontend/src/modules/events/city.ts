/**
 * Kota pilihan pembeli. Tersimpan di cookie supaya beranda (dirender di server) ikut menyesuaikan,
 * dan bisa ditimpa ?city= di URL supaya tautan hasil pencarian bisa dibagikan.
 * Tanpa pilihan berarti semua kota. Hook-nya ada di use-city.ts.
 */
export const CITY_COOKIE = "gatherly_city";
export const ALL_CITIES = "Semua kota";

/** "di Kota Yogyakarta", atau kosong bila semua kota. */
export const inCity = (city?: string) => (city ? ` di ${city}` : "");
