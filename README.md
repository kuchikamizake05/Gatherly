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

## Deskripsi aplikasi

Gatherly membantu peserta menemukan dan membeli tiket acara komunitas, organizer mengelola acara serta penjualan, dan panitia memvalidasi tiket di lokasi. Proyek ini dikembangkan oleh **Kelompok 11** untuk mata kuliah **Pengembangan Aplikasi Web**, topik **US3 — Tiket acara komunitas: kuota dan tiket elektronik berkode**.

Backend telah menyediakan autentikasi, manajemen acara, reservasi atomik, integrasi Midtrans Sandbox, penerbitan tiket QR, check-in sekali pakai, dan laporan organizer. Antarmuka Next.js masih dikembangkan dan saat ini menyediakan shell aplikasi.

## Nama kelompok dan daftar anggota

**Kelompok 11 — Pengembangan Aplikasi Web**

| Nama | NIM | Peran |
| --- | --- | --- |
| Dien Muhammad Scientivan Kurniapramono | 24/533571/TK/59114 | Backend 2 |
| Aulia Nur Fajri Tri Anggoro | 24/535054/TK/59327 | Frontend 1 |
| Muhammad Khoirunas | 24/533373/TK/59083 | Frontend 2 |
| Faaid Sakhaa | 24/539398/TK/59820 | Backend 1 / Ketua |

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

## Struktur folder dan file proyek

```text
Gatherly/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/       Validasi environment dan koneksi MongoDB
│   │   │   ├── docs/         Spesifikasi OpenAPI dan halaman Swagger
│   │   │   ├── jobs/         Rekonsiliasi pembayaran dan penerbitan tiket lokal
│   │   │   ├── lib/          Utilitas dan penanganan error
│   │   │   ├── modules/      Auth, acara, order, pembayaran, tiket, check-in, laporan
│   │   │   ├── app.ts        Rute dan middleware Express
│   │   │   └── server.ts     Menjalankan server lokal
│   │   ├── test/            Pengujian integrasi dan smoke test Midtrans
│   │   ├── scripts/         Penyalinan aset Swagger saat build
│   │   ├── .env.example     Contoh variabel environment tanpa secret nyata
│   │   ├── app.js           Entry point deployment Vercel
│   │   ├── vercel.json      Konfigurasi Vercel
│   │   ├── package.json     Script dan dependency backend
│   │   └── pnpm-lock.yaml   Kunci dependency backend
│   └── frontend/
│       ├── app/             Halaman, layout, dan CSS Next.js
│       ├── src/components/  Komponen antarmuka
│       ├── src/lib/         Utilitas frontend
│       ├── package.json     Script dan dependency frontend
│       └── pnpm-lock.yaml   Kunci dependency frontend
├── docs/
│   ├── requirements.md, user-flows.md, architecture.md, data-model.md
│   ├── api-contract.md, testing.md, integrations.md, team-workflow.md
│   ├── deployment-vercel.md
│   └── superpowers/        Arsip spesifikasi dan rencana implementasi
├── postman/
│   ├── Gatherly API.postman_collection.json
│   ├── Gatherly Local.postman_environment.json
│   └── README.md           Panduan menjalankan request
├── README.md               Panduan proyek ini
└── package.json            Metadata repository; bukan npm workspace
```

Aplikasi:

- `@gatherly/backend` (dalam `apps/backend`)
- `@gatherly/frontend` (dalam `apps/frontend`)

## Teknologi

| Lapisan | Teknologi |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript |
| API | Express 5, TypeScript, Zod |
| Database | MongoDB dan Mongoose |
| Pembayaran | Midtrans Snap Sandbox |
| Keamanan | bcrypt, email OTP, Google OAuth state, cookie HttpOnly, CSRF, Helmet, rate limiting |
| Tooling | pnpm per aplikasi, Node test runner, Postman |

## URL GDrive laporan Milestone 1

Analisis kebutuhan dan fitur tersedia dalam folder [`docs`](docs/README.md). [Draf laporan Milestone 1 di Google Docs](https://docs.google.com/document/d/1pAWWQC0EvfNWmPuO4qkffKVYq5oPK96gY54XHbioQJ0/edit) memuat user story, hasil pengujian lokal, dan bukti Postman.

**Laporan PDF final:** [PAW2026_M1_Kelompok 11.pdf](https://drive.google.com/file/d/1jbkOKAdMCIKqKcThbcAU_jo6EtpathBQ/view?usp=sharing). Izin akses: siapa saja yang memiliki tautan dapat melihat.

Preview backend di Vercel sudah berstatus Ready dan Swagger UI tampil. Alur database, OTP/SMTP, Google OAuth, webhook Midtrans, dan job terjadwal belum diverifikasi pada deployment. Lihat [panduan deployment](docs/deployment-vercel.md).

## Menjalankan secara lokal

Persyaratan:

- Node.js 22 atau versi LTS yang kompatibel;
- pnpm (versi yang kompatibel dengan lockfile tiap aplikasi; pengujian lokal memakai v11.8.0);
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
- Swagger UI: `http://localhost:4000/api/v1/docs`
- Health check: `http://localhost:4000/api/v1/health`
- Preview dokumentasi publik: [gatherly-api-demo.vercel.app/api/v1/docs](https://gatherly-api-demo.vercel.app/api/v1/docs/)

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

## Status dan scope

Target MVP serta acceptance criteria dijelaskan dalam [docs/requirements.md](docs/requirements.md). Fitur di luar scope awal mencakup refund otomatis, payout organizer, transfer tiket, dan offline check-in.
