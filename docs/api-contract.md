# Gatherly — Kontrak API v1 (draft kerja)

Pembagian role: **FE 1 — Aulia Nur Fajri Tri Anggoro (Ancung)**, **FE 2 — Muhammad Khoirunas (Nasta)**, **BE 1 / Ketua — Faaid Sakhaa (Sako)**, **BE 2 — Dien Muhammad Scientivan Kurniapramono**. Lihat [tanggung jawab tim](team-workflow.md).

Basis `/api/v1`, JSON kecuali poster multipart. Semua endpoint dilayani Express. FE dapat membuat mock dari kontrak ini sebelum BE selesai. Perubahan field/status direview FE dan BE dalam PR yang sama. Bukan API yang sudah tersedia.

## Konvensi

- ID string; harga integer rupiah; waktu ISO 8601 UTC; timezone acara eksplisit.
- Sukses `{ "data": ... }`; daftar `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0 } }`.
- Pagination page >= 1, limit 1–50; urutan stabil dengan id sebagai pemutus seri. Query tidak dikenal ditolak atau diabaikan secara konsisten, tanpa meneruskan operator Mongo mentah.
- Error `{ "error": { "code": "...", "message": "...", "fields": {} }, "requestId": "..." }`.
- Status: 200 baca/ubah, 201 pembuatan, 202 pemrosesan belum selesai, 204 hapus/logout, 400 format/validasi, 401 belum login, 403 tidak berhak/CSRF, 404 tidak ditemukan/tidak boleh diketahui, 409 konflik, 413 terlalu besar, 415 jenis berkas, 429 rate limit, 502/503 provider sementara gagal.
- Cookie sesi HttpOnly. Mutasi terautentikasi menggunakan `X-CSRF-Token`; GET `/auth/me` mengembalikan token CSRF untuk sesi aktif. Login/register menggunakan pemeriksaan Origin. Webhook dikecualikan dari sesi/CSRF dan memakai verifikasi provider.
- Semua endpoint privat tidak di-cache bersama. ownerId/buyerId berasal dari sesi, bukan body pengguna.

## Akun dan profil — BE 1

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| POST /auth/register | name, email, password | 202 challenge OTP email; user belum dibuat. Nama 2–100 karakter, email valid/normalisasi, password 12–128 karakter. Tidak menerima role |
| POST /auth/register/verify | challengeId, code | 201 user + csrfToken dan cookie; membuat user setelah OTP benar |
| POST /auth/login | email, password | 202 challenge OTP setelah password benar; kredensial salah → 401 generik |
| POST /auth/login/verify | challengeId, code | 200 user + csrfToken dan cookie setelah OTP benar |
| POST /auth/otp/resend | challengeId | 200 expiry/cooldown baru; OTP lama tidak berlaku |
| GET /auth/google | — | Redirect ke Google dengan OAuth state sekali pakai |
| GET /auth/google/callback | code, state | Membuat/menautkan user, membuat cookie, redirect ke frontend |
| GET /auth/me | — | user, organizerId nullable, hasCommitteeAssignments, csrfToken; 401 tanpa sesi |
| POST /auth/logout | — | 204; invalidasi sesi dan cookie |
| POST /organizers | name, description, contactEmail | 201 profil sendiri; duplikat → 409 |
| GET /organizers/me | — | Profil sendiri; 404 bila belum dibuat |

OTP terdiri dari enam digit, berlaku 10 menit, maksimal lima percobaan, dan dapat dikirim ulang setelah 60 detik. Register membuat akun hanya setelah verifikasi; login membuat sesi hanya setelah verifikasi. Google OAuth hanya menerima email Google yang terverifikasi dan tidak mengirim token provider ke frontend.

## Acara dan upload — BE 1

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /events | q, city, category, from, to, minPrice, maxPrice, sort=date_asc atau price_asc, page, limit | Katalog published belum ended; startingPrice dari tipe yang dapat dibeli sekarang, nullable bila tidak ada |
| GET /events/:slug | — | Detail publik + jenis tiket, available, availabilityStatus; draf → 404 |
| GET /organizer/events | status=draft/published/ended, page, limit | Acara milik organizer |
| POST /organizer/events | title wajib (2–160). Field lain opsional, string kosong diterima, tanggal kosong atau null diabaikan | 201 draf. Bila startsAt diisi harus di masa depan dan endsAt > startsAt. posterAssetId dan foto pengisi acara harus gambar milik organizer (`INVALID_ASSET`). Slug dibuat server |
| GET /organizer/events/:id | — | Detail editor milik organizer |
| PATCH /organizer/events/:id | Subset field acara atau salesClosed | Draf memakai aturan longgar yang sama. Acara terbit diperiksa ulang dengan aturan lengkap. Acara dibatalkan → 409 `EVENT_CANCELLED` |
| DELETE /organizer/events/:id | — | 204 hanya draf tanpa order; konflik → 409 |
| POST /organizer/events/:id/publish | — | 200 published. Draf divalidasi lengkap lebih dulu, gagal → 400 `VALIDATION_ERROR` dengan `fields` per field. Tanpa poster atau tanpa tipe tiket → 409 `CONFLICT` |
| POST /organizer/events/:id/ticket-types | name, description, price, capacity, salesStartsAt, salesEndsAt | 201 tipe baru; harga integer >= 0 (0 untuk tiket gratis), kapasitas integer > 0. Draf tanpa jadwal boleh menambah tipe, periode jual diperiksa ulang saat publish |
| PATCH /organizer/events/:id/ticket-types/:typeId | Subset field tipe | 200; kapasitas >= sold + reserved; typeId harus milik event |
| DELETE /organizer/events/:id/ticket-types/:typeId | — | 204 hanya tipe tanpa order; 409 bila sudah direferensikan |
| POST /organizer/posters | Multipart field file | 201 assetId + url; JPEG/PNG/WebP, maksimum 5 MB; periksa isi, bukan ekstensi saja; organizer login |

