# Postman Gatherly

Folder ini berisi collection API dan environment lokal untuk bukti Milestone 1.

## Import

1. Import `Gatherly API.postman_collection.json` ke Postman.
2. Import `Gatherly Local.postman_environment.json`.
3. Pilih environment **Gatherly Local**.
4. Jalankan server dengan `npm run dev --workspace @gatherly/server`.

## Urutan penggunaan

Postman menyimpan cookie `gatherly_session` secara otomatis. Login sebagai role yang dibutuhkan sebelum menjalankan folder privat:

1. Jalankan **Health**.
2. Daftarkan akun buyer, organizer, dan committee menggunakan request Register dengan mengganti variable email.
3. Login sebagai organizer, buat profil organizer, event, ticket type, dan assignment committee.
4. Login sebagai buyer sebelum membuat order serta membaca tiket.
5. Login sebagai committee sebelum lookup dan check-in.
6. Login kembali sebagai organizer untuk endpoint laporan.

Script pada respons login menyimpan `csrfToken`. Request create menyimpan ID resource bila respons berhasil. Nilai variable dapat diperiksa melalui environment editor.

## Batasan alur demo

- Event harus berstatus `published` sebelum buyer membuat order. Upload poster belum tersedia pada API saat collection ini dibuat; gunakan event demo yang telah disiapkan tim atau data test yang sah.
- Payment session memakai Midtrans Sandbox. Jangan memakai key production.
- Webhook memerlukan signature SHA-512 yang valid dari `order_id + status_code + gross_amount + serverKey`. Isi `midtransSignature` secara lokal. Jangan commit Server Key atau signature aktif.
- Tiket tersedia setelah status pembayaran terverifikasi dan worker penerbitan selesai.
- QR payload dan cookie sesi adalah credential. Kosongkan keduanya sebelum mengekspor environment atau membagikan screenshot.

## Menyimpan hasil pemanggilan

Untuk setiap request yang dipakai dalam laporan:

1. Jalankan request terhadap database demo/test.
2. Pastikan status, request body, dan response body terlihat.
3. Pilih **Save Response → Save as example**.
4. Beri nama contoh, misalnya `201 Created`, `200 Success`, atau `409 Already Used`.
5. Ekspor ulang collection setelah menghapus cookie dan credential aktif.

Collection dalam repository menyediakan request dan assertion dasar. Contoh hasil harus berasal dari pemanggilan aktual, bukan response buatan.

## Data sensitif

Jangan simpan atau commit:

- `MONGODB_URI` Atlas;
- Midtrans Server Key;
- password akun nyata;
- cookie sesi aktif;
- CSRF token aktif;
- QR payload aktif;
- data pribadi peserta nyata.
