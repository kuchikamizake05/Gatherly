# Implementasi frontend organizer, 16 November 2026

Branch: `feat/organizer-issues.nasta`, berdasarkan `origin/main` pada commit `1812da3`.
Desain `gatherly.pen` dan folder `design/` dibaca sebagai referensi dan tidak diubah.
Commit dibuat bertahap dengan nomor issue terkait. Belum ada push, PR, deployment, atau perubahan status issue.

## Cakupan

| Issue | Implementasi dalam branch ini | Batas verifikasi |
| --- | --- | --- |
| #64, pendukung | PageHeader, StatCard, DataList, ResponsiveDialog, QueryState; tabel menjadi daftar mobile | Komponen dipakai pada halaman organizer. Belum mengaudit semua halaman admin |
| #10 | Wizard lima langkah; poster/foto dikompres; tipe tiket tambah/ubah/duplikat/hapus; ketentuan dapat diurutkan; sebutan penampil; review dan konfirmasi; autosave dan pemulihan draf perangkat | API performers, ketentuan, tiket gratis, dan upload masih mengikuti mock B33. Peta interaktif belum diimplementasikan. Perubahan jadwal belum mengirim email |
| #17 | Pilih anggota tim; anggota yang sudah ditugaskan/nonaktif tidak dapat dipilih; assignment dan pencabutan per acara dengan konfirmasi | Pembuatan/pengelolaan akun panitia berada di #68/B52 dan API akun B28. Halaman tersebut belum diimplementasikan dalam batch ini |
| #19 | Kamera dengan qr-scanner; pencarian manual; konfirmasi; hasil valid, sudah digunakan, salah acara, batal, waktu, akses, dan jaringan; riwayat serta polling 5 detik | API pencarian email, riwayat penolakan, bundle luring, dan aturan dua jam sebelum acara masih bergantung pada B41. Backend saat ini membuka check-in 30 menit sebelum acara |
| #20, pendukung | Dashboard ringkasan dan daftar acara dengan pencarian, status, periode, serta navigasi ke editor/assignment/scanner | Tab pesanan, peserta, inventori detail dan fitur Kelola acara lainnya masih menjadi pekerjaan #67/B51. Issue #20 yang closed sebelumnya tidak berarti semua UI selesai |
| #21 | Pengujian browser untuk alur frontend dan pemulihan kegagalan | Menggunakan mock. Tidak membuktikan transaksi MongoDB, webhook Midtrans atau alur produksi |
| #22 | Layout halaman yang diubah di 390/834/1440 px, dialog mobile, fokus, target tombol dan state data | Bukan audit akhir seluruh app. Pengujian kamera di HP masih diperlukan |
| #23, #24 | Langkah verifikasi dan cakupan demo dicatat di sini | Deployment, PPT dan video final belum dikerjakan; membutuhkan integrasi seluruh tim |

## Menjalankan dan memeriksa

Dari `apps/frontend`:

```sh
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_MOCK=true pnpm dev --port 3101 --hostname 0.0.0.0
```

Buka `http://organizer.localhost:3101`. Mode contoh ditandai di ruang organizer.
Data contoh yang dimutasi disimpan terpisah di perangkat; callback mock tidak dipakai untuk request API asli.
File `.env` tidak perlu diubah untuk menjalankan perintah ini.

Rute utama:

- `/events/new`
- `/events/ev_festival_jazz/edit`
- `/events/ev_festival_jazz/committee`
- `/events/ev_festival_jazz/scan`
- `/events/ev_festival_jazz/scan/history`

Pengujian:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
pnpm typecheck
pnpm build
```

Playwright menjalankan server mock sendiri pada port 3101 dan mengambil screenshot tiap ukuran.
Hasil lokal ada di `apps/frontend/test-results/` dan tidak masuk commit.
Pengujian mencakup validasi wizard, reload draf, publish lima langkah, assignment/revoke, check-in manual, pencegahan masuk kedua, kegagalan koneksi, dan filter riwayat.

Hasil pada 16 November 2026:

- `pnpm test:e2e`: 27 passed, di 390, 834, dan 1440 px, termasuk decoding QR dari stream kamera sintetis dan penolakan QR berisi URL tanpa navigasi.
- Setelah penambahan cleanup kamera saat akses dicabut, keenam pemeriksaan kamera pada tiga ukuran diulang dan lulus.
- `pnpm typecheck`: lulus.
- `pnpm build`: lulus pada konfigurasi standar, tanpa mengaktifkan mock saat build.
- `git diff --check`: lulus.

Tes stream sintetis tidak menggantikan pengujian izin dan kamera pada HP nyata melalui HTTPS.

## Perilaku luring dan batas integrasi

Pemindai tidak menyatakan tiket valid bila koneksi gagal. Bundle lokal harus tersedia dan belum kedaluwarsa sebelum check-in luring dapat diantrekan. Antrean disimpan menggunakan IndexedDB dan ditampilkan sebagai belum dikonfirmasi server. Request sinkronisasi yang gagal tetap disimpan; respons sudah digunakan tidak menambah kehadiran kedua kali.

Endpoint bundle pada fondasi frontend masih mengembalikan mock kosong. Karena itu, batch ini belum membuktikan operasional scan luring sampai sinkronisasi dengan backend. Format hash bundle, expiry, pencabutan akses saat luring, dan konflik antarperangkat perlu disepakati dalam B41 sebelum dipakai untuk acara nyata.

Backend lama belum mendukung draf yang hanya berisi nama. Draf perangkat dipertahankan bila penyimpanan API ditolak; perilaku autosave penuh pada API asli memerlukan penyelarasan kontrak. Foto/performer dan beberapa field baru juga belum persisten pada API lama.

## Audit dependency

Audit setelah penambahan Playwright menemukan 11 advisory pada dependency frontend: 2 critical, 3 high, 5 moderate, dan 1 low. Temuan mencakup Next.js 16.3.6 dan source-map-js. Audit production juga memiliki jumlah yang sama, sehingga penambahan test runner tidak menambah jumlah advisory. Pembaruan framework/dependency bersama perlu ditangani sebelum deployment; branch ini tidak menaikkan versi framework.