Draf cukup memiliki title. Kelengkapan diperiksa saat publish dengan aturan berikut: title 2–160, description 1–5.000, category 2–80, venueName 2–160, address 2–300, city 2–100, timezone IANA valid, endsAt > startsAt, startsAt masa depan, jendela check-in dibuka sebelum ditutup dan ditutup paling lambat endsAt (default dibuka dua jam sebelum startsAt), serta salesEndsAt setiap tipe tiket <= startsAt (`fields.ticketTypes`). Kesalahan dikembalikan sebagai 400 `VALIDATION_ERROR` dengan `fields`, sehingga FE dapat menandai field yang belum lengkap. Semua mutasi nested memeriksa ownership kedua resource.

### Filter harga katalog

`minPrice` dan `maxPrice` opsional, integer rupiah >= 0, batas inklusif; minPrice > maxPrice atau nilai tidak valid menghasilkan 400 VALIDATION_ERROR. Batas nol pada filter bukan izin membuat tiket gratis.

Acara cocok bila setidaknya satu tipe tiket yang dapat dibeli sekarang memiliki harga dalam rentang. Dapat dibeli berarti acara terpublikasi, sales tidak ditutup, periode penjualan aktif, dan available > 0. `startingPrice` selalu harga minimum seluruh tipe yang dapat dibeli, bukan hanya tipe yang cocok filter. Saat filter harga aktif, sertakan `matchingStartingPrice` (minimum tipe yang cocok) agar FE bisa menampilkan harga hasil filter dengan jujur. Tanpa filter nilainya sama dengan startingPrice.

Contoh: Presale Rp75.000 habis dan Reguler Rp100.000 tersedia → startingPrice Rp100.000. Acara tanpa tipe yang dapat dibeli tetap boleh muncul tanpa filter harga dengan startingPrice=null dan badge status, tetapi tidak cocok filter harga. Sort price_asc menggunakan matchingStartingPrice, null di akhir, lalu id; date_asc memakai startsAt lalu id. Filter/pagination dan meta.total diterapkan setelah penyaringan yang sama.

## Order dan pembayaran — BE 2

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| POST /orders | ticketTypeId, quantity, attendees:[{name}]; header Idempotency-Key | 201 OrderDTO + reservasi; key sama/payload sama → 200 order lama; payload berbeda → 409; peserta login |
| GET /orders | page, limit | Hanya order pemilik |
| GET /orders/:id | — | OrderDTO pemilik; status aktual yang sudah diketahui server |
| POST /orders/:id/payment-session | — | 200 {snapToken, redirectUrl, expiresAt} untuk sesi siap; 202 bila creating/uncertain; 409 bila sudah paid/closed; tidak membuat charge baru setiap retry |
| POST /payments/midtrans/notifications | Payload asli provider | Respons acknowledgment setelah verifikasi dan penyimpanan durable; signature/identitas/nominal diperiksa |

Idempotency-Key adalah UUID buatan client per percobaan checkout logis; pertahankan saat retry jaringan, ganti saat pengguna membuat pesanan baru. quantity 1–4, attendees.length sama dengan quantity, nama 2–100 karakter. Tidak menerima totalAmount dari client sebagai harga final.

```json
{
  "ticketTypeId": "507f1f77bcf86cd799439011",
  "quantity": 2,
  "attendees": [{"name":"Alya Putri"},{"name":"Raka Pratama"}]
}
```

Contoh OrderDTO (ID/waktu ilustratif):

```json
{
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "event": {"title":"Senja Bersama","startsAt":"2026-10-24T09:00:00Z","timezone":"Asia/Jakarta","venueName":"Ruang Temu"},
    "ticketType": {"name":"Reguler","unitPrice":100000},
    "quantity":2,
    "attendees":[{"name":"Alya Putri"},{"name":"Raka Pratama"}],
    "totalAmount":200000,
    "currency":"IDR",
    "paymentStatus":"pending",
    "reservationStatus":"held",
    "issuanceStatus":"not_ready",
    "expiresAt":"2026-10-01T03:15:00Z",
    "serverTime":"2026-10-01T03:00:00Z",
    "isVerifying":false,
    "canResumePayment":true,
    "ticketIds":[]
  }
}
```

GET status dapat dipoll tiap 5 detik selama halaman pembayaran aktif; gunakan backoff ketika gagal, berhenti saat hasil terminal/halaman tidak aktif. GET bukan sumber keputusan payment; webhook/job rekonsiliasi memperbarui database. Setelah canResumePayment=false FE tidak membuka ulang Snap walaupun token pernah tersimpan.

## Tiket dan operasional

| Method/path | Input | Hasil/akses | Owner |
| --- | --- | --- | --- |
| GET /tickets | page, limit | Daftar tiket buyer tanpa qrToken | BE 2 |
| GET /tickets/:id | — | Detail buyer, event snapshot, attendeeName, ticketCode, qrPayload, checkInStatus, checkedInAt | BE 2 |
| GET /organizer/summary | from?, to? | Ringkasan seluruh acara organizer sendiri; aturan periode di bawah | BE 2 |
| GET /organizer/events/:id/summary | — | capacity/reserved/sold/available, checkedIn, grossPaidSales; owner | BE 2 |
| GET /organizer/events/:id/orders | q, paymentStatus, page, limit | Order acara owner; tanpa token provider | BE 2 |
| GET /organizer/events/:id/orders/:orderId | — | Detail pesanan dan timeline aman; event dan order harus cocok serta milik organizer | BE 2 |
| GET /organizer/events/:id/attendees | q, checkInStatus, page, limit | Tiket acara owner; tanpa QR credential | BE 2 |
| GET /organizer/events/:id/committee | — | Assignment acara owner | BE 1 |
| POST /organizer/events/:id/committee | memberIds (id akun panitia workspace milik organizer) | 201 assignment; anggota bukan milik organizer → 400 `INVALID_MEMBERS` | BE 1 |
| DELETE /organizer/events/:id/committee/:userId | — | 204; cabut akses pada request berikut | BE 1 |
| GET /committee/events | page, limit | Hanya acara ditugaskan | BE 1 |
| GET /committee/events/:id/tickets | q, page, limit | Lookup terbatas nama/kode/jenis/status; tanpa data pembayaran atau QR | BE 2 |
| GET /committee/events/:id/check-ins | page, limit | Riwayat semua check-in sukses acara yang ditugaskan; urutan terbaru, metadata jumlah hadir | BE 2 |
| POST /committee/events/:id/check-ins | Salah satu qrPayload ATAU ticketCode | 200 hasil berhasil, 409 used; validasi assignment/event/window | BE 2 |

