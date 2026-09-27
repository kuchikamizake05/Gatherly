# Desain Atomic Ticket Check-in

## Tujuan

Menyelesaikan issue #18 dengan menyediakan operasi check-in yang aman untuk QR dan kode tiket. Operasi harus memvalidasi acara, assignment panitia, waktu masuk, pembayaran, dan status sekali pakai tanpa race condition.

Tahap ini juga mencakup pencarian tiket terbatas dan riwayat kehadiran untuk mendukung alur scanner panitia. Ringkasan dan laporan organizer tetap menjadi cakupan issue #20.

## Pendekatan

Check-in memakai transaksi MongoDB yang membaca dan menulis assignment panitia serta tiket. Pendekatan ini mengoordinasikan check-in dengan pencabutan assignment. Validasi assignment di luar transaksi meninggalkan celah race, sedangkan lock per event akan mengantrekan semua petugas dan menambah komponen baru.

## Perubahan model data

`CommitteeAssignment` memperoleh `checkInVersion` dengan nilai awal nol. Setiap check-in menyentuh field ini di dalam transaksi. Penghapusan assignment yang berjalan bersamaan akan berkonflik pada dokumen yang sama; transaksi kemudian mengulang validasi terhadap state terbaru.

`Ticket` memperoleh `checkedInBy`, referensi ke akun panitia. Indeks riwayat tiket menjadi `(eventId, checkInStatus, checkedInAt, _id)` agar query newest-first efisien.

## Operasi check-in

### `POST /api/v1/committee/events/:eventId/check-ins`

Endpoint memerlukan sesi dan CSRF token. Body harus memuat tepat salah satu bentuk berikut:

```json
{"qrPayload":"gatherly:v1:<random-token>"}
```

```json
{"ticketCode":"GTH-T-..."}
```

Server memperlakukan QR sebagai data, bukan URL. Server tidak menulis credential mentah ke log atau pesan error.

Di dalam satu transaksi, service:

1. memastikan event ID valid dan event tersedia;
2. menemukan assignment pengguna pada event lalu menaikkan `checkInVersion`;
3. memastikan waktu server berada dalam rentang 30 menit sebelum `startsAt` hingga `endsAt`, inklusif pada kedua batas;
4. mencari tiket berdasarkan `qrToken` atau `ticketCode`;
5. memastikan tiket berasal dari event yang diminta;
6. memastikan order tiket masih memiliki `paymentStatus=paid` dan `issuanceStatus=issued`;
7. mengubah tiket secara kondisional dari `unused` menjadi `used`, lalu menyimpan waktu server dan akun panitia.

Satu transaksi yang menang mengembalikan 200. Scan bersamaan yang kalah membaca state terbaru dan mengembalikan `TICKET_ALREADY_USED`; transaksi tersebut tidak menambah kehadiran. Waktu check-in pertama tetap menjadi sumber kebenaran.

Respons sukses berisi:

```json
{
  "data": {
    "ticketId": "507f1f77bcf86cd799439013",
    "attendeeName": "Alya Putri",
    "ticketTypeName": "Reguler",
    "checkInStatus": "used",
    "checkedInAt": "2026-10-24T08:45:00.000Z"
  }
}
```

## Pencarian tiket panitia

### `GET /api/v1/committee/events/:eventId/tickets`

Endpoint memeriksa assignment pada setiap request. Query menerima `q`, `page`, dan `limit`. `q` mencari sebagian nama peserta, kode tiket, nama jenis tiket, atau status check-in secara case-insensitive di dalam event tersebut.

Setiap hasil berisi ticket ID, ticket code, attendee name, ticket type name, check-in status, dan checked-in time. Respons tidak berisi buyer email, nilai transaksi, payment timeline, `qrToken`, atau `qrPayload`.

## Riwayat check-in

### `GET /api/v1/committee/events/:eventId/check-ins`

