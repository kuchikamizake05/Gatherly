export type ScanOutcome =
  | "valid"
  | "used"
  | "invalid"
  | "wrong_event"
  | "cancelled"
  | "closed"
  | "forbidden"
  | "network"
  | "queued";
export type ScanFeedback = {
  kind: ScanOutcome;
  title: string;
  description: string;
  attendee?: string;
};
export function scanError(error: {
  code?: string;
  details?: Record<string, unknown>;
}): ScanFeedback {
  switch (error.code) {
    case "TICKET_ALREADY_USED":
      return {
        kind: "used",
        title: "Tiket sudah digunakan",
        description: error.details?.checkedInAt
          ? `Tercatat masuk ${new Date(String(error.details.checkedInAt)).toLocaleString("id-ID")}.`
          : "Tiket ini sudah tercatat masuk sebelumnya.",
      };
    case "WRONG_EVENT":
      return {
        kind: "wrong_event",
        title: "Tiket untuk acara lain",
        description: "Minta peserta membuka e-tiket untuk acara ini.",
      };
    case "TICKET_CANCELLED":
      return {
        kind: "cancelled",
        title: "Tiket dibatalkan",
        description:
          "Tiket ini tidak dapat digunakan. Periksa pesanan bersama organizer.",
      };
    case "CHECKIN_CLOSED":
      return {
        kind: "closed",
        title: "Pemindaian belum tersedia",
        description: "Periksa waktu pembukaan dan penutupan pemindaian acara.",
      };
    case "FORBIDDEN":
    case "UNAUTHENTICATED":
      return {
        kind: "forbidden",
        title: "Akses pemindaian dicabut",
        description: "Hubungi organizer untuk memeriksa penugasan Anda.",
      };
    case "INVALID_TICKET":
      return {
        kind: "invalid",
        title: "Kode tiket tidak dikenali",
        description: "Minta peserta membuka e-tiket dari Tiketku atau email.",
      };
    default:
      return {
        kind: "network",
        title: "Status tiket belum diketahui",
        description:
          "Koneksi atau layanan bermasalah. Coba pindai lagi untuk memastikan status tiket.",
      };
  }
}
