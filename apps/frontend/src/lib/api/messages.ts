/**
 * Pesan error backend (bahasa Inggris) menjadi bahasa Indonesia sebelum sampai ke layar.
 * Urutan: pesan persis, lalu kode error, lalu pesan umum menurut status HTTP (di client.ts).
 * Pesan baru dari backend yang belum terdaftar otomatis jatuh ke pesan per kode atau per status,
 * jadi bahasa Inggris tidak pernah tampil ke pengguna.
 */

/** Pesan persis dari backend. Dipakai bila satu kode punya beberapa arti. */
const BY_MESSAGE: Record<string, string> = {
  // Masuk dan sesi
  "Email or password is incorrect.": "Email atau password tidak sesuai.",
  "Username or password is incorrect.": "Username atau password tidak sesuai.",
  "Google email is not verified.": "Email Google Anda belum terverifikasi.",
  "Session expired.": "Sesi Anda telah berakhir. Silakan masuk kembali.",
  "Authentication is required.": "Silakan masuk terlebih dahulu.",
  "Admin authentication is required.":
    "Silakan masuk sebagai admin terlebih dahulu.",
  "Workspace authentication is required.":
    "Silakan masuk ke ruang kerja terlebih dahulu.",
  "Verification challenge is invalid.":
    "Sesi verifikasi tidak berlaku. Masuk kembali untuk memulai lagi.",
  "Open the correction form again.":
    "Sesi perbaikan berakhir. Buka kembali formulir perbaikan.",
  "Authentication is unavailable.":
    "Layanan masuk sedang tidak tersedia. Coba lagi beberapa saat lagi.",
  "Google login is unavailable.": "Masuk dengan Google sedang tidak tersedia.",
  "Login could not be completed.": "Proses masuk belum berhasil. Coba lagi.",
  "Registration could not be completed.":
    "Pendaftaran belum berhasil. Coba lagi.",
  "Please wait before requesting another code.":
    "Tunggu sebentar sebelum meminta kode baru.",

  // Akses
  "An organizer profile is required.": "Fitur ini khusus untuk organizer.",
  "Committee access is required.":
    "Anda tidak ditugaskan sebagai panitia untuk acara ini.",
  "Organizer access is required.":
    "Fitur ini khusus untuk pemilik akun organizer.",
  "Document is not owned by this upload session.":
    "Dokumen ini bukan dari unggahan Anda. Unggah ulang dokumennya.",
  "Request origin is not allowed.":
    "Permintaan dari alamat ini tidak diizinkan.",

  // Data tidak ditemukan
  "Application not found.": "Pengajuan tidak ditemukan.",
  "Application was not found.": "Pengajuan tidak ditemukan.",
  "Committee assignment not found.": "Penugasan panitia tidak ditemukan.",
  "Document not found.": "Dokumen tidak ditemukan.",
  "Event not found.": "Acara tidak ditemukan.",
  "Event was not found.": "Acara tidak ditemukan.",
  "Media not found.": "Gambar tidak ditemukan.",
  "Member not found.": "Anggota tim tidak ditemukan.",
  "Order not found.": "Pesanan tidak ditemukan.",
  "Organizer not found.": "Organizer tidak ditemukan.",
  "Organizer profile not found.": "Profil organizer tidak ditemukan.",
  "Organizer was not found.": "Organizer tidak ditemukan.",
  "Payout not found.": "Pencairan tidak ditemukan.",
  "Record not found.": "Data tidak ditemukan.",
  "Refund not found.": "Pengembalian dana tidak ditemukan.",
  "Report was not found.": "Laporan tidak ditemukan.",
  "Resource not found.": "Data tidak ditemukan.",
  "Ticket not found.": "Tiket tidak ditemukan.",
  "Ticket type not found.": "Jenis tiket tidak ditemukan.",

  // Konflik umum
  "A poster and at least one ticket type are required.":
    "Tambahkan poster dan minimal satu jenis tiket sebelum menerbitkan.",
  "Account changed. Please try again.":
    "Data akun baru saja berubah. Coba lagi.",
  "Capacity cannot be below sold or reserved tickets.":
    "Kuota tidak boleh lebih kecil dari tiket yang sudah terjual atau sedang ditahan.",
  "Only draft events can be deleted.":
    "Hanya acara berstatus draf yang bisa dihapus.",
  "Password has already been changed.": "Password sudah diganti sebelumnya.",
  "The event changed. Please try again.":
    "Data acara baru saja berubah. Muat ulang lalu coba lagi.",

  // Validasi
  "A valid Idempotency-Key is required.":
    "Permintaan tidak lengkap. Muat ulang halaman lalu coba lagi.",
  "Challenge ID is invalid.":
    "Sesi verifikasi tidak berlaku. Masuk kembali untuk memulai lagi.",
  "Check-in must open before closing and close no later than event end.":
    "Waktu buka check-in harus sebelum waktu tutup, dan waktu tutup tidak boleh melewati akhir acara.",
  "Choose a JPG, PNG, or WebP image no larger than 1 MB.":
    "Pilih gambar JPG, PNG, atau WebP maksimal 1 MB.",
  "Invalid event timezone.": "Zona waktu acara tidak valid.",
  "Invalid ticket sales period.": "Periode penjualan tiket tidak valid.",
  "Please check event filters.": "Periksa kembali filter acara.",
  "Please check the submitted fields.": "Periksa kembali isian Anda.",
  "Select committee accounts by memberIds.":
    "Pilih akun panitia yang akan ditugaskan.",
  "The event must start in the future.":
    "Waktu mulai acara harus di masa depan.",
  "Transfer date cannot precede the payout request.":
    "Tanggal transfer tidak boleh sebelum tanggal pengajuan pencairan.",
  "Type hapus akun to confirm account deletion.":
    "Ketik hapus akun untuk mengonfirmasi penghapusan akun.",
  "endsAt must be after startsAt": "Waktu selesai harus setelah waktu mulai.",

  // Layanan tidak tersedia
  "Check-in could not be completed.":
    "Check-in belum berhasil. Coba pindai lagi.",
  "Notification processing is unavailable.":
    "Pemrosesan notifikasi sedang tidak tersedia.",
  "The reservation could not be completed.":
    "Tiket belum berhasil ditahan. Coba lagi.",

  // Kode dengan beberapa arti
  "Cancellation is being verified. The reservation is still held.":
    "Pembatalan sedang diverifikasi. Tiket Anda masih ditahan.",
  "Cancellation is not confirmed by the provider.":
    "Pembatalan belum dikonfirmasi penyedia pembayaran. Coba lagi beberapa saat lagi.",
  "Cancelled events cannot be changed.":
    "Acara yang dibatalkan tidak bisa diubah.",
  "Cancelled events cannot be republished.":
    "Acara yang dibatalkan tidak bisa diterbitkan ulang.",
  "The event cancellation refund is handled separately.":
    "Pengembalian dana untuk acara yang dibatalkan diproses terpisah.",
  "Correction deadline has passed.": "Batas waktu perbaikan sudah lewat.",
  "Correction session is unavailable.":
    "Sesi perbaikan tidak tersedia. Buka kembali formulir perbaikan.",
  "Events with orders cannot be deleted.":
    "Acara yang sudah punya pesanan tidak bisa dihapus.",
  "Ticket type already has orders.": "Jenis tiket ini sudah punya pesanan.",
  "Document does not belong to this submission or exceeds its limits.":
    "Dokumen tidak sesuai atau melebihi batas ukuran.",
  "Document is invalid.": "Dokumen tidak valid.",
  "Unsupported document type or size.":
    "Jenis atau ukuran dokumen tidak didukung.",
  "Only valid JPEG, PNG, WebP or PDF files are supported.":
    "Hanya file JPEG, PNG, WebP, atau PDF yang didukung.",
  "Select a poster image.": "Pilih gambar poster.",
  "A selected ticket is no longer refundable.":
    "Salah satu tiket yang dipilih sudah tidak bisa dikembalikan.",
  "Select unused tickets belonging to this order.":
    "Pilih tiket yang belum dipakai dari pesanan ini.",
  "Free tickets have no refundable payment.":
    "Tiket gratis tidak memiliki dana yang bisa dikembalikan.",
  "Only issued paid orders can be refunded.":
    "Hanya pesanan yang sudah dibayar yang bisa dikembalikan dananya.",
  "Verification challenge is unavailable.":
    "Sesi verifikasi tidak tersedia. Minta kode baru.",
  "Verification code was already used.":
    "Kode verifikasi sudah dipakai. Minta kode baru.",
  "A payout is already requested for this event.":
    "Pencairan untuk acara ini sudah diajukan.",
  "Cancellation needs reconciliation because a payout already exists.":
    "Pembatalan perlu dicek admin karena pencairan sudah diajukan.",
  "Payout already requested.": "Pencairan sudah diajukan.",
  "This event already has a payout request.":
    "Pencairan untuk acara ini sudah diajukan.",
  "Approved refunds must finish before a payout.":
    "Selesaikan pengembalian dana yang sudah disetujui sebelum mencairkan dana.",
  "Refunds are still processing.": "Pengembalian dana masih diproses.",
  "Application changed. Reload before retrying.":
    "Pengajuan baru saja berubah. Muat ulang halaman lalu coba lagi.",
  "Application is no longer awaiting review.":
    "Pengajuan ini sudah tidak menunggu peninjauan.",
  "Application was reviewed by another admin.":
    "Pengajuan sudah ditinjau admin lain.",
  "Organizer sales are suspended.":
    "Penjualan tiket organizer ini sedang dihentikan.",
  "This ticket type is not currently on sale.":
    "Jenis tiket ini sedang tidak dijual.",
  "Ticket sales are closed.": "Penjualan tiket sudah ditutup.",
  "Username is already used.": "Username sudah dipakai.",
  "Username is unavailable.": "Username tidak tersedia.",
};

