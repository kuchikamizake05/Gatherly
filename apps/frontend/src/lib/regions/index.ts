"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Provinsi dan kabupaten/kota di Indonesia untuk isian alamat (pita 13 dan 16).
 * Sumber: Kepmendagri No 300.2.2-2430 Tahun 2025, via github.com/cahyadsn/wilayah (MIT),
 * disalin dari proyek waybil. 38 provinsi, 514 kabupaten dan kota, tanpa kecamatan.
 *
 * Data dimuat terpisah (dynamic import) saat form dibuka, jadi halaman lain tidak ikut berat.
 * Nilai yang disimpan adalah nama resmi. Untuk tampilan provinsi pakai shortProvince().
 */

export type Province = { id: string; name: string };
type RegionData = { source: string; provinces: Province[]; regencies: Record<string, string[]> };

export function useRegionData() {
  return useQuery({
    queryKey: ["regions", "id"] as const,
    queryFn: async () => (await import("./indonesia.json")).default as RegionData,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Kabupaten dan kota untuk provinsi tertentu (berdasarkan nama resmi provinsi). */
export function useRegions(province?: string) {
  const query = useRegionData();
  const provinces = query.data?.provinces ?? [];
  const id = provinces.find((p) => p.name === province)?.id;
  return {
    provinces,
    regencies: (id && query.data?.regencies[id]) || [],
    loading: query.isPending,
    failed: query.isError,
  };
}

const SHORT: Record<string, string> = {
  "Daerah Khusus Ibukota Jakarta": "DKI Jakarta",
  "Daerah Istimewa Yogyakarta": "DI Yogyakarta",
};

/** Nama provinsi seperti yang biasa ditulis orang, sesuai desain ("DI Yogyakarta"). */
export const shortProvince = (name: string) => SHORT[name] ?? name;
