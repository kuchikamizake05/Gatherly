# Deployment backend ke VPS

Status per 17 November 2026: backend berjalan di `https://api.gatherlyy.fun` (VPS `tinjau-vps`, IP `15.235.146.33`). Frontend berjalan di `https://gatherlyy.fun`, `https://organizer.gatherlyy.fun`, dan `https://admin.gatherlyy.fun` (Vercel).

Dokumen ini menggantikan `deployment-vercel.md` untuk backend. Backend tidak lagi memakai Vercel karena butuh WebSocket dan worker yang berjalan terus.

## Komponen

| Komponen | Cara jalan | Keterangan |
| --- | --- | --- |
| `gatherly-api` | systemd, `node dist/server.js` | API Express dan WebSocket `/api/v1/realtime`, listen di `127.0.0.1:4100` |
| `gatherly-worker` | systemd, `node dist/worker.js` | Rekonsiliasi pembayaran, penerbitan tiket, refund, antrean email, pengingat, pembersihan upload |
| Caddy | service bersama | HTTPS dan WSS untuk `api.gatherlyy.fun`, diteruskan ke port 4100 |

File unit dan blok Caddy ada di `apps/backend/deploy/`. Konfigurasi rahasia ada di `/etc/gatherly/backend.env` (pemilik `root:gatherly`, mode 640). Jangan menyalin isinya ke repo atau chat.

## Deploy ulang

Jalankan dari `apps/backend` pada commit yang bersih.

```bash
./deploy/deploy.sh            # default host tinjau-vps
```

Script ini menjalankan typecheck, menyalin kode ke VPS, menjalankan `pnpm install` dan `pnpm build` di sana, me-restart kedua unit, lalu memeriksa `/api/v1/health`.

## Memeriksa kondisi

```bash
ssh tinjau-vps 'systemctl is-active gatherly-api gatherly-worker'
ssh tinjau-vps 'sudo journalctl -u gatherly-api -u gatherly-worker -n 50 --no-pager'
curl https://api.gatherlyy.fun/api/v1/health
```

## Hal yang perlu diketahui

- Backend VPS dan backend lokal memakai database Atlas yang sama (`test`). Bila worker lokal ikut berjalan, keduanya memproses antrean yang sama. Lease di setiap job mencegah pekerjaan ganda, tetapi matikan worker lokal saat menguji perilaku VPS.
- `ADMIN_ENCRYPTION_KEY` mengenkripsi secret 2FA admin. Nilainya di VPS sama dengan kunci yang dipakai saat akun admin tim dibuat. Jangan diganti tanpa migrasi, karena 2FA semua admin akan berhenti berfungsi (login admin gagal 500 di langkah kode authenticator). `OTP_SECRET` tidak lagi dipakai untuk enkripsi admin, jadi boleh diganti.
- `WEB_ORIGINS` adalah daftar situs yang boleh memanggil API, dipakai untuk CORS, cek origin CSRF, dan WebSocket. Nilainya di VPS: `https://gatherlyy.fun`, `https://organizer.gatherlyy.fun`, `https://admin.gatherlyy.fun`, `http://localhost:3000`, `http://organizer.localhost:3000`, dan `http://admin.localhost:3000`. Situs lain ditolak 403.
- Login Google tidak memakai `GOOGLE_CALLBACK_URL`. Callback dibentuk dari situs tempat login dimulai (`<origin>/api/v1/auth/google/callback`), lewat rewrite frontend supaya cookie sesi jatuh di domain frontend. Google Cloud Console harus mendaftarkan `https://gatherlyy.fun/api/v1/auth/google/callback` dan `http://localhost:3000/api/v1/auth/google/callback`.
- Baca `/etc/gatherly/backend.env` dengan dotenv atau `EnvironmentFile` systemd, bukan `source` di bash. Baris `SMTP_FROM` berisi `<...>` yang membuat bash gagal membaca sisa file.
- URL notifikasi Midtrans sandbox adalah `https://api.gatherlyy.fun/api/v1/payments/midtrans/notifications`. URL ini diatur di dashboard Midtrans.
- VPS yang sama juga menjalankan Kalis dan Simpleart. Selalu jalankan `caddy validate` sebelum `systemctl reload caddy`. Cadangan sebelum blok Gatherly ditambahkan ada di `/etc/caddy/Caddyfile.bak-gatherly`.