Endpoint memeriksa assignment pada setiap request, termasuk setelah event berakhir. Query menerima `page` dan `limit`. Hasil hanya memuat tiket `used` dari event tersebut, urut berdasarkan `checkedInAt` menurun lalu ID menurun.

Setiap item berisi ticket ID, ticket code, attendee name, ticket type name, checked-in time, dan `checkedInBy:{id,name}`. Metadata memuat:

- `page` dan `limit`;
- `total`, jumlah seluruh check-in sukses pada event;
- `paidTickets`, jumlah unit dari seluruh order paid pada event;
- `generatedAt`, waktu server menghasilkan respons.

Pagination tidak mengubah nilai `total` atau `paidTickets`. Scan gagal tidak muncul dalam riwayat.

## Otorisasi dan race pencabutan akses

Endpoint GET membaca assignment aktif dari database pada setiap request. Endpoint POST mengulang pemeriksaan assignment di dalam transaksi dan menulis dokumen assignment yang sama.

Penghapusan assignment memakai operasi delete pada dokumen tersebut. Jika penghapusan berlomba dengan check-in, write conflict membuat salah satu transaksi mengulang. Check-in hanya berhasil bila assignment masih ada pada state yang akhirnya dikomit. Request berikutnya selalu mendapat `FORBIDDEN` setelah assignment dihapus.

## Error stabil

- `400 VALIDATION_ERROR`: body tidak valid, kedua credential dikirim, atau format QR salah.
- `401 UNAUTHENTICATED`: sesi tidak tersedia atau kedaluwarsa.
- `403 CSRF_INVALID`: CSRF token tidak valid pada POST.
- `403 FORBIDDEN`: pengguna tidak memiliki assignment aktif.
- `404 INVALID_TICKET`: credential tidak dikenal atau order tiket tidak lagi memenuhi syarat.
- `409 WRONG_EVENT`: credential valid untuk event lain; respons tidak memuat data peserta.
- `409 CHECKIN_CLOSED`: request berada di luar jendela check-in.
- `409 TICKET_ALREADY_USED`: tiket sudah dipakai; `details.checkedInAt` memuat waktu pertama.

Kegagalan database atau koneksi memakai error layanan umum. Server tidak menerjemahkannya menjadi tiket invalid atau check-in berhasil.

## Struktur implementasi

Perubahan utama ditempatkan pada:

- model assignment untuk `checkInVersion`;
- model tiket untuk `checkedInBy` dan indeks riwayat;
- `backend/src/modules/check-ins/check-in.schemas.ts` untuk validasi input;
- `backend/src/modules/check-ins/check-in.service.ts` untuk transaksi dan query;
- `backend/src/modules/check-ins/check-in.routes.ts` untuk ketiga endpoint panitia;
- error middleware untuk mendukung `details` yang aman pada duplicate scan.

## Pengujian

Integration test harus membuktikan:

- QR dan kode manual mengubah tiket valid menjadi `used`;
- waktu tepat pada kedua batas diterima, sedangkan waktu di luar rentang ditolak;
- tiket event lain menghasilkan `WRONG_EVENT` tanpa data peserta;
- credential asing dan order yang tidak paid ditolak;
- dua scan bersamaan menghasilkan tepat satu sukses;
- scan ulang mengembalikan waktu check-in pertama dan tidak menambah jumlah;
- assignment yang dicabut menolak pencarian, riwayat, dan check-in;
- pencabutan assignment yang berlomba dengan check-in tidak meloloskan akses lama;
- pencarian dan riwayat tidak membocorkan credential atau data pembayaran;
- pagination mempertahankan `total` dan `paidTickets` untuk seluruh event.

Seluruh integration test, typecheck, dan build backend harus lulus sebelum branch dipush.

## Kriteria selesai

Issue #18 selesai ketika panitia yang masih ditugaskan dapat mencari dan memvalidasi tiket pada jendela acara, setiap tiket hanya diterima sekali dalam kondisi concurrent, pencabutan akses berlaku aman, dan riwayat menampilkan kehadiran tanpa data sensitif.
