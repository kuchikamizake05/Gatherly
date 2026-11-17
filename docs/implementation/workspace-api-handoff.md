# Kontrak integrasi workspace organizer

Branch: `feat/organizer-issues.nasta`. Referensi: issue #10, #17, #19, #64–69 dan pita 14–19/23 di `gatherly.pen`. Desain tidak diubah.

Dokumen ini disiapkan untuk review pemilik backend, belum diposting sebagai komentar GitHub. Backend tetap dikerjakan tim backend. Semua request frontend melalui `src/lib/api/client.ts`; mutasi memakai cookie sesi dan CSRF. Mode live (false/tidak diisi) selalu memakai HTTP asli, termasuk endpoint pending; fixture hanya untuk mode mock eksplisit. Suite `test:live` menggunakan build produksi dengan respons HTTP terkontrol, belum merupakan bukti integrasi backend tim.

## Yang diperlukan dari tim backend untuk release

1. Origin HTTPS backend untuk `API_INTERNAL_URL` sebelum build dan domain frontend/organizer yang dipilih. Backend harus menerima Origin organizer pada pemeriksaan CSRF/origin; konfigurasi `WEB_ORIGIN` lama yang hanya menerima domain peserta belum mencukupi.
2. Cookie sesi workspace HttpOnly, Secure, SameSite yang sesuai, serta token CSRF pada login dan `/me`. Endpoint privat perlu `Cache-Control: private, no-store`. Frontend membersihkan sesi/cache privat saat menerima 401 dan tidak mengulang mutasi otomatis.
3. Respons sesuai tipe/validator frontend: `organizer-auth/api.ts` dan file `response.ts` di organizer-events, organizer-settings, team, check-in. DTO event lama tanpa `ticketTypes`, status/inventori, atau field wajib lain ditolak sebagai respons tidak lengkap, bukan diberi angka nol rekaan.
4. `Idempotency-Key` pada refund, pencairan, dan pembatalan acara. Retry intent yang sama dalam form yang sama mengirim key yang sama. Backend harus menyimpan hasil, mencegah eksekusi ganda secara atomik (termasuk lintas reload/perangkat), dan menolak key yang dipakai untuk payload berbeda. Frontend tidak dapat menjamin idempotensi hanya dengan header.
5. Endpoint multipart poster mengembalikan `{data:{assetId,url}}`; URL gambar HTTPS atau path origin yang sama. Unggahan memakai cookie/CSRF, progres transfer, timeout, dan pembatalan di browser. Konfirmasi check-in harus memuat `ticketId`, `attendeeName`, `ticketTypeName`, `checkInStatus: "used"`, dan `checkedInAt` valid; HTTP 200 dengan payload kosong tidak menjadi tiket valid.

## B28: autentikasi dan tim

Namespace `/workspace/auth`: `GET /me`, `POST /login`, `/logout`, `/password/first`, `/password/forgot`, `/password/reset`, `/password`.

- Login: `{ username, password }`; respons `{ data: { role, username, name, mustChangePassword, organizer: { id, name, username, frozen, frozenReason? }, csrfToken } }`. Role `organizer | committee`.
- Password pertama: `{ newPassword }`; reset: `{ token, password }`; keamanan: `{ currentPassword, newPassword }`. Minimal 12 karakter, tidak sama dengan sebelumnya. Password sementara 7 hari, reset email 30 menit sekali pakai. Tidak boleh melewati kewajiban ganti password dengan membuka URL workspace langsung.
- Forgot: `{ usernameOrEmail }`, respons `{ data: { isCommittee, emailMasked? } }`. Panitia diarahkan menghubungi organizer. Backend perlu menjaga respons terhadap enumerasi akun.
- Error: `UNAUTHENTICATED` 401; `ACCOUNT_INACTIVE` / `TEMPORARY_PASSWORD_EXPIRED` 403; `VALIDATION_ERROR` 422 dengan `fields`; `RATE_LIMITED` 429, lock 10 menit setelah 5 kegagalan. Ganti password/reset harus mencabut sesi lain di server.
- `GET /organizer/team` mengembalikan `{ data: TeamMember[] }`: `id, name, username, assignedEvents, eventIds, email?, status`. Status `owner | active | never_logged_in | inactive`.
- `POST /organizer/team`: `{ name, username, email?, eventIds }`; maksimum 20 panitia. `GET /username?username=` memeriksa ketersediaan. Validasi unik wajib di server saat create.
- `POST /:id/reset-password`: kredensial sekali tampil `{ data: { username, temporaryPassword, expiresAt } }`; jangan log respons atau simpan password plaintext.
- `PUT /:id/assignments { eventIds }`, `POST /:id/deactivate`, `/reactivate`, `DELETE /:id`. Nonaktif mencabut assignment/sesi; hapus hanya akun nonaktif; histori tetap tersimpan.

## B33: editor, inventori, dan kelola acara

API lama mewajibkan seluruh field saat create. UI sekarang menyimpan draf perangkat ketika API menolak draf parsial; dukungan draf hanya nama belum selesai di backend.

`GET /organizer/events` perlu baris `OrgEventRow`: `id, title, startsAt, venueName, poster?, sold, capacity, gross, status` serta `meta { page, limit, total }`. Status `draft | scheduled | on_sale | ended | cancelled`. Backend lama baru mengembalikan DTO acara tanpa inventori/status turunan.