QR payload berformat `gatherly:v1:<random-token>`; token ditafsirkan sebagai data, bukan URL untuk dikunjungi. Owner detail menyediakan payload yang dirender FE menjadi QR; download memakai halaman cetak. Check-in manual dan kamera memakai endpoint mutasi yang sama.

```json
{"data":{"ticketId":"507f1f77bcf86cd799439013","attendeeName":"Alya Putri","ticketTypeName":"Reguler","checkInStatus":"used","checkedInAt":"2026-10-24T08:45:00Z"}}
```

## Detail kontrak laporan dan operasional

### Ringkasan organizer

`GET /organizer/summary` hanya menghitung acara dengan organizerId profil pengguna. Tidak menerima organizerId dari client. from/to opsional dalam ISO 8601 UTC: rentang [from, to), from harus < to. Batas yang tidak diberikan tidak membatasi sisi tersebut. Tanpa keduanya, metrik penjualan mencakup seluruh waktu.

Respons `data` memuat:
- `publishedEvents`: jumlah acara berstatus published saat query, termasuk yang telah berakhir; tidak dipengaruhi periode pembayaran.
- `paidTickets`: jumlah quantity order paid dengan paidAt dalam rentang.
- `grossPaidSales`: jumlah totalAmount order paid pada rentang yang sama; tidak menghitung pending/failed/expired dan bukan saldo yang dapat dicairkan.
- `period: {from, to, basis: "paidAt"}` dengan null untuk batas yang tidak diberikan.
- `generatedAt`: waktu perhitungan untuk label pembaruan UI.

Organizer tanpa data mendapat 200 dengan angka nol; pengguna tanpa profil organizer mendapat 403. Perhitungan menggunakan order paid, bukan jumlah baris hasil join tiket, sehingga dua tiket tidak menggandakan nilai penjualan. UI memberi label publishedEvents sebagai jumlah saat ini, sedangkan periode hanya berlaku untuk metrik penjualan.

### Detail pesanan organizer

`GET /organizer/events/:id/orders/:orderId` mengembalikan `data` berisi id, orderCode, buyer:{name,email}, event dan ticketType snapshot, quantity, attendees, unitPrice, totalAmount, currency, paymentStatus, reservationStatus, issuanceStatus, createdAt, expiresAt, paidAt nullable, serta:
- `timeline`: array {status, at} untuk transisi pembayaran yang sudah diverifikasi, urut kronologis; notifikasi duplikat tidak membuat item ganda. Gunakan waktu provider terverifikasi bila tersedia; jika tidak, waktu konfirmasi server.
- `tickets`: array {id, ticketCode, attendeeName, checkInStatus, checkedInAt}; kosong jika belum diterbitkan.

Tidak mengembalikan qrPayload/qrToken, snapToken, redirectUrl, signature, kredensial atau payload provider mentah. Tidak ada aksi mark-as-paid. Order di event lain, event milik organizer lain, atau ID yang tidak ada menghasilkan 404 tanpa membocorkan data. Endpoint GET order peserta tetap dibatasi buyer; endpoint organizer ini tidak memperluas akses ke endpoint QR peserta.

`orderCode` adalah kode tampilan unik yang dibuat server; listing pesanan organizer menyertakannya dan query q mencari kode tersebut atau nama buyer. Kode tidak menggantikan pemeriksaan otorisasi.

### Riwayat check-in panitia

`GET /committee/events/:id/check-ins` memeriksa assignment pada setiap request, termasuk setelah acara selesai. Tanpa assignment aktif → 403; sesi tidak ada → 401. Query hanya tiket event itu dengan checkInStatus=used, urut checkedInAt menurun lalu id menurun. Gagal scan tidak muncul sebagai kehadiran.

Setiap item `data` berisi ticketId, ticketCode, attendeeName, ticketTypeName, checkedInAt, dan checkedInBy:{id,name}. `meta` berisi page, limit, total, paidTickets, generatedAt. total adalah jumlah check-in sukses seluruh acara; paidTickets adalah jumlah unit order paid acara itu, bukan jumlah order. Counter scanner menggunakan total/paidTickets; tidak menggunakan panjang halaman sebagai total hadir.

Panitia tidak menerima email buyer, nominal, payment timeline, atau QR credential dari riwayat. State tidak ada check-in mengembalikan 200 data=[] dan total=0. Refresh setelah check-in sukses untuk memperbarui hitungan lintas petugas. Pencabutan assignment juga mencabut akses riwayat.

## Akun peserta lanjutan — BE 1

