/**
 * Kode aksi audit dari backend (AuditLog.action) menjadi kalimat untuk Riwayat pengajuan dan
 * Log aktivitas organizer. Teks yang bukan kode (misalnya dari data contoh) dikembalikan apa adanya.
 */
const LABELS: Record<string, string> = {
  "application.documents.viewed": "Membuka dokumen pengajuan",
  "application.request_fix": "Meminta perbaikan pengajuan",
  "application.rejected": "Menolak pengajuan",
  "application.approved": "Menyetujui pengajuan",
  "organizer.status": "Mengubah status organizer",
  "organizer.frozen": "Membekukan organizer",
  "organizer.unfrozen": "Mengaktifkan kembali organizer",
  "organizer.access_resent": "Mengirim ulang akses masuk organizer",
};

export const auditLabel = (action: string) =>
  LABELS[action] ??
  (/^[a-z_]+(\.[a-z_]+)+$/.test(action) ? "Aktivitas lain" : action);

/** Gabungkan entri berurutan yang sama (aksi dan pelaku sama), misalnya membuka dokumen berkali-kali. */
export function collapseRepeats<T extends { action: string; by?: string }>(
  items: T[],
): T[] {
  return items.filter(
    (item, i) =>
      i === 0 ||
      item.action !== items[i - 1]!.action ||
      item.by !== items[i - 1]!.by,
  );
}
