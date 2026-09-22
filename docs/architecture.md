# Gatherly — Arsitektur awal

Gatherly uses one repository for both applications. The frontend and API remain separate applications so they can be run and deployed independently.

```text
Browser
  ↓
apps/web (Next.js App Router)
  ↓ HTTP API
apps/api (ExpressJS)
  ↓
MongoDB
```

The API owns authentication, authorization, ticket sales, quota updates, QR-code validation, and database access. The web application presents the interface and consumes the API.

## Bentuk aplikasi

Modular monolith: satu aplikasi Express dengan modul akun, acara, order/pembayaran, dan tiket/check-in. Bukan microservices. Next.js dan Express dapat dideploy terpisah, tetapi seluruh aturan bisnis tetap di Express.

Usulan struktur ketika scaffold dibuat:

```text
apps/web/src/
  app/                  routes dan layouts
  features/             auth, events, checkout, tickets, organizer, committee
  components/           komponen UI bersama
  lib/                  API client, format uang/tanggal
apps/api/src/
  modules/              auth, organizers, events, orders, payments, tickets
  middleware/           session, permission, validation, error handling
  jobs/                 rekonsiliasi payment/reservasi
  config/               validasi environment
docs/
```

TypeScript dan npm workspaces diusulkan agar satu bahasa serta satu lockfile. Jangan membuat layanan terpisah atau package bersama sebelum ada kebutuhan konkret.

## Next.js dan komunikasi API

- App Router untuk routing/layout. Gunakan Client Components untuk form interaktif, Snap, serta kamera yang membutuhkan browser.
- Public event rendering dapat mengambil data dari Express; komponen tidak mengakses MongoDB langsung.
- Browser memanggil `/api/v1` pada origin web. Reverse proxy/rewrite meneruskan request dan cookie ke Express dengan path tetap.
- Middleware Next hanya membantu navigasi. Express tetap memverifikasi sesi dan otorisasi setiap endpoint.
- Jangan cache respons pribadi, QR, order, atau inventori checkout sebagai konten publik. Katalog boleh di-cache kemudian, tetapi reservasi selalu memeriksa kuota aktual.

## Autentikasi yang diusulkan

Sesi server-side disimpan di MongoDB. Cookie `gatherly_session`: HttpOnly, SameSite=Lax, Secure pada HTTPS, Path=/, tanpa Domain lintas host. Masa sesi awal 7 hari; verifikasi expiry pada setiap request (pembersihan TTL bukan validasi).

Rotasi sesi setelah login, hapus sesi saat logout. Gunakan token CSRF terikat sesi melalui header `X-CSRF-Token` untuk mutasi, serta validasi Origin yang diizinkan. Login/register memakai validasi Origin dan pembatasan percobaan. Endpoint webhook tidak memakai sesi/CSRF browser, melainkan verifikasi provider.

Hash password dengan library password hashing yang sesuai; jangan menyimpan password asli. Rahasia, cookie, dan token QR tidak masuk log. Rate limit untuk login, checkout, dan scanner; validasi input serta batas ukuran request.

## Konsistensi dan pekerjaan latar

MongoDB harus berupa replica set yang mendukung transaksi untuk konsistensi inventori/order/tiket. Panggilan Midtrans berada di luar transaksi database. Simpan intent/status sebelum panggilan eksternal, gunakan identitas provider stabil, dan rekonsiliasi bila respons hilang; tidak ada transaksi atomik tunggal melintasi MongoDB dan Midtrans.

Job rekonsiliasi memeriksa order tertunda/expired dan issuance yang belum selesai. State dan lease job disimpan secara durable di MongoDB agar dapat dipulihkan setelah restart. Jangan mengandalkan timer browser atau TTL yang menghapus order. Deployment harus mendukung proses job; jika hosting tidur, jalankan catch-up saat aktif dan jangan menjanjikan pelepasan tepat detik.

## Referensi teknis

- [Next.js Server/Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [Midtrans expiry](https://docs.midtrans.com/docs/snap-advanced-feature)

Dokumentasi diperiksa 22 September 2026. Detail versi dan konfigurasi runtime diverifikasi saat implementasi.
