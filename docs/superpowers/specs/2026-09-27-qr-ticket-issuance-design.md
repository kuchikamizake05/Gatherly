# Desain Penerbitan Tiket QR

## Tujuan

Menyelesaikan issue #14 dengan menerbitkan satu tiket digital untuk setiap peserta setelah pembayaran order terkonfirmasi. Proses harus tahan terhadap retry, dua worker yang berjalan bersamaan, dan kegagalan di tengah proses tanpa menghasilkan tiket ganda.

Tahap ini mencakup penerbitan dan pengambilan tiket milik pembeli. Validasi check-in merupakan cakupan issue #18, sedangkan laporan merupakan cakupan issue #20.

## Alur utama

1. Rekonsiliasi pembayaran mengubah order menjadi `paid` dan fase pemenuhan menjadi `converted`.
2. Worker penerbitan mengambil order yang siap diproses dengan lease khusus penerbitan.
3. Worker membuat satu tiket untuk setiap urutan peserta pada order.
4. Setelah jumlah tiket persis sama dengan kuantitas order, worker mengubah fase pemenuhan menjadi `issued`.
5. Pembeli dapat melihat daftar tiket dan membuka detail tiket beserta payload QR melalui API terautentikasi.

Penerbitan tidak dilakukan langsung di webhook. Dengan worker durable, webhook tetap cepat dan kegagalan sementara dapat dipulihkan melalui retry.

## Model data tiket

Setiap dokumen tiket menyimpan:

- `orderId`, `eventId`, `buyerId`, dan `ticketTypeId` sebagai referensi;
- `sequence`, dimulai dari nol dan unik di dalam satu order;
- `attendeeName`, diambil dari data peserta pada order;
- `ticketCode`, kode acak ramah baca untuk tampilan dan dukungan operasional;
- `qrToken`, token acak rahasia yang menjadi kredensial check-in;
- `checkInStatus`, dengan nilai awal `unused`;
- `checkedInAt`, kosong sebelum check-in;
- `createdAt` dan `updatedAt`.

Indeks unik `(orderId, sequence)` menjamin satu tiket per peserta walaupun worker mengulang proses. `ticketCode` dan `qrToken` juga memiliki indeks unik global.

## Keamanan QR

`qrToken` dibuat dari 32 byte acak kriptografis dan dikodekan sebagai base64url. Payload QR berbentuk:

```text
gatherly:v1:<qrToken>
```

Token tidak memuat ID database, nomor urut, atau data pribadi yang mudah ditebak. Backend hanya mengembalikan payload QR pada endpoint detail milik pembeli. Endpoint daftar tidak mengirim `qrToken` maupun payload QR untuk mengurangi paparan kredensial. Frontend bertanggung jawab merender payload menjadi gambar QR dan, bila perlu, menyiapkan tampilan cetak.

## Worker penerbitan

Order memiliki metadata retry yang terpisah dari rekonsiliasi pembayaran:

- `issuanceLeaseUntil`;
- `issuanceNextAttemptAt`;
- `issuanceAttempts`;
- `issuanceLastError`.

Worker memilih order `paid` dengan fase `converted` atau `processing`, jadwal retry yang telah jatuh tempo, dan lease yang kosong atau kedaluwarsa. Pengambilan order dilakukan secara atomik, lalu fase diubah menjadi `processing`.

Di dalam transaksi MongoDB, worker:

1. memuat ulang order dan memastikan pembayaran masih `paid`;
2. membuat tiket yang belum ada untuk setiap `sequence` dari `0` sampai `quantity - 1`;
3. menangani benturan kredensial acak dengan menghasilkan ulang kode atau token;
4. memastikan jumlah tiket untuk order sama persis dengan `quantity`;
5. mengubah fase pemenuhan menjadi `issued` dan membersihkan lease serta error retry.

Jika proses berhenti sebelum selesai, lease akan kedaluwarsa. Worker berikutnya melanjutkan proses; indeks unik `(orderId, sequence)` membuat retry idempoten. Kegagalan sementara menaikkan `issuanceAttempts`, menyimpan ringkasan error, dan menjadwalkan retry dengan backoff. Order tidak ditandai `issued` bila jumlah tiket belum tepat.

## API tiket

Semua endpoint berikut memerlukan autentikasi pembeli:

### `GET /api/v1/tickets`

Mengembalikan tiket milik pengguna dengan pagination. Setiap item memuat ID tiket, ringkasan event dan jenis tiket, nama peserta, `ticketCode`, status check-in, dan waktu check-in. Respons tidak memuat `qrToken` atau payload QR.

### `GET /api/v1/tickets/:ticketId`

Mengembalikan detail tiket milik pengguna, termasuk `qrPayload`. Tiket milik pengguna lain diperlakukan sebagai tidak ditemukan agar endpoint tidak membocorkan keberadaan data.

Endpoint penerbitan manual tidak disediakan. Status pembayaran yang tervalidasi tetap menjadi satu-satunya pemicu penerbitan.

## Struktur implementasi

Perubahan utama ditempatkan pada:

- `backend/src/modules/tickets/ticket.model.ts` untuk schema dan indeks;
- `backend/src/modules/tickets/ticket.service.ts` untuk query tiket dan DTO aman;
- `backend/src/modules/tickets/ticket.routes.ts` untuk endpoint pembeli;
- `backend/src/jobs/ticket-issuance.job.ts` untuk claim, retry, dan penerbitan idempoten;
- model order untuk metadata lease penerbitan;
- bootstrap server untuk memulai dan menghentikan worker secara tertib.

## Penanganan kesalahan

- Order yang belum `paid` tidak boleh menghasilkan tiket.
- Order dengan kuantitas atau data peserta yang tidak konsisten gagal diproses dan masuk jadwal retry; order tidak ditandai `issued`.
- Benturan kode atau token acak menghasilkan kredensial baru, bukan menimpa tiket lain.
- Pengguna tidak dapat melihat tiket pengguna lain.
- Respons error tidak mengungkap token QR atau rahasia internal worker.

## Pengujian

Pengujian integrasi harus membuktikan:

- jumlah tiket sama dengan kuantitas order yang dibayar;
- order yang belum dibayar tidak menerbitkan tiket;
- retry dan dua worker bersamaan tidak membuat tiket ganda;
- proses dapat pulih setelah lease atau kegagalan di tengah penerbitan;
- setiap tiket memiliki `ticketCode` dan `qrToken` unik;
- endpoint daftar tidak membocorkan kredensial QR;
- endpoint detail hanya mengembalikan payload QR kepada pemilik tiket;
- fase pemenuhan berubah menjadi `issued` hanya setelah semua tiket tersedia.

Seluruh test, typecheck, dan build backend harus lulus sebelum branch dipush.

## Kriteria selesai

Issue #14 dianggap selesai ketika pembayaran berhasil secara otomatis menghasilkan tiket yang tepat jumlahnya, proses aman terhadap retry dan concurrency, pembeli dapat mengambil tiketnya melalui API, dan kredensial QR tidak terekspos melalui endpoint yang tidak memerlukannya.