Semua endpoint `/account` memerlukan sesi peserta. Mutasi juga memerlukan `X-CSRF-Token` dan pemeriksaan Origin. Endpoint lupa kata sandi bersifat publik dengan pemeriksaan Origin dan rate limit 60 request per 15 menit.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /account | — | 200 name, email, phone, avatarUrl, joinedAt, passwordChangedAt, hasPassword, googleEmail, activeDevices, notifications {reminders, recommendations} |
| PATCH /account | name 2–100, phone nullable (7–25 karakter angka, spasi, `+()-`) | 200 data akun terbaru. Kedua field wajib dikirim, field lain ditolak |
| POST /account/avatar | Multipart field file | 200 {avatarUrl}. JPEG/PNG/WebP maksimum 1 MB, isi berkas diperiksa |
| POST /account/password | currentPassword?, newPassword 12–128 | 204. currentPassword wajib bila akun sudah punya kata sandi. Sesi lain dicabut. Salah → 400 `INVALID_PASSWORD`, lima kali salah → 429 `PASSWORD_LOCKED` selama 10 menit, sama dengan lama → 400 `PASSWORD_REUSED` |
| DELETE /account/google | — | 204 memutus tautan Google. Akun tanpa kata sandi → 409 `PASSWORD_REQUIRED` |
| POST /account/sessions/revoke-others | — | 200 {signedOut} jumlah sesi lain yang dihapus |
| PATCH /account/notifications | reminders, recommendations (boolean, keduanya wajib) | 204 |
| POST /account/delete | confirmation berisi "hapus" atau "hapus akun" | 204 dan cookie dihapus. Data dianonimkan. Masih punya tiket/order aktif untuk acara mendatang → 409 `ACCOUNT_HAS_ACTIVE_TICKETS`, pemilik profil organizer → 409 `ACCOUNT_IS_ORGANIZER` |
| POST /auth/password/forgot | email | 204 selalu, tanpa membocorkan keberadaan akun. Tautan `WEB_ORIGIN/reset-password?token=` berlaku 30 menit, tautan lama tidak berlaku |
| POST /auth/password/reset | token 32–256, password 12–128 | 204. Semua sesi dicabut. Token salah, kedaluwarsa, atau terpakai → 410 `TOKEN_INVALID`, kata sandi sama → 400 `PASSWORD_REUSED` |

## Pengajuan organizer — BE 1

Endpoint pengajuan bersifat publik tanpa sesi dan tanpa CSRF, dengan rate limit 60 request per 15 menit. Unggahan dokumen dan formulir perbaikan diikat ke cookie HttpOnly yang berlaku satu jam.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /organizer-applications/username | username (3–40, huruf kecil, angka, `._-`) | 200 {available, suggestions}. Nama cadangan dan username yang sudah dipakai dianggap tidak tersedia |
| POST /organizer-applications/documents | Multipart field file | 201 {id, name, type, size} dan cookie upload. JPEG/PNG/PDF, gambar maksimum 1 MB, PDF maksimum 2 MB. Tanpa berkas → 400 `FILE_REQUIRED` |
| POST /organizer-applications | Lihat skema di bawah | 201 {number, email}. Email verifikasi PIC dikirim, berlaku 24 jam |
| GET /organizer-applications/verify-email | token | 200 {number, verified: true, message}. Tautan salah atau kedaluwarsa → 410 `VERIFICATION_EXPIRED` |
| POST /organizer-applications/lookup | number, email | 200 data pengajuan dan cookie sesi perbaikan. Tidak cocok → 404, status bukan needs_fix → 409 `NOT_NEEDS_FIX`, tenggat lewat → 410 `FIX_EXPIRED` |
| POST /organizer-applications/:number/fix | Hanya field yang ditandai admin | 204, status menjadi fix_submitted. Tanpa cookie → 401, sesi perbaikan habis → 410 `FIX_EXPIRED`, field tidak ditandai → 400 `FIELD_NOT_FLAGGED`, field bertanda tidak dikirim → 400 `FIX_INCOMPLETE` |

Skema pengajuan: organizerName 2–150, organizerType komunitas/organisasi_kampus/perusahaan/individu, description 10–2.000, address {province, city, street 5–500, postalCode lima digit}, links maksimum 5 {type instagram/tiktok/youtube/website/lainnya, url 3–500 tanpa skema javascript atau data}, pic {name 2–100, role, email, phone 8–30}, username, ktp (id dokumen), legalDocument nullable. Field tidak dikenal ditolak.

Dokumen KTP berupa JPEG/PNG/PDF maksimum 1 MB. Dokumen legal berupa PDF maksimum 2 MB dan wajib untuk perusahaan serta organisasi_kampus (`LEGAL_REQUIRED`). Dokumen harus diunggah dengan cookie upload yang sama (`INVALID_DOCUMENT`) dan belum dipakai pengajuan lain (`DOCUMENT_CLAIMED`). Nomor pengajuan berformat `PNG-YYMM-NNNN`.

Konflik saat pengajuan: username terpakai → 409 `USERNAME_TAKEN`, masih ada pengajuan aktif dengan email PIC yang sama → 409 `APPLICATION_EXISTS` dengan `details.number`, email sudah menjadi organizer → 409 `ALREADY_ORGANIZER`, ditolak kurang dari 30 hari lalu → 409 `REAPPLICATION_WAIT`. Saat perbaikan, perubahan email PIC mengirim ulang verifikasi dan menghapus status terverifikasi.

## Workspace organizer dan panitia — BE 1

Workspace memakai cookie `gatherly_workspace` (7 hari) yang terpisah dari sesi peserta. Akun workspace memiliki role organizer atau committee. Mutasi memerlukan `X-CSRF-Token` dari `/workspace/auth/me` atau respons login. Selama `mustChangePassword` bernilai true, endpoint organizer menolak akses dengan 403 (`FORBIDDEN` atau `PASSWORD_CHANGE_REQUIRED`). Organizer yang dibekukan admin hanya dapat membaca, mutasi → 403 `ORGANIZER_FROZEN`.

### Autentikasi workspace

Rate limit 60 request per 15 menit.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| POST /workspace/auth/login | username, password | 200 {role, username, name, mustChangePassword, organizer {id, name, username, frozen, frozenReason}, csrfToken} dan cookie. Salah → 401 generik, lima kali salah → 429 `ACCOUNT_LOCKED` selama 10 menit, kata sandi sementara lewat 7 hari → 410 `TEMPORARY_PASSWORD_EXPIRED` |
| GET /workspace/auth/me | — | 200 bentuk yang sama dengan login. Tanpa sesi → 401 |
| POST /workspace/auth/logout | — | 204, sesi dan cookie dihapus. Memerlukan CSRF |
| POST /workspace/auth/password/first | newPassword 12–128 | 204. Hanya saat mustChangePassword, selain itu 409 `CONFLICT`. Sama dengan sementara → 400 `PASSWORD_REUSED`. Sesi lain dicabut |
| POST /workspace/auth/password | currentPassword, newPassword 12–128 | 204. Salah → 400 `WRONG_PASSWORD`. Sesi lain dicabut |
| POST /workspace/auth/password/forgot | usernameOrEmail | 200 {isCommittee}. Panitia mendapat true dan diarahkan menghubungi organizer. Selain itu selalu false. Organizer dengan email menerima tautan `ORGANIZER_ORIGIN/reset-password?token=` yang berlaku 30 menit |
| POST /workspace/auth/password/reset | token (minimal 20), password 12–128 | 204, hanya akun organizer. Semua sesi dicabut. Token salah atau kedaluwarsa → 410 `RESET_EXPIRED` |