/** Pesan per kode, bila pesan persisnya belum terdaftar. */
const BY_CODE: Record<string, string> = {
  ACCOUNT_HAS_ACTIVE_TICKETS:
    "Akun masih punya tiket atau pesanan untuk acara yang akan datang.",
  ACCOUNT_IS_ORGANIZER: "Akun organizer hanya bisa dihapus oleh tim Gatherlyy.",
  ACCOUNT_LOCKED:
    "Akun dikunci sementara karena terlalu banyak percobaan. Coba lagi nanti.",
  ADMIN_EXISTS: "Akun admin sudah ada.",
  ADMIN_UNAVAILABLE: "Layanan admin sedang tidak tersedia.",
  ALREADY_LOGGED_IN: "Organizer sudah pernah masuk.",
  ALREADY_ORGANIZER: "Akun organizer sudah ada.",
  ALREADY_PAID: "Pembayaran sudah berhasil.",
  ALREADY_REVIEWED: "Pengajuan pengembalian dana ini sudah ditinjau.",
  ALREADY_TRANSFERRED: "Pencairan ini sudah ditransfer.",
  APPLICATION_EXISTS: "Masih ada pengajuan organizer yang aktif.",
  APPLICATION_REQUIRED:
    "Kirim pengajuan organizer terlebih dahulu untuk ditinjau admin.",
  BANK_REQUIRED: "Simpan rekening bank sebelum mengajukan pencairan.",
  CANCELLATION_EXISTS: "Pembatalan sudah diajukan.",
  CANCELLATION_PENDING: "Pembatalan sedang diproses.",
  CHALLENGE_INVALID:
    "Sesi verifikasi berakhir. Masuk kembali untuk memulai lagi.",
  CHALLENGE_USED:
    "Sesi verifikasi sudah dipakai. Masuk kembali untuk memulai lagi.",
  CHECKIN_CLOSED: "Check-in untuk acara ini sedang ditutup.",
  CODE_INVALID: "Kode tidak sesuai. Periksa kode lalu coba lagi.",
  CONFIRMATION_MISMATCH: "Judul acara yang diketik tidak sama.",
  CONFLICT: "Data baru saja berubah. Muat ulang lalu coba lagi.",
  CSRF_INVALID: "Sesi keamanan berakhir. Muat ulang halaman lalu coba lagi.",
  DOCUMENT_CLAIMED:
    "Dokumen ini sudah dipakai di pengajuan lain. Unggah ulang dokumennya.",
  EMAIL_ALREADY_EXISTS: "Email ini sudah terdaftar. Silakan masuk.",
  EMAIL_NOT_VERIFIED:
    "Email penanggung jawab harus diverifikasi sebelum pengajuan disetujui.",
  EMAIL_UNAVAILABLE:
    "Pengiriman email sedang tidak tersedia. Coba lagi beberapa saat lagi.",
  EVENT_CANCELLED: "Acara ini sudah dibatalkan.",
  EVENT_ENDED: "Acara yang sudah selesai tidak bisa dibatalkan.",
  FIELD_NOT_FLAGGED:
    "Hanya bagian yang ditandai tim Gatherlyy yang bisa diubah.",
  FILE_REQUIRED: "Pilih dokumen terlebih dahulu.",
  FILE_TOO_LARGE:
    "Ukuran file terlalu besar. Gambar maksimal 1 MB dan PDF maksimal 2 MB.",
  FIX_EXPIRED: "Batas waktu perbaikan sudah lewat.",
  FIX_INCOMPLETE: "Perbaiki semua bagian yang ditandai.",
  FLAGS_EXIST: "Selesaikan bagian yang ditandai sebelum menyetujui.",
  FORBIDDEN: "Anda tidak memiliki akses untuk tindakan ini.",
  HAS_ORDERS: "Data ini sudah punya pesanan sehingga tidak bisa dihapus.",
  IDEMPOTENCY_CONFLICT:
    "Permintaan ini sudah pernah dikirim dengan isi berbeda. Muat ulang halaman lalu coba lagi.",
  INSUFFICIENT_QUOTA: "Sisa tiket tidak cukup untuk jumlah yang diminta.",
  INVALID_ASSET: "Pilih gambar yang diunggah dari akun organizer ini.",
  INVALID_DOCUMENT: "Dokumen tidak valid.",
  INVALID_EVENTS: "Pilih acara milik organizer ini.",
  INVALID_FILE_TYPE: "Jenis file tidak didukung.",
  INVALID_ID: "ID tidak valid.",
  INVALID_IMAGE: "Logo harus berupa gambar maksimal 1 MB.",
  INVALID_MEMBERS: "Pilih akun panitia aktif milik organizer ini.",
  INVALID_NOTIFICATION: "Notifikasi pembayaran tidak valid.",
  INVALID_PASSWORD: "Password saat ini salah.",
  INVALID_PAYMENT_METHOD: "Metode pembayaran tidak didukung.",
  INVALID_STATE: "Pengembalian dana ini belum disetujui.",
  INVALID_TICKET: "Tiket tidak valid.",
  INVALID_TICKETS:
    "Pilihan tiket tidak sesuai. Muat ulang halaman lalu coba lagi.",
  LEGAL_REQUIRED: "Dokumen legalitas wajib diunggah.",
  MEMBER_LIMIT: "Jumlah anggota tim sudah mencapai batas.",
  NOT_CANCELLABLE:
    "Hanya pesanan yang menunggu pembayaran yang bisa dibatalkan.",
  NOT_FOUND: "Data tidak ditemukan.",
  NOT_MANUAL:
    "Hanya pengembalian dana manual yang bisa ditandai sudah ditransfer.",
  NOT_NEEDS_FIX: "Pengajuan ini tidak sedang menunggu perbaikan.",
  NOT_REFUNDABLE: "Pesanan ini tidak bisa dikembalikan dananya.",
  NOT_REQUESTED: "Tidak ada pembatalan yang menunggu peninjauan.",
  NO_BALANCE: "Tidak ada saldo yang bisa dicairkan.",
  ORDER_NOT_PAYABLE: "Pesanan ini sudah tidak bisa dibayar.",
  ORGANIZER_FROZEN:
    "Akun organizer sedang dibekukan, jadi perubahan tidak bisa disimpan.",
  OTP_ALREADY_USED: "Kode verifikasi sudah dipakai. Minta kode baru.",
  OTP_EXPIRED: "Kode verifikasi sudah kedaluwarsa. Minta kode baru.",
  OTP_INVALID: "Kode verifikasi salah.",
  OTP_LOCKED: "Terlalu banyak percobaan kode. Minta kode baru.",
  PASSWORD_CHANGE_REQUIRED: "Ganti password sementara terlebih dahulu.",
  PASSWORD_LOCKED: "Tunggu sebentar sebelum mengganti password lagi.",
  PASSWORD_REQUIRED:
    "Buat password terlebih dahulu sebelum melepas akun Google.",
  PASSWORD_REUSED: "Gunakan password yang berbeda dari sebelumnya.",
  PAYMENT_CHANGED: "Status pembayaran baru saja berubah. Coba lagi.",
  PAYMENT_METHOD_LOCKED:
    "Lanjutkan pembayaran dengan metode yang sudah dipilih sebelumnya.",
  PAYOUT_EXISTS: "Pencairan sudah diajukan.",
  PAYOUT_UNAVAILABLE: "Pencairan hanya bisa diajukan setelah acara selesai.",
  PROVIDER_REJECTED:
    "Penyedia pembayaran menolak permintaan. Coba metode lain.",
  PROVIDER_UNAVAILABLE:
    "Penyedia pembayaran sedang tidak tersedia. Coba lagi beberapa saat lagi.",
  RATE_LIMITED: "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.",
  REAPPLICATION_WAIT:
    "Pengajuan baru bisa dikirim 30 hari setelah pengajuan sebelumnya ditolak.",
  RECONCILIATION_REQUIRED: "Kuota tiket perlu dicek ulang oleh tim Gatherlyy.",
  REFUNDS_PENDING: "Masih ada pengembalian dana yang diproses.",
  REFUND_DEADLINE:
    "Batas pengajuan pengembalian dana sudah lewat (satu bulan sebelum acara).",
  REFUND_EXISTS: "Pengajuan pengembalian dana sedang ditinjau atau diproses.",
  REFUND_OVERFLOW: "Jumlah pengembalian melebihi pembayaran.",
  REPORT_ALREADY_CLOSED: "Laporan ini sudah ditinjau.",
  REPORT_EXISTS: "Laporan Anda untuk acara ini masih menunggu peninjauan.",
  RESEND_UNAVAILABLE:
    "E-tiket baru saja dikirim. Tunggu 1 menit sebelum mengirim ulang.",
  RESET_EXPIRED: "Tautan reset password tidak berlaku atau sudah kedaluwarsa.",
  REVIEW_CONFLICT:
    "Pengajuan baru saja berubah. Muat ulang halaman lalu coba lagi.",
  SALES_CLOSED: "Penjualan tiket sedang ditutup.",
  SERVICE_UNAVAILABLE:
    "Layanan sedang tidak tersedia. Coba lagi beberapa saat lagi.",
  SETUP_REQUIRED: "Aplikasi authenticator belum dipasang.",
  SOLD_OUT: "Tiket sudah habis.",
  STORAGE_UNAVAILABLE:
    "Penyimpanan file sedang tidak tersedia. Coba lagi beberapa saat lagi.",
  TEMPORARY_PASSWORD_EXPIRED:
    "Password sementara sudah kedaluwarsa. Minta tim Gatherlyy mengirim ulang akses.",
  TICKET_ALREADY_USED: "Tiket sudah digunakan.",
  TICKET_CANCELLED: "Tiket sudah dibatalkan.",
  TOKEN_INVALID: "Tautan reset password tidak berlaku atau sudah kedaluwarsa.",
  UNAUTHENTICATED: "Silakan masuk terlebih dahulu.",
  USERNAME_TAKEN: "Username sudah dipakai.",
  VALIDATION_ERROR: "Periksa kembali isian Anda.",
  VERIFICATION_EXPIRED:
    "Tautan verifikasi email tidak berlaku atau sudah kedaluwarsa.",
  WORKSPACE_EXISTS: "Akun atau username ruang kerja sudah ada.",
  WRONG_EVENT: "Tiket ini untuk acara lain.",
  WRONG_PASSWORD: "Password saat ini salah.",
};

/** Kata yang menandakan pesan berbahasa Inggris. Pesan yang sudah berbahasa Indonesia dibiarkan. */
const ENGLISH =
  /(the|is|are|was|were|must|cannot|not|already|required|invalid|please|unavailable|expired|incorrect|found|only|select|choose|before|after|this|your)/i;

/**
 * Pesan Indonesia untuk error backend. Urutan: pesan persis, pesan backend yang sudah berbahasa
 * Indonesia, pesan per kode. Undefined bila tidak dikenal, lalu client.ts memakai pesan per status.
 */
export function translateApiError(
  code: string,
  message: string | undefined,
): string | undefined {
  if (message && BY_MESSAGE[message]) return BY_MESSAGE[message];
  if (message && !ENGLISH.test(message)) return message;
  return BY_CODE[code];
}
