# Deployment Backend Gatherly ke Vercel

Status: preview deployment berstatus Ready di Vercel pada 29 September 2026. Build remote berhasil; API dan integrasi belum diuji di deployment.

Preview: https://gatherly-backend-i8bwmeih3-kuchikamizakes-projects.vercel.app

Alamat pendek untuk dibagikan: https://gatherly-api-demo.vercel.app/api/v1/docs/
Alias ini menunjuk deployment di atas; setelah deployment preview baru, arahkan kembali alias ke deployment yang baru.

Swagger UI sudah diverifikasi tampil di browser. Vercel Authentication dinonaktifkan atas persetujuan pengguna agar preview dapat diakses publik. Berkas Swagger disalin ke public saat build supaya tersedia pada deployment.

OAuth callback belum dikonfigurasi untuk domain preview, dan penjadwal eksternal belum dipasang. WEB_ORIGIN masih mengikuti konfigurasi lokal. Deployment belum siap untuk seluruh alur browser.

## 1. Pengaturan Proyek

Proyek `gatherly-backend` sudah dibuat melalui CLI Vercel dari direktori `apps/backend`. Jika membuat ulang melalui import repository, pilih Root Directory `apps/backend`.
Gunakan framework Express, Node.js 24.x, dan build command `pnpm run build`.
Biarkan Output Directory menggunakan pengaturan bawaan Express.
Mulai dengan preview deployment.

## 2. Environment Variables

Isi `NODE_ENV=production`, `MONGODB_URI` menggunakan MongoDB yang dapat diakses dari internet dan mendukung transaksi (replica set), `MIDTRANS_SERVER_KEY` sandbox, dan `MIDTRANS_IS_PRODUCTION=false`.
Jangan memakai alamat MongoDB localhost untuk deployment.

Untuk OTP, isi `OTP_SECRET` minimal 32 karakter acak, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM`.
Untuk Google OAuth, isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `GOOGLE_CALLBACK_URL=https://<domain-backend>/api/v1/auth/google/callback`; daftarkan URL callback yang sama di Google Cloud.
Isi `WEB_ORIGIN` dengan origin frontend yang diizinkan. Jika frontend dan backend berbeda situs, sesi cookie perlu konfigurasi tambahan atau proxy satu situs sebelum pengujian browser.
Isi `CRON_SECRET` dengan secret acak minimal 32 karakter yang berbeda dari OTP_SECRET.
Masukkan nilai rahasia di pengaturan Vercel; jangan commit file .env.

## 3. Pembayaran dan Penerbitan Tiket

Server lokal tetap menjalankan job otomatis setiap 60 detik dan 10 detik.
Vercel menggunakan export Express di `src/app.ts`, dengan koneksi database yang dipakai ulang; interval server lokal tidak dijalankan.

Pasang penjadwal eksternal yang memanggil GET `https://<domain-backend>/api/v1/internal/maintenance` setiap menit dengan header `Authorization: Bearer <CRON_SECRET>`.
Endpoint memproses maksimal dua pembayaran dan dua order tiket per panggilan menggunakan mekanisme lease dan transaksi yang sudah ada. Kapasitas ini cocok untuk demo kecil; antrean besar membutuhkan peningkatan kapasitas atau worker terpisah.
Tanpa penjadwal, rekonsiliasi pembayaran dan job penerbitan tiket tidak berjalan otomatis di Vercel.
Cron bawaan Vercel Hobby hanya sekali sehari, sehingga tidak dipasang sebagai pengganti interval asli.
Preview saat ini dapat diakses publik karena Vercel Authentication sudah dinonaktifkan; endpoint pemeliharaan tetap memerlukan `CRON_SECRET`.

Atur URL notifikasi Midtrans ke endpoint notifikasi yang tercantum dalam dokumentasi API proyek menggunakan domain deployment yang stabil.

## 4. Pemeriksaan Sebelum Menulis Hasil di Laporan

Periksa health dan Swagger, lalu uji registrasi/OTP, login, Google OAuth, pemesanan, notifikasi Midtrans sandbox, penerbitan tiket, check-in, dan pemeliharaan terjadwal.
Catat URL, commit, tanggal, hasil aktual, dan bukti pengujian. Jangan menyebut deployment atau integrasi berhasil sebelum pengujian dilakukan.

Referensi: https://vercel.com/docs/frameworks/backend/express dan https://vercel.com/docs/cron-jobs/usage-and-pricing.
