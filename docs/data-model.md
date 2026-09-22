# Gatherly — Model data awal

Kontrak rancangan, belum schema yang diimplementasikan. MongoDB ObjectId diserialisasikan menjadi string `id` pada API. Uang integer rupiah, bukan float. Waktu disimpan UTC sebagai Date dan keluar sebagai ISO 8601; acara menyimpan zona IANA, default `Asia/Jakarta`.

## Koleksi

| Koleksi | Field utama | Relasi dan indeks |
| --- | --- | --- |
| users | name, emailNormalized, passwordHash, createdAt | unique emailNormalized |
| sessions | tokenHash, userId, csrfTokenHash, expiresAt | unique tokenHash; index userId; TTL expiresAt untuk cleanup saja |
| organizers | ownerId, name, description, contactEmail | unique ownerId; satu profil per akun pada MVP |
| events | organizerId, slug, title, description, category, posterAssetId, startsAt, endsAt, timezone, venueName, address, city, publicationStatus, salesClosed, checkoutVersion | unique slug; index organizerId; publicationStatus + startsAt + _id |
| posterAssets | ownerId, storageKey, url, mimeType, size, createdAt | unique storageKey; index ownerId; upload belum terpasang dibersihkan terjadwal |
| ticketTypes | eventId, name, description, price, capacity, reserved, sold, salesStartsAt, salesEndsAt | index eventId; available dihitung capacity - reserved - sold |
| orders | buyerId, eventId, ticketTypeId, quantity, attendees, unitPrice, totalAmount, currency, eventSnapshot, ticketTypeSnapshot, paymentStatus, reservationStatus, issuanceStatus, expiresAt, providerOrderId, paymentSessionState, snapToken, redirectUrl, idempotencyKey, requestHash, nextReconcileAt, leaseUntil, createdAt | unique buyerId + idempotencyKey; unique providerOrderId; index buyerId + createdAt; index paymentStatus + nextReconcileAt |
| tickets | orderId, eventId, buyerId, ticketTypeId, sequence, attendeeName, ticketCode, qrToken, checkInStatus, checkedInAt, checkedInBy | unique orderId + sequence; unique ticketCode; unique qrToken; index buyerId; eventId + checkInStatus |
| committeeAssignments | eventId, userId, assignedBy, checkInVersion, createdAt | unique eventId + userId; index userId; increment checkInVersion in check-in transaction to conflict with concurrent revocation |
| paymentEvents | providerOrderId, fingerprint, normalizedStatus, processingStatus, receivedAt, processedAt, errorCode | unique fingerprint; index processingStatus + receivedAt |

Semua koleksi bisnis memakai createdAt/updatedAt kecuali log immutable. Rahasia provider tidak berada di dokumen user. snapToken dan qrToken diperlakukan sebagai credential: tidak masuk listing/log; QR hanya dibaca pemilik tiket melalui endpoint detail. Gunakan token acak kriptografis minimal 32 byte. ticketCode juga acak, bukan nomor urut yang bisa ditebak.

Snapshot pesanan mencakup judul acara, waktu/zona, lokasi, nama tipe tiket, dan harga agar perubahan katalog tidak menulis ulang pembelian. API tidak mengembalikan passwordHash, tokenHash, atau seluruh dokumen database mentah.

## Data untuk laporan dan detail pesanan

Tambahkan pada orders: `orderCode` unik (indeks unique), `paidAt` nullable, `buyerSnapshot:{name,email}`, dan `paymentTimeline:[{status,at}]`. Snapshot buyer diambil ketika order dibuat. Timestamp paidAt ditetapkan satu kali dari waktu sukses provider terverifikasi, atau waktu konfirmasi server bila provider tidak menyediakannya. Simpan transisi timeline bersama perubahan status secara atomik; notifikasi duplikat tidak menambah transisi.

Indeks pelaporan tambahan: orders `(eventId,paymentStatus,paidAt)` dan tickets `(eventId,checkInStatus,checkedInAt,_id)`. Riwayat check-in berasal dari tiket used, bukan koleksi kehadiran kedua; checkedInBy merujuk akun petugas. Filter kepemilikan/assignment diterapkan sebelum membaca laporan. Gross sales dihitung dari order, bukan join yang mengalikan nilai per tiket.

