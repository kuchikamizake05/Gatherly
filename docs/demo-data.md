# Data contoh (seed)

`apps/backend/scripts/seed-demo.ts` (`pnpm seed:demo`) mengisi database dengan data contoh untuk mencoba semua alur utama: peserta, organizer beserta panitia, dan admin. Database Atlas `test` dipakai bersama oleh situs produksi dan pengembangan lokal, jadi script ini dibuat supaya hanya menyentuh data yang ia buat sendiri.

Isi data dibuat seperti data sungguhan (nama, acara, dan teks berbahasa Indonesia tanpa label apa pun). Data seed dikenali lewat manifest yang tidak terlihat oleh pengguna, bukan lewat teks.

## Yang diisi

| Jenis | Isi |
| --- | --- |
| Peserta | 5 akun `<nama>@gatherlyy.fun` (4 dengan password, 1 hanya Google), event tersimpan, satu laporan acara terbuka dan satu yang sudah ditutup |
| Organizer | `lensakota` (Kolektif Lensa Kota, aktif, punya rekening dan logo) dan `ruangrakit` (Ruang Rakit Studio, dibekukan) |
| Panitia | `lensakota.yoga` (aktif), `lensakota.intan` (belum pernah login, wajib ganti password), `lensakota.fajar` (nonaktif), masing-masing ditugaskan ke acara |
| Pengajuan organizer | `PNG-2610-0901` sampai `0905`, satu per status: new, needs_fix, fix_submitted, approved, rejected |
| Acara | 12 acara dengan poster: dijual, habis terjual, penjualan dihentikan (sedang berlangsung, check-in terbuka), gratis, draf, tiga acara selesai, dibatalkan (refund), menunggu keputusan pembatalan, dan satu milik organizer beku |
| Pesanan dan tiket | 28 pesanan dan 39 tiket: lunas, menunggu bayar (reservasi 15 menit lalu kedaluwarsa), kedaluwarsa, gagal, tiket terpakai, tiket batal |
| Refund | requested, approved, rejected, refunded (sebagian dan penuh), refund pembatalan acara, dan satu manual_required |
| Pencairan | satu acara siap dicairkan, satu diajukan, satu sudah ditransfer dengan referensi |
| Admin | `tim.operasional@gatherlyy.fun` dengan TOTP dan 8 kode cadangan |
| Gambar | 24 foto Unsplash (12 poster, 10 foto penampil, 2 logo organizer) di bucket R2 `gatherly`, masing-masing dengan dokumen `StorageAsset` publik |

Nomor pengajuan memakai bulan Oktober 2026 dengan urutan 09xx. Aplikasi hanya membuat nomor untuk bulan berjalan, jadi nomor ini tidak akan bentrok dengan pengajuan asli.

## Cara menjalankan

Jalankan dari `apps/backend`. `--confirm-db` wajib dan harus sama dengan nama database yang terhubung. Kalau tidak sama, script berhenti sebelum menulis apa pun.

```bash
# Lokal, ke database terpisah, tanpa gambar (tidak butuh kredensial R2)
MONGODB_URI='mongodb://127.0.0.1:27099/?replicaSet=rs0' ADMIN_ENCRYPTION_KEY=<min 32 karakter> \
  pnpm seed:demo --db=gatherly_seed_check --confirm-db=gatherly_seed_check --create-indexes \
  --skip-images --credentials-out=/tmp/seed-credentials.md

# VPS produksi (salin hanya file script ini ke /opt/gatherly/app/backend/scripts/)
sudo -u gatherly bash -c 'umask 077; cd /opt/gatherly/app/backend && \
  node_modules/.bin/tsx scripts/seed-demo.ts --env-file=/etc/gatherly/backend.env \
  --confirm-db=test --reset --credentials-out=/tmp/gatherly-seed-credentials.md'
```

- `--env-file` dibaca dengan dotenv. Jangan memakai `source`, karena `SMTP_FROM` berisi `<`.
- `--reset` menghapus semua dokumen dan objek R2 yang tercatat di manifest sebelum mengisi ulang.
- Password, secret TOTP, dan kode cadangan dibuat acak setiap kali script dijalankan. Hasilnya hanya ditulis ke file `--credentials-out` dengan mode 600, tidak pernah dicetak ke log. Ambil file itu, lalu hapus dari server.
- Secret TOTP dienkripsi dengan `ADMIN_ENCRYPTION_KEY` dari env yang dimuat. Jalankan ulang script kalau kunci itu diganti.
- Gambar diunduh dari `images.unsplash.com` saat script berjalan (poster lebar 1200 px, foto dan logo 400 x 400 px, JPEG di bawah 1 MB), lalu diunggah ke R2 dengan kunci `media/<purpose>/<uuid>` seperti unggahan dari aplikasi.

## Cara data seed dikenali

- Setiap dokumen memakai `_id` deterministik. Semua `_id` per koleksi dan semua kunci objek R2 dicatat di koleksi `seedmanifests` (dokumen `gatherly-sample-data`) sebelum dokumen ditulis, sehingga run yang gagal di tengah tetap bisa di-reset.
- `--reset` hanya menghapus `_id` yang ada di manifest, ditambah dokumen bertanda `demoSeed: true` dari versi pertama script ini. Tidak ada field penanda baru di dokumen, sehingga tidak ada yang bocor lewat API.
- Menjalankan ulang tanpa `--reset` mengganti dokumen yang sama, tidak menduplikasi.

## Pengaman

