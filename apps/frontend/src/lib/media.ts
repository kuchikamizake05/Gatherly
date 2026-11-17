/**
 * Snapshot acara di pesanan dan tiket menyimpan poster sebagai id aset, bukan URL.
 * Ubah menjadi URL media backend. Nilai yang sudah berupa URL dikembalikan apa adanya.
 */
export function mediaUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^(https?:)?\/\//.test(value) || value.startsWith("/")) return value;
  return `/api/v1/media/${encodeURIComponent(value)}`;
}
