# Data demo

`apps/backend/scripts/seed-demo.ts` mengisi database dengan data contoh untuk mencoba semua alur utama: peserta, organizer beserta panitia, dan admin. Database Atlas `test` dipakai bersama oleh situs produksi dan pengembangan lokal, jadi script ini dibuat supaya hanya menyentuh data demo.

## Yang diisi

| Jenis | Isi |
| --- | --- |
| Peserta | 5 akun `demo.<nama>@gatherlyy.fun` (4 dengan password, 1 hanya Google), event tersimpan, satu laporan acara terbuka dan satu yang sudah ditutup |
| Organizer | `demo-lensa` (aktif, punya rekening bank) dan `demo-rakit` (dibekukan) |
| Panitia | `demo-lensa-gerbang1` (aktif), `demo-lensa-gerbang2` (belum pernah login, wajib ganti password), `demo-lensa-gerbang3` (nonaktif), masing-masing ditugaskan ke acara |
| Pengajuan organizer | `PNG-DEMO-0001` sampai `0005`, satu per status: new, needs_fix, fix_submitted, approved, rejected |
| Acara | 12 acara `demo-*`: dijual, habis terjual, penjualan dihentikan (sedang berlangsung, check-in terbuka), gratis, draf, tiga acara selesai, dibatalkan (refund), menunggu keputusan pembatalan, dan satu milik organizer beku |
| Pesanan dan tiket | 28 pesanan `GTH-DEMO-*` dan 39 tiket: lunas, menunggu bayar (reservasi 15 menit lalu kedaluwarsa), kedaluwarsa, gagal, tiket terpakai, tiket batal |
| Refund | requested, approved, rejected, refunded (sebagian dan penuh), refund pembatalan acara, dan satu manual_required |
| Pencairan | satu acara siap dicairkan, satu diajukan, satu sudah ditransfer dengan referensi |
| Admin | `demo.admin@gatherlyy.fun` dengan TOTP dan 8 kode cadangan |

Semua judul acara diawali `[DEMO]` dan deskripsinya menyebut bahwa acara tersebut bukan acara sungguhan. Poster tidak diisi, jadi frontend memakai tampilan tanpa poster.

## Cara menjalankan

Jalankan dari `apps/backend`. `--confirm-db` wajib dan harus sama dengan nama database yang terhubung. Kalau tidak sama, script berhenti sebelum menulis apa pun.

```bash
# Lokal, ke database terpisah
MONGODB_URI='mongodb://127.0.0.1:27099/?replicaSet=rs0' ADMIN_ENCRYPTION_KEY=<min 32 karakter> \
  pnpm seed:demo --db=gatherly_seed_check --confirm-db=gatherly_seed_check --create-indexes \
  --credentials-out=/tmp/demo-credentials.md

# VPS produksi (salin hanya file script ini ke /opt/gatherly/app/backend/scripts/)
sudo -u gatherly bash -c 'umask 077; cd /opt/gatherly/app/backend && \
  node_modules/.bin/tsx scripts/seed-demo.ts --env-file=/etc/gatherly/backend.env \
  --confirm-db=test --credentials-out=/tmp/gatherly-demo-credentials.md'
```

- `--env-file` dibaca dengan dotenv. Jangan memakai `source`, karena `SMTP_FROM` berisi `<`.
- `--reset` menghapus dokumen bertanda `demoSeed: true` (dan hanya itu) sebelum mengisi ulang.
- Password, secret TOTP, dan kode cadangan dibuat acak setiap kali script dijalankan. Hasilnya hanya ditulis ke file `--credentials-out` dengan mode 600, tidak pernah dicetak ke log. Ambil file itu, lalu hapus dari server.
- Secret TOTP dienkripsi dengan `ADMIN_ENCRYPTION_KEY` dari env yang dimuat. Jalankan ulang script kalau kunci itu diganti.

## Pengaman

- Setiap dokumen demo memakai `_id` deterministik dan penanda `demoSeed: true`. Menjalankan ulang tanpa `--reset` mengganti dokumen yang sama, tidak menduplikasi.
- Sebelum menulis, script memeriksa bahwa tidak ada data asli yang memakai email, username, slug, nomor pesanan, atau `_id` demo, dan tidak ada pesanan, tiket, refund, atau pencairan non-demo pada acara demo. Kalau ada, script berhenti tanpa menulis.
- Selain dokumen bertanda demo, script hanya menghapus sesi, tantangan login, dan reset password milik akun demo (karena password diganti), serta bookmark, penugasan panitia, dan laporan yang dibuat akun demo pada acara demo.
- Tidak ada email yang dikirim dan tidak ada transaksi Midtrans yang dibuat. Pesanan lunas sudah ditandai `ticketEmailQueuedAt`, sehingga worker tidak mengirim e-ticket. Semua akun demo memakai `notifications.reminders=false` dan setiap tiket demo memakai email akun demo, sehingga pengingat H-1 dilewati. Refund berstatus approved diparkir (`nextAttemptAt` tahun 2099) supaya worker tidak memanggil Midtrans. Pesanan menunggu bayar pertama kali direkonsiliasi setelah kedaluwarsa, sehingga worker mengakhirinya tanpa memanggil Midtrans.
- Acara ditulis paling akhir dan dihapus paling awal saat reset. Worker membuat refund otomatis untuk pesanan lunas di acara batal, jadi acara batal tidak boleh muncul sebelum refund-nya ada.

## Keterbatasan

- Login peserta dengan password selalu mengirim kode OTP ke email. Domain `gatherlyy.fun` tidak punya MX record, sehingga akun peserta demo tidak bisa dipakai untuk login. Data mereka tetap terlihat dari sisi organizer dan admin.
- Akun Google `demo.nadia` hanya penanda tampilan. Tidak ada akun Google sungguhan di baliknya.
- Kalau admin menyetujui pengajuan demo lewat UI, aplikasi membuat organizer baru tanpa penanda demo dan mengirim email ke alamat demo. Hapus manual bila perlu.
- Siapa pun dapat membeli tiket acara demo yang sedang dijual (Midtrans sandbox). Pesanan seperti itu bukan data demo, sehingga script akan menolak berjalan sampai pesanan tersebut dibereskan.