Harga awal katalog dihitung dari ticketTypes yang dapat dibeli saat query; jangan menyimpan startingPrice sebagai sumber kebenaran inventori. Filter rentang harga memakai tipe aktif yang memenuhi rentang. Lihat [semantik API](api-contract.md) untuk startingPrice dan matchingStartingPrice.

## Status kanonis aplikasi

| Properti | Nilai | Makna |
| --- | --- | --- |
| publicationStatus | draft, published | ended dihitung dari endsAt, bukan status yang harus diubah timer |
| paymentStatus | pending, paid, failed, expired | Hanya backend/provider yang menetapkan hasil |
| reservationStatus | held, converted, released | Kuota ditahan, menjadi penjualan, atau dilepas |
| issuanceStatus | not_ready, processing, issued | Terpisah dari status pembayaran |
| paymentSessionState | not_started, creating, ready, uncertain, closed | Mengelola retry sesi provider dan ketidakpastian respons |
| checkInStatus | unused, used | Hanya perubahan unused → used dalam MVP |
| processingStatus | received, processed, retry | Status penanganan event provider |

`verifying` adalah indikator UI dari metadata rekonsiliasi, bukan status pembayaran baru. Notifikasi paid tidak boleh diturunkan oleh notifikasi pending lama. Status provider yang tidak didukung atau nominal tidak cocok dicatat untuk rekonsiliasi; jangan diterjemahkan otomatis menjadi paid/failed.

## Transaksi reservasi

1. Periksa duplicate buyerId + idempotencyKey. Payload berbeda dengan key sama ditolak 409.
2. Dalam transaksi: validasi akun, event terpublikasi/penjualan terbuka, periode tiket, harga, dan available >= quantity.
3. Semua perubahan gate penjualan/publish/delete dan checkout menulis dokumen event yang sama (misalnya increment checkoutVersion). Ini menimbulkan konflik transaksi ketika checkout berlomba dengan penutupan/penghapusan acara; retry harus memvalidasi ulang gate.
4. Update bersyarat ticketType.reserved += quantity dan buat order dengan snapshot. Harga dan kuota yang dibaca harus konsisten dengan update; edit tiket serentak memicu konflik/retry.
5. Commit sebelum meminta sesi Midtrans. Duplikasi key unik ditangani dengan mengambil order lama setelah transaksi rollback.

## Provider, expiry, dan issuance

Pembuatan sesi memakai providerOrderId stabil per order. Bila timeout, simpan uncertain dan rekonsiliasi transaksi/sesi sebelum mencoba lagi atau melepas kuota. Payment Not Found saja tidak membuktikan halaman Snap lama tidak dapat dipakai; pemulihan harus mempertimbangkan sesi/expiry provider. Selaraskan expiry transaksi dan halaman Snap dengan expiresAt serta cegah pembuatan sesi baru setelah batas tersebut.

Notifikasi masuk diverifikasi dan direkam durable; acknowledgment diberikan setelah penerimaan durable. Event duplikat dengan processingStatus retry tetap harus diproses ulang. Fingerprint tidak boleh membuat notifikasi gagal-proses hilang selamanya.

Pada sukses, satu transaksi mengubah order pending/held menjadi paid/converted/processing dan mengubah reserved -= quantity, sold += quantity. Retry tidak mengulangi perubahan. Worker kemudian menyisipkan tiket dengan unique orderId + sequence dan menetapkan issued dalam transaksi. Crash sebelum issuance dipulihkan dari paid/processing.

Pada gagal/expired yang sudah dipastikan tidak dapat dibayar, transaksi mengubah held → released dan reserved -= quantity sekali. Worker expiry dan webhook harus mengunci perubahan state order yang sama. Jika paid datang setelah released, jangan membuat stok negatif atau menerbitkan tiket tanpa kuota; catat insiden rekonsiliasi dan tampilkan pemeriksaan, bukan gagal bayar palsu.

## Check-in

Periksa assignment dan event/time window, kemudian conditional update tiket dengan checkInStatus=unused menjadi used; simpan actor/time. Concurrent scan hanya satu cocok. Untuk pencabutan akses yang serentak, ulangi pemeriksaan assignment dalam transaksi check-in dan koordinasikan penulisan assignment/version agar pencabutan tidak lolos dari pemeriksaan lama. Hasil duplicate tidak menambah hitungan.

Tidak ada TTL pada orders, tickets, atau inventori. Transaksi memerlukan replica set; pengujian concurrency tidak cukup menggunakan database mock tanpa perilaku transaksi.
