# Gatherly — Kontrak API v1 (draft kerja)

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
| POST /auth/register | name, email, password | 201 user; login dilakukan terpisah. Nama 2–100 karakter, email valid/normalisasi, password 12–128 karakter. Tidak menerima role |
| POST /auth/login | email, password | 200 user + csrfToken dan cookie; kredensial salah → 401 generik |
| GET /auth/me | — | user, organizerId nullable, hasCommitteeAssignments, csrfToken; 401 tanpa sesi |
| POST /auth/logout | — | 204; invalidasi sesi dan cookie |
| POST /organizers | name, description, contactEmail | 201 profil sendiri; duplikat → 409 |
| GET /organizers/me | — | Profil sendiri; 404 bila belum dibuat |

## Acara dan upload — BE 1

| Method/path | Input | Hasil/akses |
| --- | --- | --- |
| GET /events | q, city, category, from, to, minPrice, maxPrice, sort=date_asc atau price_asc, page, limit | Katalog published belum ended; startingPrice dari tipe yang dapat dibeli sekarang, nullable bila tidak ada |
| GET /events/:slug | — | Detail publik + jenis tiket, available, availabilityStatus; draf → 404 |
| GET /organizer/events | status=draft/published/ended, page, limit | Acara milik organizer |
| POST /organizer/events | title, description, category, startsAt, endsAt, timezone, venueName, address, city, posterAssetId? | 201 draf; organizer wajib; slug dibuat server |
| GET /organizer/events/:id | — | Detail editor milik organizer |
| PATCH /organizer/events/:id | Subset field acara atau salesClosed | Update tervalidasi; field terkunci setelah paid → 409 |
| DELETE /organizer/events/:id | — | 204 hanya draf tanpa order; konflik → 409 |
| POST /organizer/events/:id/publish | — | 200 published; wajib poster, data lengkap, minimal satu tipe valid |
| POST /organizer/events/:id/ticket-types | name, description, price, capacity, salesStartsAt, salesEndsAt | 201 tipe baru; harga integer > 0, kapasitas integer > 0 |
| PATCH /organizer/events/:id/ticket-types/:typeId | Subset field tipe | 200; kapasitas >= sold + reserved; typeId harus milik event |
| DELETE /organizer/events/:id/ticket-types/:typeId | — | 204 hanya tipe tanpa order; 409 bila sudah direferensikan |
| POST /organizer/posters | Multipart field file | 201 assetId + url; JPEG/PNG/WebP, maksimum 5 MB; periksa isi, bukan ekstensi saja; organizer login |

Acara baru: title/venue/city nonempty, description nonempty, kategori dari daftar tetap, timezone IANA valid, endsAt > startsAt, startsAt masa depan ketika dibuat/publish. Rentang penjualan salesStartsAt < salesEndsAt <= startsAt acara. Draft boleh belum memiliki poster/tiket. Semua mutasi nested memeriksa ownership kedua resource.

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
| POST /organizer/events/:id/committee | email | 201 assignment akun existing; 404 akun tak ada, 409 duplikat | BE 1 |
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

Untuk duplicate scan, error dapat memiliki `details: {checkedInAt}` selain fields. Penolakan format/token tidak menampilkan raw token pada pesan/log. Swagger/OpenAPI dapat diturunkan dari dokumen ini saat implementasi, lalu diuji bersama FE; belum ada klaim schema machine-readable lengkap.