`GET /organizer/events/:id` perlu `OrgEvent` termasuk `posterUrl, locationType, province?, postalCode?, updatedAt, terms[], performerLabel, performers[], showRemaining, ticketTypes[]`. Setiap jenis tiket memuat `id, name, description?, price, capacity, sold, reserved, salesStartsAt, salesEndsAt, salesStopped`. DTO lama belum memuat jenis tiket/field baru ini; kontrak harus diselaraskan sebelum integrasi dinyatakan lulus.

- `POST /organizer/posters`, multipart `file`, gambar maksimal 1 MB; respons `{ data: { assetId, url } }`. Asset harus diverifikasi dan dimiliki organizer.
- Create/update menerima draf parsial; publish memvalidasi kelengkapan, tanggal, harga/kuota, dan periode penjualan. Jangan mengubah harga tiket terjual atau menurunkan kuota di bawah `sold + reserved`. Tiket gratis `price=0` memerlukan perubahan validator lama yang masih `positive()`.
- `POST /:id/ticket-types/:typeId/stop` dan `/resume`; tiket yang sudah dibayar tetap valid.
- `POST /:id/duplicate` -> `{ data: { id } }`, draf baru tanpa pesanan/penugasan dan seluruh counter nol.
- `POST /:id/cancel { confirmTitle, reason }`, validasi judul persis, alasan wajib, tutup penjualan secara atomik. Pengembalian dana dan status proses pembatalan harus berasal dari server.
- Assignment per acara: `POST /:id/committee { memberIds }`; list memuat `userId, name, username, assignedAt`; revoke `DELETE /:id/committee/:userId`. API lama masih menugaskan akun peserta melalui email, sehingga belum kompatibel dengan B28.

## B35: laporan, refund, dan kirim ulang

Laporan lama tersedia. Adapter pesanan menormalisasi `ticketType.name` menjadi `ticketTypeName`. Filter/pagination memakai `q, paymentStatus/checkInStatus, page`; `meta.total` wajib menghitung hasil filter. Ekspor CSV frontend mengambil seluruh halaman filter, bukan halaman yang sedang terlihat, dan menetralkan formula spreadsheet.

- `POST /organizer/events/:id/orders/:orderId/resend`: kirim ulang e-tiket hanya pesanan yang sudah dibayar, dengan rate limit server.
- `POST /:id/orders/:orderId/refunds { mode: full|partial, ticketIds?, reason }`. Server menentukan nominal, memvalidasi kepemilikan tiket dan sisa dana, mencegah pengembalian ganda, serta mengembalikan progres provider. Tiket terpilih harus menjadi `cancelled` sehingga check-in menolak. Status pesanan `refunded | partially_refunded`.
- Ringkasan global perlu `dailySales[{date,amount}], changePercent?, pendingOrders?, attendanceRate?`. UI menampilkan rincian tidak tersedia bila seri harian tidak dikirim, tanpa membuat data chart untuk API asli.

## B38–39: profil, rekening, pencairan

`GET/PATCH /organizer/profile`: `logoUrl, name, username` terkunci, `city, description` maksimal 500, `links[{type,url}]` maksimal 5. PATCH multipart `name, city, description, links` JSON, opsional `logo` maksimal 1 MB dan `removeLogo=true`. Tautan web http/https; tipe email berisi alamat email/mailto.

`GET/PUT /organizer/bank-account`: `{ bank, accountNumber, holderName }` atau null. Nomor 10–16 angka; list menampilkan 4 digit terakhir. Data rekening perlu dilindungi di server; masking UI bukan pengganti kontrol akses.

`GET /organizer/payouts`: `{ data: { available, processing, transferred, rows } }`. Baris: `eventId, eventTitle, eventDate, net, status, requestedAt?, transferredAt?, transferReference?`. Status `waiting_event | available | requested | transferred`. Nilai dasar tiket setelah pengembalian dana, tanpa potongan biaya layanan (dibayar pembeli). `POST /organizer/payouts {eventId}` hanya acara selesai dengan saldo positif dan rekening tersedia; idempoten/atomik. Frontend tidak menetapkan status `transferred`.

## B41: scanner

`GET /committee/events` belum tersedia di backend lama, ditandai pending. Respons mencakup assignment aktif, jadwal, `scanOpensAt`, `scanClosesAt`, `checkedIn`, `paidTickets`. Penolakan akses harus berlaku pada lookup/history/check-in, bukan hanya daftar navigasi.

Check-in/lookup/history yang sudah tersedia tetap harus menegakkan assignment dan waktu di server. UI menghentikan kamera saat akses ditolak. History tambahan memerlukan `method, outcome, reason`, dan total percobaan terpisah dari total hadir.

Offline bundle masih kosong di adapter pending: tidak ada klaim operasional offline. Kontrak perlu menyepakati tiket, hash QR SHA-256 dengan indeks yang sama, expiry, pencabutan akses, sinkronisasi idempoten, dan konflik antarperangkat. Antrean lokal ditampilkan belum dikonfirmasi; kegagalan jaringan tidak boleh menjadi sukses check-in.
