# Deployment backend ke VPS

Status per 17 November 2026: backend berjalan di `https://api.gatherly.scientivan.dev` (VPS `tinjau-vps`, IP `15.235.146.33`). Frontend belum dideploy dan untuk sementara berjalan di `http://localhost:3000`.

Dokumen ini menggantikan `deployment-vercel.md` untuk backend. Backend tidak lagi memakai Vercel karena butuh WebSocket dan worker yang berjalan terus.

## Komponen

| Komponen | Cara jalan | Keterangan |
| --- | --- | --- |
| `gatherly-api` | systemd, `node dist/server.js` | API Express dan WebSocket `/api/v1/realtime`, listen di `127.0.0.1:4100` |
| `gatherly-worker` | systemd, `node dist/worker.js` | Rekonsiliasi pembayaran, penerbitan tiket, refund, antrean email, pengingat, pembersihan upload |
| Caddy | service bersama | HTTPS dan WSS untuk `api.gatherly.scientivan.dev`, diteruskan ke port 4100 |

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
curl https://api.gatherly.scientivan.dev/api/v1/health
```

## Hal yang perlu diketahui

- Backend VPS dan backend lokal memakai database Atlas yang sama (`test`). Bila worker lokal ikut berjalan, keduanya memproses antrean yang sama. Lease di setiap job mencegah pekerjaan ganda, tetapi matikan worker lokal saat menguji perilaku VPS.
- `ADMIN_ENCRYPTION_KEY` di VPS dibuat acak saat setup pertama dan dipakai untuk mengenkripsi secret 2FA admin. Jangan diganti, karena 2FA admin yang sudah ada tidak akan bisa dibaca lagi.
- Login Google memakai callback `http://localhost:3000/api/v1/auth/google/callback` selama frontend berjalan lokal, supaya cookie sesi jatuh di domain frontend. URL ini harus terdaftar di Google Cloud Console. Ganti nilainya saat frontend sudah punya domain.
- URL notifikasi Midtrans sandbox adalah `https://api.gatherly.scientivan.dev/api/v1/payments/midtrans/notifications`. URL ini diatur di dashboard Midtrans.
- VPS yang sama juga menjalankan Kalis dan Simpleart. Selalu jalankan `caddy validate` sebelum `systemctl reload caddy`. Cadangan sebelum blok Gatherly ditambahkan ada di `/etc/caddy/Caddyfile.bak-gatherly`.