- Sebelum menulis, script memeriksa bahwa tidak ada data asli yang memakai email, username, slug, nomor pesanan, kunci R2, atau `_id` yang direncanakan, dan tidak ada pesanan, tiket, refund, atau pencairan non-seed pada acara seed. Kalau ada, script berhenti tanpa menulis.
- Selain dokumen di manifest, script hanya menghapus sesi, tantangan login, dan reset password milik akun seed (karena password diganti), serta bookmark, penugasan panitia, dan laporan yang dibuat akun seed pada acara seed.
- Email memakai domain proyek (`@gatherlyy.fun`, tanpa MX record) atau `@workspace.invalid`, jadi tidak ada email yang bisa sampai ke orang lain.
- Tidak ada email yang dikirim dan tidak ada transaksi Midtrans yang dibuat. Pesanan lunas sudah ditandai `ticketEmailQueuedAt`, sehingga worker tidak mengirim e-ticket. Semua akun seed memakai `notifications.reminders=false` dan setiap tiket memakai email akun seed, sehingga pengingat H-1 dilewati. Refund berstatus approved diparkir (`nextAttemptAt` tahun 2099) supaya worker tidak memanggil Midtrans. Pesanan menunggu bayar pertama kali direkonsiliasi setelah kedaluwarsa, sehingga worker mengakhirinya tanpa memanggil Midtrans.
- Acara ditulis paling akhir dan dihapus paling awal saat reset. Worker membuat refund otomatis untuk pesanan lunas di acara batal, jadi acara batal tidak boleh muncul sebelum refund-nya ada.
- `StorageAsset` diberi `attachedAt`, sehingga `cleanupAssets` di worker tidak menghapusnya.

## Keterbatasan

- Login peserta dengan password selalu mengirim kode OTP ke email. `gatherlyy.fun` tidak punya MX record, sehingga akun peserta seed tidak bisa dipakai untuk login. Data mereka tetap terlihat dari sisi organizer dan admin.
- Akun Google `nadia.putri` hanya data tampilan. Tidak ada akun Google sungguhan di baliknya.
- Acara seed tampil di situs produksi tanpa label. Siapa pun dapat membeli tiket acara yang sedang dijual (Midtrans sandbox, tanpa uang sungguhan). Pesanan seperti itu bukan data seed, sehingga script akan menolak berjalan sampai pesanan tersebut dibereskan.
- Kalau admin menyetujui pengajuan seed lewat UI, aplikasi membuat organizer baru di luar manifest. Hapus manual bila perlu.

## Kredit foto (Unsplash License)

| Dipakai untuk | Foto | Fotografer |
| --- | --- | --- |
| Poster Malam Akustik Tirtodipuran | https://unsplash.com/photos/OPQ_0C_JHxM | Gio Bartlett |
| Poster Lokakarya Fotografi Analog | https://unsplash.com/photos/QpkvxElLJ78 | Tuaans |
| Poster Konser Senja di Bukit Bintang | https://unsplash.com/photos/kvBOc0nxNlk | Luca Iaconelli |
| Poster Pameran Seni Rupa Ruang Antara | https://unsplash.com/photos/v9-ZW3VONcw | Mike Von |
| Poster Meetup Komunitas Web Jogja | https://unsplash.com/photos/rxpThOwuVgE | Austin Distel |
| Poster Kelas Menulis Lagu | https://unsplash.com/photos/4FN2TwPkbDA | Adhy Setya |
| Poster Festival Kuliner Kampung Tirtodipuran | https://unsplash.com/photos/sdxIkT42hGc | Praveen Gupta |
| Poster Workshop Seduh Kopi Manual | https://unsplash.com/photos/TYIzeCiZ_60 | Karl Fredrickson |
| Poster Lari Pagi Keliling Benteng | https://unsplash.com/photos/laxDhpYqZZc | Mike Cox |
| Poster Malam Jazz Tepi Pantai | https://unsplash.com/photos/dBWvUqBoOU8 | Jens Thekkeveettil |
| Poster Turnamen Futsal Antarkampus | https://unsplash.com/photos/f44zfM0Vn8w | Alfonso Scarpa |
| Poster Pasar Kriya Akhir Pekan | https://unsplash.com/photos/9cIKRL9n4HY | Margo Evardson |
| Penampil Sore di Selatan | https://unsplash.com/photos/ABHgx0QXFV0 | Vidar Nordli-Mathisen |
| Penampil Nara Kinanti | https://unsplash.com/photos/tcUAK0AD8fw | Harry Shelton |
| Penampil Trio Angkringan | https://unsplash.com/photos/DWHSc8o8K9Y | Glenn van de Wiel |
| Penampil Langit Jingga | https://unsplash.com/photos/v7Tujfxt9Zs | set.sj |
| Pemateri Laras Hapsari | https://unsplash.com/photos/3TLl_97HNJo | Aiony Haust |
| Pemateri Bima Adi | https://unsplash.com/photos/WC7KIHo13Fc | Juan Encalada |
| Perupa Kolektif Gambar Pagi | https://unsplash.com/photos/e5LdlAMpkEw | Steve A Johnson |
| Perupa Dewi Anggraini | https://unsplash.com/photos/NRBBze-P0Sc | Muhammad Rahim Ali |
| Pembicara Arif Rahman | https://unsplash.com/photos/au84UJ1KmNU | gede adhiputra |
| Pembicara Putri Ayu | https://unsplash.com/photos/i5R8hbZFDdc | Thanh Duc PHAN |
| Logo Kolektif Lensa Kota | https://unsplash.com/photos/_T4w3JDm6ug | Yoann Siloine |
| Logo Ruang Rakit Studio | https://unsplash.com/photos/ZSgWcW70cTs | Taylor Heery |
