<h1 align="center">Gatherly</h1>

<p align="center">
  <strong>Discover events. Book your spot. Be there.</strong><br>
  Platform acara komunitas dengan reservasi kuota, pembayaran sandbox, tiket QR, dan check-in.
</p>

<p align="center">
  <a href="docs/README.md">Dokumentasi</a> ·
  <a href="docs/requirements.md">Analisis Kebutuhan</a> ·
  <a href="docs/api-contract.md">Kontrak API</a> ·
  <a href="postman/README.md">Postman</a> ·
  <a href="https://github.com/users/kuchikamizake05/projects/3/views/1">Project Board</a>
</p>

## Tentang Gatherly

Gatherly membantu peserta menemukan dan membeli tiket acara komunitas, organizer mengelola acara serta penjualan, dan panitia memvalidasi tiket di lokasi. Proyek ini dikembangkan oleh **Kelompok 11** untuk mata kuliah **Pengembangan Aplikasi Web**, topik **US3 — Tiket acara komunitas: kuota dan tiket elektronik berkode**.

Backend telah menyediakan autentikasi, manajemen acara, reservasi atomik, integrasi Midtrans Sandbox, penerbitan tiket QR, check-in sekali pakai, dan laporan organizer. Antarmuka Next.js masih dikembangkan dan saat ini menyediakan shell aplikasi.

## Fitur yang tersedia

| Area | Kemampuan |
| --- | --- |
| Akun | Register/login dengan email OTP, Google OAuth, sesi HttpOnly, logout, CSRF, dan profil organizer |
| Acara | CRUD event dan ticket type, publikasi, kuota, serta assignment panitia |
| Order | Reservasi inventori atomik, idempotency key, dan pembatasan akses buyer |
| Pembayaran | Midtrans Snap Sandbox, webhook terverifikasi, serta rekonsiliasi status |
| Tiket | Satu tiket per peserta, credential QR acak, dan penerbitan idempoten |
| Check-in | Scan QR/kode manual, validasi assignment dan waktu, serta single-use atomic |
| Laporan | Ringkasan penjualan, inventori, order, peserta, dan riwayat kehadiran |

## Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript |
| API | Express 5, TypeScript, Zod |
| Database | MongoDB dan Mongoose |
| Pembayaran | Midtrans Snap Sandbox |
| Keamanan | bcrypt, email OTP, Google OAuth state, cookie HttpOnly, CSRF, Helmet, rate limiting |
| Tooling | npm workspaces, Node test runner, Postman |

## Struktur repository

```text
Gatherly/
├── apps/
│   ├── backend/        Express API, worker, model, dan integration test
│   └── frontend/       Next.js App Router
├── docs/               Analisis kebutuhan, arsitektur, model, dan kontrak API
├── postman/            Collection, environment lokal, dan panduan penggunaan
└── package.json        Root package file
```

Aplikasi:

- `@gatherly/backend` (dalam `apps/backend`)
- `@gatherly/frontend` (dalam `apps/frontend`)

## Menjalankan secara lokal

Persyaratan:

- Node.js 22 atau versi LTS yang kompatibel;
- pnpm (v12 atau terbaru);
- MongoDB replica set atau MongoDB Atlas untuk transaksi;
- Midtrans Server Key dalam mode Sandbox.
- SMTP account (Gmail App Password dapat dipakai untuk demo);
- Google OAuth Client ID dan Client Secret.

### 1. Menjalankan Backend (`apps/backend`)

```bash
cd apps/backend
cp .env.example .env
pnpm install
pnpm dev
```

- API: `http://localhost:4000/api/v1`
- Health check: `http://localhost:4000/api/v1/health`

### 2. Menjalankan Frontend (`apps/frontend`)

```bash
cd apps/frontend
pnpm install
pnpm dev
```

- Frontend: `http://localhost:3000`

Jangan commit `.env`, MongoDB URI, Midtrans Server Key, cookie sesi, atau QR credential.

## Pemeriksaan kualitas

```bash
cd apps/backend
pnpm typecheck
pnpm build
pnpm test:integration
```

Integration test menggunakan database `gatherly_test` dan menolak pembersihan database dengan nama lain. Pastikan `MONGODB_URI` mengarah ke cluster test yang aman sebelum menjalankannya.

Smoke test Midtrans Sandbox dapat dijalankan terpisah:

```bash
cd apps/backend
pnpm test:smoke:midtrans
```

## Dokumentasi API dengan Postman

Import kedua file berikut:

- [`Gatherly API.postman_collection.json`](postman/Gatherly%20API.postman_collection.json)
- [`Gatherly Local.postman_environment.json`](postman/Gatherly%20Local.postman_environment.json)

Panduan urutan request, pergantian role, penyimpanan example response, dan aturan credential tersedia di [postman/README.md](postman/README.md).

## Laporan Milestone 1

Analisis kebutuhan dan fitur tersedia dalam folder [`docs`](docs/README.md). Tautan Google Drive untuk laporan PDF belum ditambahkan; tim harus menambahkan URL dengan izin **siapa saja yang memiliki link dapat melihat** sebelum pengumpulan.

## Anggota Kelompok 11

| Nama | NIM | Peran |
| --- | --- | --- |
| Dien Muhammad Scientivan Kurniapramono | 24/533571/TK/59114 | Backend 2 |
| Aulia Nur Fajri Tri Anggoro | 24/535054/TK/59327 | Frontend 1 |
| Muhammad Khoirunas | 24/533373/TK/59083 | Backend 1 / Ketua |
| Faaid Sakhaa | 24/539398/TK/59820 | Frontend 2 |

## Status dan scope

Target MVP serta acceptance criteria dijelaskan dalam [docs/requirements.md](docs/requirements.md). Fitur di luar scope awal mencakup refund otomatis, payout organizer, transfer tiket, dan offline check-in.