### Profil, tim, rekening, dan pencairan

Profil dan tim memerlukan sesi workspace role organizer. Rekening, pencairan, dan aksi acara memakai `requireSession` + `requireOrganizer`, yang menerima sesi workspace organizer maupun sesi peserta pemilik profil organizer.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /organizer/profile | — | 200 name, username, city, description, logoUrl, links |
| PATCH /organizer/profile | Multipart atau JSON. name 2–150, city 1–100, description 10–2.000, links maksimum 5 {type 1–30, url 3–500}, file logo opsional | 204. Semua field teks wajib. Dalam multipart links dikirim sebagai string JSON. Logo JPEG/PNG/WebP maksimum 1 MB, selain itu 400 `INVALID_IMAGE` |
| GET /organizer/team | — | 200 array. Baris pertama pemilik dengan status owner dan assignedEvents -1. Anggota berisi id, name, username, assignedEvents, eventIds, status active/inactive/never_logged_in |
| GET /organizer/team/username | username | 200 {available} |
| POST /organizer/team | name 1–100, username, eventIds maksimum 100 | 201 {username, temporaryPassword, expiresAt}. Kata sandi sementara hanya tampil sekali dan berlaku 7 hari. Username terpakai → 409 `USERNAME_TAKEN`, lebih dari 100 anggota → 409 `MEMBER_LIMIT`, acara bukan milik organizer → 400 `INVALID_EVENTS` |
| PUT /organizer/team/:id/assignments | eventIds maksimum 100 | 204, mengganti seluruh penugasan. Acara harus milik organizer |
| POST /organizer/team/:id/reset-password | — | 200 {username, temporaryPassword, expiresAt}. Sesi anggota dicabut |
| POST /organizer/team/:id/deactivate | — | 204. Sesi anggota dicabut dan login ditolak |
| POST /organizer/team/:id/reactivate | — | 204 |
| DELETE /organizer/team/:id | — | 204. Sesi dan penugasan anggota ikut dihapus |
| GET /organizer/bank-account | — | 200 {bank, accountNumber tersamar `••••1234`, holderName} atau null |
| PUT /organizer/bank-account | bank 2–80, accountNumber 5–30 digit, holderName 2–100 | 200 data tersamar. Membuat atau mengganti rekening |
| GET /organizer/payouts | — | 200 {available, processing, transferred, rows}. rows berisi eventId, eventTitle, eventDate, net, status waiting_event/available/requested/transferred, requestedAt, transferredAt, transferReference |
| POST /organizer/payouts | eventId | 201 {eventId, status: "requested"} |

Anggota tim yang tidak ditemukan atau milik organizer lain → 404. Nilai net pencairan adalah subtotal order paid dikurangi pengembalian harga tiket, sehingga biaya layanan tidak termasuk. Pengajuan pencairan ditolak bila acara belum selesai, belum terbit, atau sedang diajukan batal (409 `PAYOUT_UNAVAILABLE`), masih ada refund disetujui yang belum selesai (409 `REFUNDS_PENDING`), sudah pernah diajukan (409 `PAYOUT_EXISTS`), rekening belum disimpan (409 `BANK_REQUIRED`), atau saldo nol (409 `NO_BALANCE`). Satu acara hanya memiliki satu pencairan.

### Aksi acara organizer

Semua aksi memerlukan CSRF dan acara milik organizer, selain itu 404.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| POST /organizer/events/:id/duplicate | — | 201 {id}. Salinan draf berjudul "(salinan)" beserta tipe tiket dengan counter nol. Status pembatalan tidak ikut disalin |
| POST /organizer/events/:id/cancel | confirmTitle sama persis dengan judul, reason 10–1.000 | 201 {id, status: "requested"}, menunggu keputusan admin. Judul tidak cocok → 400 `CONFIRMATION_MISMATCH`, sudah dibatalkan atau diajukan → 409 `CANCELLATION_EXISTS`, acara selesai → 409 `EVENT_ENDED` |
| POST /organizer/events/:id/ticket-types/:typeId/stop | — | 204, penjualan tipe dihentikan sementara (salesStopped) |
| POST /organizer/events/:id/ticket-types/:typeId/resume | — | 204, penjualan tipe dibuka kembali |
| POST /organizer/events/:id/orders/:orderId/refunds | mode full/partial, ticketIds? maksimum 20, reason 3–500 | 201 refund kind organizer berstatus approved. Lihat bagian pengembalian dana |
| POST /organizer/events/:id/orders/:orderId/resend | — | 202 {queued: true}, email tiket dikirim ulang ke pembeli. Hanya order paid dan issued, jeda 60 detik per order, selain itu 409 `RESEND_UNAVAILABLE` |

## Pengembalian dana — BE 2

Refund memiliki kind buyer, organizer, atau event_cancelled dan status requested, approved, processing, manual_required, refunded, atau rejected. Worker meneruskan refund approved ke Midtrans. Metode atau nominal yang tidak didukung provider, atau jendela idempotensi tujuh hari yang sudah lewat, menjadi manual_required dan diselesaikan admin dengan transfer manual.

