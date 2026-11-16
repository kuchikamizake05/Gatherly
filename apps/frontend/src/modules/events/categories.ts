/**
 * Kategori acara di Jelajahi (pita 03). Slug dipakai di URL: /events?category=musik.
 * Harus sama dengan daftar kategori di backend.
 */
export const CATEGORIES = [
  { slug: "musik", name: "Musik" },
  { slug: "lokakarya", name: "Lokakarya" },
  { slug: "olahraga", name: "Olahraga" },
  { slug: "seni-budaya", name: "Seni & Budaya" },
  { slug: "teknologi", name: "Teknologi" },
  { slug: "kuliner", name: "Kuliner" },
  { slug: "komunitas", name: "Komunitas" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const categoryName = (slug?: string | null) => CATEGORIES.find((c) => c.slug === slug)?.name;

/** "Seni & Budaya" -> "seni-budaya" */
export const categorySlug = (name: string) =>
  CATEGORIES.find((c) => c.name === name)?.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Pilihan waktu di filter. week dipakai chip "Minggu ini". */
export const DATE_OPTIONS = [
  { value: "today", label: "Hari ini" },
  { value: "tomorrow", label: "Besok" },
  { value: "weekend", label: "Akhir pekan" },
  { value: "week", label: "Minggu ini" },
] as const;

export type DateFilter = (typeof DATE_OPTIONS)[number]["value"];

export const dateLabel = (value?: string | null) => DATE_OPTIONS.find((d) => d.value === value)?.label;
