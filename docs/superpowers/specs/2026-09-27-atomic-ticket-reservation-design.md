# Desain model order dan reservasi tiket atomik

Tanggal: 27 September 2026  
Issue: #4 dan #11  
Pemilik: Dien (BE 2)

## Tujuan

Tahap ini membangun fondasi order dan reservasi tiket selama 15 menit. Implementasi harus menghitung harga di server, membatasi satu order pada satu jenis tiket dengan 1–4 peserta, mencegah overselling, dan membuat retry aman melalui idempotency key.

Tahap ini menyediakan tiga endpoint:

- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`

## Batas scope

Tahap ini tidak membuat sesi Midtrans, memproses webhook, melepas reservasi expired, mengubah reserved menjadi sold, menerbitkan tiket QR, melakukan check-in, atau menyajikan laporan organizer. Issue #12–#14, #18, dan #20 menangani perilaku tersebut.

Order yang melewati `expiresAt` tetap tersimpan dengan reservasi held sampai proses rekonsiliasi pada #13 memastikan order tidak dapat dibayar. Aplikasi tidak melepas kuota berdasarkan timer browser atau waktu database saja.

## Arsitektur

Modul order memisahkan transport HTTP, validasi, model, dan transaksi:

```text
backend/src/modules/orders/
├── order.model.ts
├── order.schemas.ts
├── order.service.ts
└── order.routes.ts
```

- `order.routes.ts` menangani autentikasi, CSRF, status HTTP, dan serialisasi respons.
- `order.schemas.ts` memvalidasi body, query, parameter, dan `Idempotency-Key`.
- `order.service.ts` menjalankan idempotency check dan transaksi reservasi.
- `order.model.ts` menetapkan schema, status kanonis, dan indeks.

Route tidak mengubah counter inventori secara langsung. Service transaksi menjadi satu-satunya jalur pembuatan order payable.

## Model order

Order menyimpan field berikut:

- Referensi: `buyerId`, `eventId`, dan `ticketTypeId`.
- Pembelian: `quantity`, `attendees`, `unitPrice`, `totalAmount`, dan `currency`.
- Snapshot: identitas pembeli; judul, waktu, zona waktu, dan lokasi acara; serta nama jenis tiket dan harga.
- Status: `paymentStatus`, `reservationStatus`, `issuanceStatus`, dan `paymentSessionState`.
- Masa berlaku: `expiresAt` dan timestamp dokumen.
- Idempotency: `idempotencyKey` dan `requestHash`.
- Identitas: `orderCode` dan `providerOrderId` yang stabil.
- Integrasi berikutnya: `paymentTimeline`, `nextReconcileAt`, dan `leaseUntil`.

Nilai awal order:

| Field | Nilai |
| --- | --- |
| paymentStatus | `pending` |
| reservationStatus | `held` |
| issuanceStatus | `not_ready` |
| paymentSessionState | `not_started` |
| currency | `IDR` |
| expiresAt | waktu server + 15 menit |

Indeks yang diperlukan:

- Unique `(buyerId, idempotencyKey)`.
- Unique `providerOrderId`.
- Unique `orderCode`.
- `(buyerId, createdAt)` untuk daftar order.
- `(paymentStatus, nextReconcileAt)` untuk rekonsiliasi berikutnya.
- `(eventId, paymentStatus, paidAt)` untuk laporan organizer berikutnya.

Event memperoleh `checkoutVersion`. Transaksi checkout menaikkan versi ini sebelum membuat order. Mutasi yang mengubah kelayakan checkout—publish, penutupan penjualan, dan penghapusan event—menulis dokumen event yang sama agar operasi serentak memicu konflik transaksi dan validasi ulang. Perubahan kapasitas atau periode penjualan menulis dokumen ticket type yang sama dengan transaksi checkout sehingga MongoDB juga mendeteksi konflik tulis. Perubahan terarah pada route event diperlukan untuk menjaga protokol bersama ini; aturan bisnis selain gate checkout tetap berada di modul event.

## Pembuatan order

`POST /api/v1/orders` menjalankan alur berikut:

1. Verifikasi session dan CSRF.
2. Validasi `Idempotency-Key` sebagai UUID serta validasi body.
3. Bentuk hash deterministik dari payload yang sudah dinormalisasi.
4. Cari order dengan pasangan buyer dan idempotency key.
5. Kembalikan order lama dengan status 200 jika hash cocok; kembalikan `409 IDEMPOTENCY_CONFLICT` jika hash berbeda.
6. Mulai MongoDB transaction.
7. Baca ticket type dan event di dalam transaction.
8. Validasi event published, sales belum ditutup, event belum berakhir, periode penjualan aktif, dan kuota mencukupi.
9. Hitung `unitPrice` dan `totalAmount` dari ticket type di database.
10. Tambahkan `reserved` secara bersyarat dan buat order beserta snapshot.
11. Commit transaction dan kembalikan order baru dengan status 201.

Jika dua request dengan key sama berlomba, unique index memilih satu pemenang. Request yang kalah membaca order pemenang setelah transaction rollback, lalu membandingkan `requestHash`.

Transient transaction errors menjalani retry terbatas. Setiap retry membaca dan memvalidasi ulang event serta ticket type. Kegagalan setelah batas retry menghasilkan error layanan tanpa meninggalkan order atau perubahan counter parsial.

## Aturan bisnis

- `quantity` berupa integer 1–4.
- `attendees.length` harus sama dengan `quantity`.
- Nama peserta berisi 2–100 karakter setelah trim.
- Client tidak dapat menentukan buyer, harga, total, currency, status, atau expiry.
- Event harus published dan belum berakhir.
- `salesClosed` harus false.
- Waktu server harus berada pada rentang penjualan ticket type.
- `capacity - reserved - sold` harus sekurang-kurangnya sama dengan quantity.
- Semua counter harus nonnegatif.

Invariant inventori:

```text
capacity = available + reserved + sold
```

## Pembacaan order

`GET /api/v1/orders` mengembalikan order milik pengguna aktif dengan pagination stabil. `GET /api/v1/orders/:id` juga membatasi pembacaan pada buyer aktif. ID yang tidak ada atau dimiliki pengguna lain menghasilkan 404 agar API tidak membocorkan keberadaan resource.

`OrderDTO` mengikuti `docs/api-contract.md`. Respons mencakup `serverTime`, `expiresAt`, `isVerifying`, `canResumePayment`, dan `ticketIds`. Pada tahap ini `ticketIds` kosong dan `isVerifying` false. `canResumePayment` menunjukkan kelayakan order menurut state server, tetapi tidak membuat sesi Midtrans.

Respons tidak mengembalikan `requestHash`, lease worker, atau credential provider.

## Error API

| HTTP | Code | Kondisi |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Header, body, UUID, atau pagination tidak valid |
| 401 | `UNAUTHENTICATED` | Session tidak ada atau expired |
| 403 | `CSRF_INVALID` | Token CSRF hilang atau tidak valid |
| 404 | `NOT_FOUND` | Event, ticket type, atau order tidak tersedia bagi pengguna |
| 409 | `SOLD_OUT` | Kuota tidak mencukupi |
| 409 | `SALES_CLOSED` | Event atau periode penjualan tidak menerima order baru |
| 409 | `IDEMPOTENCY_CONFLICT` | Key yang sama membawa payload berbeda |
| 503 | `SERVICE_UNAVAILABLE` | Transaksi tetap gagal setelah retry terbatas |

## Pengujian

Integration test memakai cluster Atlas dan database `gatherly_test` melalui konfigurasi test terpisah. Setup test harus memeriksa bahwa nama database tepat `gatherly_test` sebelum menghapus data. Test berhenti jika guard gagal.

Kasus wajib:

1. Reservasi valid membuat satu order dan menambah reserved sesuai quantity.
2. Harga dan total berasal dari database, bukan body client.
3. Retry dengan key dan payload yang sama mengembalikan order lama tanpa menambah reserved.
4. Key yang sama dengan payload berbeda menghasilkan 409.
5. Quantity, peserta, header, dan ID yang tidak valid menghasilkan 400.
6. Draft event, sales tertutup, periode tidak aktif, dan event berakhir menolak checkout.
7. Kuota tidak cukup menghasilkan `SOLD_OUT` tanpa membuat order.
8. Dua buyer yang berebut slot terakhir menghasilkan tepat satu order dan counter konsisten.
9. Perubahan kapasitas yang berlomba dengan checkout tidak menghasilkan overselling.
10. Pengguna tidak dapat membaca order milik pengguna lain.

Test membaca ulang order dan ticket type setelah setiap skenario untuk membuktikan invariant, bukan hanya memeriksa status HTTP.

## Kriteria selesai

- Ketiga endpoint mengikuti kontrak API dan aturan akses.
- Idempotent retry tidak menggandakan order atau reserved.
- Concurrent checkout tidak menjual kuota melebihi capacity.
- Harga, snapshot, status, dan expiry ditentukan server.
- Integration test nyata lulus pada `gatherly_test`.
- Typecheck dan build backend lulus.
- Request dan contoh respons dapat dimasukkan ke Postman collection Milestone 1.
