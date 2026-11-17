# Menyiapkan demo frontend

Dokumen ini melengkapi [deployment backend](deployment-vercel.md) untuk #23. Belum ada deployment frontend atau tautan video final yang diverifikasi dari branch ini. Pemeriksaan `vercel whoami` melaporkan logged out; sesi ini belum terautentikasi ke akun deployment frontend. Domain organizer juga belum diverifikasi.

## Pemeriksaan lokal

```sh
cd apps/frontend
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:config
pnpm build:production
pnpm test:live
pnpm exec playwright install chromium
pnpm test:e2e
pnpm audit --prod
```

`test:e2e` memakai mock eksplisit. `test:live` memakai build produksi tanpa mock dengan HTTP yang diintersep oleh test runner. Keduanya belum membuktikan backend tim, OTP, Midtrans, refund, pencairan, atau scanner offline telah terintegrasi.

## Konfigurasi deployment

Gunakan root proyek `apps/frontend`, preset Next.js, install `pnpm install --frozen-lockfile`, build `pnpm build:production`. Konfigurasi sudah ada di `apps/frontend/vercel.json`; penetapan build command mengikuti [dokumentasi Vercel](https://vercel.com/docs/project-configuration/vercel-json#buildcommand). Salin nama variabel dari `.env.example` ke pengaturan hosting, tanpa menyalin secret ke Git.

- `API_INTERNAL_URL`: origin HTTPS backend, tanpa akhiran `/api/v1`. Rewrite Next meneruskan `/api/v1` agar cookie tetap berasal dari host frontend.
- `NEXT_PUBLIC_API_URL`: kosong untuk memakai rewrite satu origin.
- `NEXT_PUBLIC_API_MOCK=true`: demo antarmuka, banner mode contoh harus terlihat. Tidak mengklaim pembayaran atau pencairan nyata.
- Release produksi memaksa `NEXT_PUBLIC_API_MOCK=false`. Semua endpoint, termasuk yang pending, memakai HTTP asli. Error/tidak tersedianya endpoint ditampilkan sebagai kegagalan; tidak ada sukses atau data contoh terselubung. Backend harus memenuhi [kontrak workspace](implementation/workspace-api-handoff.md) sebelum alur tersebut dapat dipakai pengguna.
- Midtrans memakai client key sandbox; server key hanya di backend.

Proxy memilih area berdasarkan host. Pasang host utama, `organizer.<domain>`, dan `admin.<domain>` pada deployment yang sama dan verifikasi sertifikat HTTPS. Tanpa host organizer, URL `/organizer` di domain utama memang tidak dapat dipakai sebagai pengganti. `organizer.localhost` hanya untuk lokal.

## Smoke check sebelum menaruh tautan di README

1. Host utama membuka katalog; host organizer membuka login dan sesi organizer; admin tetap dibatasi role. Cookie HttpOnly/CSRF diverifikasi melalui request asli, termasuk logout dan kedaluwarsa.
2. Kamera pada HP Android/iOS melalui HTTPS: beri/tolak izin, pindai, pindah halaman, pastikan stream berhenti; tiket ganda ditolak server. Uji panitia yang assignment-nya dicabut.
3. Buat/publish acara, pastikan muncul di katalog asli; beli dan bayar sandbox, webhook mencapai backend publik, tiket diterbitkan, email terkirim.
4. Verifikasi penjadwal maintenance, rekonsiliasi pembayaran, MongoDB replica set, callback Google, dan SMTP mengikuti runbook backend.
5. Refund/pencairan memakai kontrak server asli; jangan memakai state localStorage untuk bukti transaksi. Perangkat kedua harus melihat state server yang sama.
6. Jalankan `scripts/smoke-workspace.mjs` dengan URL terpilih. Pemeriksaan HTTP tidak menggantikan langkah autentikasi, kamera, dan transaksi di atas.
7. Setelah bukti berhasil, tambahkan URL frontend dan video final yang benar-benar dapat dibuka di README, lalu catat tanggal verifikasi. #23–24 tetap terbuka sampai acceptance criteria kelompok terpenuhi.
