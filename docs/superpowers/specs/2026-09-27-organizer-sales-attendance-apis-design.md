# Desain API Penjualan dan Kehadiran Organizer

## Tujuan

Menyelesaikan bagian backend issue #20 dengan lima API terotorisasi untuk ringkasan penjualan, inventori event, daftar dan detail order, serta daftar peserta. API harus menghitung data dari sumber kebenaran server dan mencegah akses lintas organizer.

Tahap ini tidak mencakup tampilan frontend, PDF, atau ekspor CSV. Nasta mengerjakan view frontend dengan API yang disediakan tahap ini.

## Pendekatan

API memakai agregasi langsung pada MongoDB. Pendekatan ini memberikan data terkini tanpa counter turunan yang harus disinkronkan pada setiap pembayaran dan check-in. Data rinci tetap memakai pagination agar server tidak memuat seluruh koleksi ke memori.

Setiap endpoint memerlukan sesi dan profil organizer. Filter kepemilikan berasal dari `organizerId` dalam sesi; client tidak dapat mengirim organizer ID. Event selalu dicari dengan `_id` dan `organizerId`. Event milik organizer lain, event asing, dan ID yang tidak ada menghasilkan respons 404 yang sama.

## Ringkasan organizer

### `GET /api/v1/organizer/summary`

Query opsional menerima `from` dan `to` dalam ISO 8601 UTC. Rentang memakai semantik `[from, to)`: `from` inklusif dan `to` eksklusif. Jika kedua batas tersedia, `from` harus lebih kecil dari `to`. Batas yang tidak dikirim tidak membatasi sisi tersebut.

Respons memuat:

- `publishedEvents`, jumlah event published milik organizer saat query dijalankan, termasuk event yang sudah berakhir;
- `paidTickets`, jumlah `quantity` dari order paid milik event organizer dengan `paidAt` dalam rentang;
- `grossPaidSales`, jumlah `totalAmount` dari order yang sama;
- `period:{from,to,basis:"paidAt"}`, dengan `null` untuk batas yang tidak diberikan;
- `generatedAt`, waktu server menghasilkan respons.

Periode hanya memengaruhi metrik order. `publishedEvents` selalu menunjukkan keadaan terkini. Organizer tanpa data menerima 200 dengan angka nol.

## Ringkasan event

### `GET /api/v1/organizer/events/:eventId/summary`

Respons menjumlahkan seluruh ticket type event menjadi:

- `capacity`;
- `reserved`;
- `sold`;
- `available = capacity - reserved - sold`;
- `checkedIn`, jumlah tiket berstatus `used`;
- `grossPaidSales`, jumlah `totalAmount` order paid untuk event;
- `generatedAt`.

Event tanpa ticket type, order, atau check-in menghasilkan nol. Nilai penjualan berasal dari order, bukan hasil join tiket, sehingga order multi-tiket tidak menggandakan pendapatan.

## Daftar order

### `GET /api/v1/organizer/events/:eventId/orders`

Query menerima `q`, `paymentStatus`, `page`, dan `limit`. `q` mencari sebagian `orderCode` atau nama pembeli secara case-insensitive. `paymentStatus` menerima `pending`, `paid`, `failed`, atau `expired`.

Setiap item berisi ID, order code, ringkasan pembeli, ticket type snapshot, quantity, total amount, currency, status pembayaran/reservasi/penerbitan, created time, expiry time, dan paid time. Respons tidak memuat `snapToken`, `redirectUrl`, idempotency key, request hash, lease worker, atau data provider.

## Detail order

### `GET /api/v1/organizer/events/:eventId/orders/:orderId`

Server memastikan event dimiliki organizer dan order berasal dari event tersebut. Respons berisi:

- ID dan order code;
- buyer `{name,email}`;
- event dan ticket type snapshot;
- quantity, attendees, unit price, total amount, dan currency;
- payment, reservation, dan issuance status;
- created, expiry, dan paid time;
- timeline pembayaran terverifikasi, urut kronologis;
- tickets `{id,ticketCode,attendeeName,checkInStatus,checkedInAt}`.

Detail tidak memuat Snap token, redirect URL, signature, payload provider, `qrToken`, atau `qrPayload`. Order dari event lain menghasilkan 404 meskipun kedua event dimiliki organizer yang sama.

## Daftar peserta

### `GET /api/v1/organizer/events/:eventId/attendees`

Query menerima `q`, `checkInStatus`, `page`, dan `limit`. `q` mencari sebagian nama peserta, ticket code, atau nama ticket type secara case-insensitive. `checkInStatus` menerima `unused` atau `used`.

Setiap item berisi ticket ID, ticket code, attendee name, ticket type name, check-in status, checked-in time, dan checked-in-by bila tersedia. Respons tidak berisi buyer email, nominal transaksi, payment timeline, `qrToken`, atau `qrPayload`.

## Validasi dan error

- `400 VALIDATION_ERROR`: tanggal bukan ISO 8601 dengan offset, `from >= to`, status tidak dikenal, query terlalu panjang, atau pagination salah.
- `401 UNAUTHENTICATED`: sesi tidak tersedia atau kedaluwarsa.
- `403 FORBIDDEN`: akun tidak memiliki profil organizer.
- `404 NOT_FOUND`: event atau order tidak tersedia dalam scope organizer.

Pencarian memperlakukan input sebagai teks literal, bukan regex mentah. API tidak memasukkan credential atau data pribadi ke pesan error.

## Struktur implementasi

Perubahan utama ditempatkan pada:

- `backend/src/modules/reports/organizer-report.schemas.ts` untuk query validation;
- `backend/src/modules/reports/organizer-report.service.ts` untuk scope, agregasi, dan DTO aman;
- `backend/src/modules/reports/organizer-report.routes.ts` untuk lima endpoint;
- bootstrap Express untuk memasang router tanpa mengubah endpoint event yang ada.

## Pengujian

Integration test harus membuktikan:

- organizer hanya melihat event dan metrik miliknya;
- paid tickets menjumlahkan quantity dan gross sales menjumlahkan total amount satu kali;
- pending, failed, dan expired tidak masuk penjualan;
- batas `from` inklusif dan `to` eksklusif berdasarkan `paidAt`;
- periode tidak mengubah `publishedEvents`;
- organizer tanpa data mendapat angka nol;
- inventori dan jumlah check-in event dihitung benar;
- pencarian, status filter, pagination, dan total bekerja;
- detail order hanya menerima pasangan event-order yang benar;
- listing dan detail tidak membocorkan credential pembayaran atau QR;
- attendee listing tidak membocorkan buyer email atau nominal.

Seluruh integration test, typecheck, dan build backend harus lulus sebelum branch dipush.

## Kriteria selesai

Bagian backend issue #20 selesai ketika organizer dapat membaca penjualan, inventori, order, dan kehadiran hanya untuk event miliknya; seluruh agregasi mengikuti kontrak; serta respons tidak membocorkan credential atau data di luar kebutuhan operasional.