DTO refund berisi id, orderId, eventId, ticketIds, reason, kind, status, amount, baseAmount, decisionNote, requestedAt, decidedAt, refundedAt, transferReference.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /refunds | — | 200 maksimal 100 refund milik pembeli, terbaru dulu, tanpa meta. Sesi peserta |
| POST /refunds/orders/:orderId | reason 10–1.000, ticketIds? 1–4 | 201 refund kind buyer berstatus requested. Sesi peserta dan CSRF. Tanpa ticketIds semua tiket unused diajukan |
| POST /organizer/events/:id/orders/:orderId/refunds | mode, ticketIds?, reason 3–500 | 201 refund kind organizer berstatus approved tanpa tinjauan admin |

Aturan refund pembeli: hanya order paid dan issued milik sendiri, diajukan paling lambat satu bulan kalender sebelum acara (409 `REFUND_DEADLINE`), acara belum dibatalkan (409 `EVENT_CANCELLED`), belum ada pencairan (409 `PAYOUT_EXISTS`), belum ada refund aktif untuk order itu (409 `REFUND_EXISTS`), dan tiket yang dipilih masih unused (409 `INVALID_TICKETS`). Nominal = unitPrice × jumlah tiket, biaya layanan tidak dikembalikan. Tiket gratis → 409 `NOT_REFUNDABLE`.

Aturan refund organizer: mode full mengambil semua tiket unused pada order, mode partial memakai ticketIds yang wajib berisi tiket unused milik order itu. Refund langsung approved, tiket yang dipilih langsung dibatalkan, dan pembeli menerima email. Nominal = unitPrice × jumlah tiket, biaya layanan tidak dikembalikan. Pemeriksaan order paid/issued, acara dibatalkan, pencairan, dan refund aktif sama dengan refund pembeli. Tidak ada batas tenggat satu bulan.

Pembatalan acara yang disetujui admin membuat refund event_cancelled untuk setiap order paid sebesar totalAmount dikurangi yang sudah dikembalikan, termasuk biaya layanan, dan menolak refund pembeli yang masih requested.

## Konsol admin — BE 1 dan BE 2

Admin memakai cookie `gatherly_admin` yang terpisah. Mutasi memerlukan `X-CSRF-Token` dari login atau `/admin/auth/me`. Email admin harus memakai domain `ADMIN_EMAIL_DOMAIN` (default gatherlyy.fun). Akun admin hanya dibuat lewat perintah seed, tidak ada endpoint pendaftaran.

### Autentikasi admin

Rate limit 60 request per 15 menit.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| POST /admin/auth/login | email, password | 200 {challengeId}. Challenge berlaku 5 menit dan maksimal lima percobaan. Salah → 401 generik, lima kali salah → 429 `ACCOUNT_LOCKED` selama 10 menit |
| POST /admin/auth/totp | challengeId, code, rememberDevice? | 200 {id, name, email, csrfToken} dan cookie. Sesi 8 jam, atau 7 hari bila rememberDevice. Kode TOTP tidak dapat dipakai ulang |
| POST /admin/auth/backup-code | challengeId, code, rememberDevice? | Sama dengan totp. Kode cadangan sekali pakai dan admin utama menerima email pemberitahuan |
| GET /admin/auth/me | — | 200 {id, name, email, csrfToken}. Tanpa sesi → 401 |
| POST /admin/auth/logout | — | 204, sesi dan cookie dihapus |

Challenge salah atau habis → 401 `CHALLENGE_INVALID`, kode salah → 401 `CODE_INVALID`, challenge sudah dipakai → 409 `CHALLENGE_USED`. Login dan verifikasi dicatat di audit log.

### Pengajuan dan organizer

Daftar memakai page (limit tetap 20) dan mengembalikan `counts` di samping `meta`.

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /admin/applications | page, q (nama atau nomor), tab (status, new mencakup fix_submitted), type | 200 data {id, number, organizerName, type, submittedAt, status}, meta, counts {new, needs_fix, approved, rejected} |
| GET /admin/applications.csv | — | 200 text/csv lampiran, maksimal 10.000 baris. Sel diawali `= + @ -` dinetralkan |
| GET /admin/applications/:id | — | 200 data pengajuan, documents (URL bertanda tangan), checks {emailVerified, usernameAvailable, similarOrganizers}, history. Akses dokumen dicatat di audit log |
| POST /admin/applications/:id/request-fix | flags 1–10 {field, note 1–1.000} | 204, status needs_fix dengan tenggat 14 hari, email dikirim ke PIC |
| POST /admin/applications/:id/reject | reason 5–2.000 | 204, email penolakan dikirim. Dokumen dihapus setelah 90 hari |
| POST /admin/applications/:id/approve | — | 204. Membuat organizer dan akun workspace, lalu mengirim username serta kata sandi sementara 7 hari ke PIC. Email belum diverifikasi → 409 `EMAIL_NOT_VERIFIED`, flag belum diselesaikan → 409 `FLAGS_EXIST`, username terpakai → 409 `USERNAME_TAKEN` |
| GET /admin/organizers | page, q (nama, username, email), tab (active/never_logged_in/frozen) | 200 data {id, name, username, status, activeEvents, grossSales}, meta, counts {active, never_logged_in, frozen} |
| GET /admin/organizers/:id | — | 200 ringkasan organizer, events {id, title, startsAt, sold, capacity, status}, joinedAt, applicationNumber, totalEvents, completedEvents, pic, frozenReason, activity, reportCount |
| POST /admin/organizers/:id/freeze | reason 5–2.000 | 204. Semua mutasi organizer ditolak dan acaranya tampil tertutup di katalog |
| POST /admin/organizers/:id/unfreeze | — | 204, status kembali active atau never_logged_in |
| POST /admin/organizers/:id/resend-access | — | 204, kata sandi sementara baru dikirim ke email kontak. Sudah pernah login → 409 `ALREADY_LOGGED_IN` |

Aksi review hanya untuk status new atau fix_submitted dan memakai versi dokumen, sehingga keputusan ganda dari dua admin → 409 `REVIEW_CONFLICT`.

### Keuangan dan laporan

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /admin/refunds | status? | 200 maksimal 100 refund terbaru dengan eventTitle, orderCode, buyerName |
| POST /admin/refunds/:id/decision | approve (boolean), note 3–1.000 | 200 refund. Hanya status requested, selain itu 409 `ALREADY_REVIEWED`. Disetujui membatalkan tiket terkait, sudah ada pencairan → 409 `PAYOUT_EXISTS`. Pembeli menerima email |
| POST /admin/refunds/:id/transferred | transferReference 3–200, transferredAt (tidak di masa depan) | 204, refund menjadi refunded. Hanya status manual_required, selain itu 409 `NOT_MANUAL` |
| GET /admin/cancellations | — | 200 acara dengan pengajuan batal {id, title, organizerId, organizerName, reason, requestedAt}, terlama dulu |
| POST /admin/cancellations/:id/decision | approve, note 3–1.000 | 200 {id, status}. Disetujui membuat acara cancelled, menutup penjualan, dan membuat refund penuh. Tidak ada pengajuan → 409 `NOT_REQUESTED`, sudah ada pencairan → 409 `PAYOUT_EXISTS` |
| GET /admin/payouts | tab requested/transferred, page, limit 1–100 | 200 data {id, eventId, eventTitle, organizerName, amount, net, bank, accountNumber, holderName, status, requestedAt, transferredAt, transferReference}, meta, counts |
| POST /admin/payouts/:id/transferred | transferReference 3–200, transferredAt | 204, organizer menerima email. Sudah ditransfer → 409 `ALREADY_TRANSFERRED`, refund belum selesai → 409 `REFUNDS_PENDING`, tanggal sebelum pengajuan → 400 |
| GET /admin/reports | tab new/done, page, limit 1–100 | 200 data {id, eventTitle, organizerName, reason, createdAt, status}, meta, counts {new, done} |
| GET /admin/reports/:id | — | 200 detail laporan, reporter {email, isTicketHolder}, event {slug, title, startsAt, soldLabel}, organizer {id, name, username, recentReports} |
| POST /admin/reports/:id/close | note 1–2.000 | 204, pelapor menerima email. Sudah ditutup → 409 `REPORT_ALREADY_CLOSED` |

Nomor rekening pada daftar pencairan admin tampil lengkap karena dibutuhkan untuk transfer. Validasi body refund dan pencairan mengembalikan 400 `VALIDATION_ERROR` tanpa `fields`.

## Lain-lain

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| POST /orders/:id/cancel | — | 204. Sesi peserta dan CSRF. Hanya order pending dengan reservasi held, selain itu 409 `NOT_CANCELLABLE`. Order yang sudah dibatalkan tetap 204 |
| POST /orders/:orderId/tickets/resend | — | 204, email tiket dikirim ulang ke pembeli. Hanya order issued milik sendiri, jeda 60 detik, selain itu 409 `RESEND_UNAVAILABLE` |
| GET /tickets/shared/:token | — | 200 detail tiket beserta qrPayload. Publik, token adalah qrToken 43 karakter. Respons no-store dan no-referrer. Token salah → 404 |
| GET /me/saved-events | page, limit 1–100 | 200 kartu acara tersimpan {slug, title, category, startsAt, venueName, poster, startingPrice, saved, status, highlight?} dan meta. Acara mendatang lebih dulu. Sesi peserta |
| PUT /me/saved-events/:slug | — | 204, idempoten. Hanya acara published, selain itu 404. CSRF |
| DELETE /me/saved-events/:slug | — | 204, idempoten. CSRF |
| GET /organizers/:username/profile | — | 200 username, name, city, since, description, links, eventCount, upcoming, past. Publik, hanya acara published |
| POST /events/:slug/reports | reason fraud/wrong_info/inappropriate/other, note maksimum 1.000 | 201 {submitted: true}. Sesi peserta dan CSRF. reason other memerlukan note minimal 10 karakter. Acara harus published atau cancelled. Laporan terbuka yang sama dari pengguna yang sama → 409 `REPORT_EXISTS` |
| GET /media/:id | — | 302 ke URL bertanda tangan. Publik, hanya aset non-privat, Cache-Control private max-age=60. Aset tidak ada → 404 |
| POST /realtime/ticket | — | 200 {token}. Sesi peserta atau workspace dengan CSRF. Token sekali pakai berlaku 30 detik untuk handshake socket lewat query `ticket` |

Status kartu acara bernilai on_sale, sold_out, not_open, closed, ended, atau cancelled. highlight almost_sold_out muncul saat sisa kuota di bawah 10 persen. Acara dari organizer yang dibekukan tampil closed.

Pembatalan order dengan sesi pembayaran yang sudah dibuat meminta pembatalan ke Midtrans lalu memeriksa status provider. Status belum pasti → 409 `CANCELLATION_PENDING` dan reservasi tetap ditahan, ternyata sudah dibayar → 409 `ALREADY_PAID`.

## Kode error stabil

| code | HTTP | FE harus melakukan |
| --- | --- | --- |
| VALIDATION_ERROR | 400 | Tampilkan fields dan pertahankan input |
| UNAUTHENTICATED | 401 | Login dengan return destination |
| FORBIDDEN / CSRF_INVALID | 403 | Hentikan aksi; refresh sesi bila sesuai |
| NOT_FOUND | 404 | Jangan bocorkan resource orang lain |
| SOLD_OUT / SALES_CLOSED | 409 | Perbarui pilihan tiket |
| IDEMPOTENCY_CONFLICT | 409 | Jangan ulang key dengan payload baru |
| ORDER_NOT_PAYABLE | 409 | Ambil status order terbaru |
| TICKET_ALREADY_USED | 409 | Tampilkan waktu check-in dari details; tanpa menambah hitungan |
| WRONG_EVENT / CHECKIN_CLOSED | 409 | Jelaskan event/waktu tidak sesuai; jangan bocorkan nama dari event lain |
| INVALID_TICKET | 404 | Scan/lookup ulang |
| PROVIDER_UNAVAILABLE | 503 | Retry status dengan backoff, jangan bayar lagi |
| RATE_LIMITED | 429 | Tunda percobaan dan tampilkan pesan coba lagi nanti |
| CONFLICT | 409 | Muat ulang data lalu ulangi aksi |
| INTERNAL_ERROR | 500 | Tampilkan error umum dengan requestId |
| FILE_TOO_LARGE / INVALID_UPLOAD / INVALID_FILE_TYPE | 400 | Minta berkas lain sesuai jenis dan batas ukuran |
| INVALID_IMAGE / INVALID_ASSET | 400 | Minta gambar lain milik organizer |
| STORAGE_UNAVAILABLE | 503 | Coba unggah lagi nanti |
| INVALID_PASSWORD / WRONG_PASSWORD | 400 | Tandai field kata sandi saat ini |
| PASSWORD_REUSED | 400 | Minta kata sandi baru yang berbeda |
| PASSWORD_LOCKED / ACCOUNT_LOCKED | 429 | Tampilkan masa tunggu 10 menit |
| PASSWORD_REQUIRED | 409 | Arahkan membuat kata sandi sebelum memutus Google |
| PASSWORD_CHANGE_REQUIRED | 403 | Arahkan ke halaman ganti kata sandi pertama |
| TOKEN_INVALID / RESET_EXPIRED | 410 | Minta tautan reset baru |
| TEMPORARY_PASSWORD_EXPIRED | 410 | Minta organizer atau admin mengirim akses baru |
| ACCOUNT_HAS_ACTIVE_TICKETS / ACCOUNT_IS_ORGANIZER | 409 | Jelaskan alasan akun belum dapat dihapus |
| ORGANIZER_FROZEN | 403 | Tampilkan status dibekukan dan nonaktifkan aksi ubah |
| USERNAME_TAKEN | 409 | Tandai username dan tawarkan alternatif |
| MEMBER_LIMIT | 409 | Jelaskan batas 100 anggota |
| INVALID_EVENTS / INVALID_MEMBERS | 400 | Muat ulang daftar acara atau anggota |
| CHALLENGE_INVALID | 401 | Kembali ke langkah login admin |
| CODE_INVALID | 401 | Minta kode ulang tanpa mengosongkan form |
| CHALLENGE_USED | 409 | Kembali ke langkah login admin |
| FILE_REQUIRED / INVALID_DOCUMENT / LEGAL_REQUIRED | 400 | Tandai field dokumen pengajuan |
| DOCUMENT_CLAIMED | 409 | Unggah ulang dokumen |
| APPLICATION_EXISTS | 409 | Tampilkan nomor pengajuan dari details.number |
| ALREADY_ORGANIZER | 409 | Arahkan ke login workspace |
| REAPPLICATION_WAIT | 409 | Jelaskan masa tunggu 30 hari setelah ditolak |
| VERIFICATION_EXPIRED | 410 | Jelaskan tautan verifikasi tidak berlaku |
| NOT_NEEDS_FIX | 409 | Tampilkan status pengajuan terkini |
| FIX_EXPIRED | 410 | Jelaskan tenggat atau sesi perbaikan habis |
| FIELD_NOT_FLAGGED / FIX_INCOMPLETE | 400 | Kirim tepat field yang ditandai admin |
| REVIEW_CONFLICT | 409 | Muat ulang pengajuan sebelum memutuskan |
| EMAIL_NOT_VERIFIED / FLAGS_EXIST | 409 | Tahan persetujuan dan tampilkan alasannya |
| ALREADY_LOGGED_IN | 409 | Sembunyikan aksi kirim ulang akses |
| EVENT_CANCELLED | 409 | Tampilkan acara dibatalkan dan nonaktifkan aksi |
| EVENT_ENDED / CANCELLATION_EXISTS | 409 | Muat ulang status acara |
| CONFIRMATION_MISMATCH | 400 | Minta judul acara diketik persis |
| HAS_ORDERS | 409 | Jelaskan data yang sudah punya pesanan tidak dapat dihapus |
| REFUND_DEADLINE | 409 | Jelaskan batas pengajuan satu bulan sebelum acara |
| NOT_REFUNDABLE / INVALID_TICKETS | 409 | Muat ulang order dan pilihan tiket |
| REFUND_EXISTS | 409 | Tampilkan refund yang sedang berjalan |
| PAYOUT_EXISTS | 409 | Jelaskan pencairan sudah diajukan untuk acara ini |
| ALREADY_REVIEWED / NOT_REQUESTED / NOT_MANUAL | 409 | Muat ulang antrean admin |
| INVALID_STATE / REFUND_OVERFLOW | 409 | Hentikan aksi dan laporkan untuk rekonsiliasi |
| PAYOUT_UNAVAILABLE / NO_BALANCE | 409 | Tampilkan status pencairan terkini |
| REFUNDS_PENDING | 409 | Tunggu refund selesai sebelum pencairan |
| BANK_REQUIRED | 409 | Arahkan ke pengaturan rekening |
| ALREADY_TRANSFERRED | 409 | Muat ulang daftar pencairan |
| NOT_CANCELLABLE / PAYMENT_CHANGED / ALREADY_PAID | 409 | Ambil status order terbaru |
| CANCELLATION_PENDING | 409 | Tampilkan pembatalan sedang diverifikasi dan poll status |
| RECONCILIATION_REQUIRED | 409 | Tampilkan error umum, perlu tindakan operator |
| RESEND_UNAVAILABLE | 409 | Nonaktifkan tombol kirim ulang selama 60 detik |
| REPORT_EXISTS | 409 | Jelaskan laporan sebelumnya masih ditinjau |
| REPORT_ALREADY_CLOSED | 409 | Muat ulang daftar laporan |

Untuk duplicate scan, error dapat memiliki `details: {checkedInAt}` selain fields. Penolakan format/token tidak menampilkan raw token pada pesan/log. Implementasi Swagger/OpenAPI tersedia di `apps/backend/src/docs/swagger-spec.ts` dan dapat dilihat pada [Swagger produksi](https://api.gatherlyy.fun/api/v1/docs/). Dokumen kontrak ini tetap menjadi acuan kerja; cocokkan perubahan endpoint dengan source dan OpenAPI sebelum integrasi frontend.
