# Frontend workspace untuk API asli

Branch: `feat/organizer-issues.nasta`. Backend tetap dikerjakan tim backend; perubahan batch ini hanya frontend, pengujian, konfigurasi release, dan dokumentasi. Desain `.pen` tidak diubah.

## Perubahan

- Mode live menjadi default. `pending: true` hanya metadata kontrak; fixture tidak dieksekusi kecuali `NEXT_PUBLIC_API_MOCK=true`. Endpoint yang belum tersedia menampilkan kegagalan, tanpa autentikasi atau transaksi contoh terselubung.
- `NEXT_PUBLIC_API_URL` kosong kembali memakai `/api/v1`, sesuai proxy satu origin. Cookie dikirim dengan `credentials: include`; CSRF hanya disimpan dalam memori browser, tanpa state lintas request SSR.
- HTTP 401 membersihkan cache privat dan sesi workspace. Query sesi dapat dibatalkan saat login berganti dan diperbarui saat window kembali aktif. Logout memberi umpan balik jika gagal dan mengakhiri tampilan sesi pada tab lain.
- Request memiliki timeout 20 detik dan upload 60 detik. Pembatalan berbeda dari kegagalan koneksi/timeout. Respons HTML dari proxy tidak dianggap JSON sukses. Pesan internal server 5xx tidak diteruskan ke pengguna.
- Respons autentikasi, acara, inventori, pesanan, peserta, tim, profil, rekening, pencairan, lookup/check-in/history diperiksa saat runtime. Snapshot `ticketType.name` dari laporan backend lama dinormalisasi. Payload yang tidak lengkap tidak mencapai render dan tidak diganti nilai inventori rekaan.
- HTTP 200 belum cukup untuk menerima tiket: respons check-in harus menyatakan `used` dan memuat identitas serta waktu konfirmasi valid. Percobaan QR ditolak tetap boleh memiliki kode kosong karena tidak merujuk tiket yang dikenal.
- Refund, pencairan, dan pembatalan memakai `Idempotency-Key`; retry intent yang sama dalam form yang sama memakai key yang sama. Backend tetap wajib menjamin atomisitas dan idempotensi, termasuk ketika halaman dimuat ulang atau perangkat lain mengirim permintaan.
- Poster diunggah melalui multipart XHR dengan progres transfer, cookie, CSRF, timeout dan pembatalan. Navigasi/unmount membatalkan unggahan dan mencegah hasil terlambat memperbarui form.
- Format WIB menggunakan `Asia/Jakarta`, sehingga hasil SSR/browser tetap sama ketika sistem berjalan di UTC atau zona lain. Tinjauan editor tetap mendukung zona acara WIB/WITA/WIT.
- `build:production` memaksa mock mati dan memvalidasi origin backend HTTPS. Konfigurasi Vercel memakai command ini. Header dokumen membatasi embedding, mengaktifkan `nosniff`, mengatur referrer/camera permission, serta HSTS pada produksi. Ini bukan pengganti pemeriksaan otorisasi di backend.

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Regresi demo, `pnpm test:e2e --workers=3` | 57 lulus, 390/834/1440 px |
| Build produksi tanpa mock, `pnpm test:live` | 39 lulus, 390/834/1440 px |
| Konfigurasi release, `pnpm test:config` | 4 lulus |
| `pnpm build:production` | Lulus, memakai origin demo backend yang sudah tercatat di repo sebagai konfigurasi build |
| `pnpm typecheck` | Lulus |
| `pnpm audit --prod` | Tidak ada vulnerability yang diketahui pada hasil audit ini |

Suite live menjalankan `next start` dari build produksi dan mengintersep HTTP menggunakan respons kontrak terkontrol. Pengujian mencakup cookie HttpOnly, CSRF, sesi kedaluwarsa, tidak adanya fallback pending, data/HTML rusak, retry refund dengan key yang sama, multipart poster, penolakan konfirmasi check-in kosong, timeout/cancel, isolasi CSRF SSR, dan konsistensi waktu WIB. Ini belum membuktikan endpoint tim backend atau provider pembayaran dapat dipakai secara langsung.

Validasi baru sempat menolak riwayat QR ditolak yang memang tidak memiliki kode tiket. Kontrak tersebut sudah diperbaiki dan regresi history pada ketiga ukuran kembali lulus. Test konfigurasi Node dijalankan terpisah dari runner browser.

## Yang masih dibutuhkan untuk integrasi dan deployment

1. Konfirmasi origin HTTPS backend dan domain organizer yang akan dipakai. `API_INTERNAL_URL` harus tersedia saat build dan runtime SSR; browser dapat memakai proxy `/api/v1` tanpa URL API publik terpisah.
2. Endpoint B28/B33/B35/B38/B39/B41 sesuai [kontrak handoff](workspace-api-handoff.md), termasuk sesi/CSRF/origin organizer, DTO event lengkap, unggah poster, dan idempotensi transaksi.
3. Uji langsung pada backend tim: login/role, draft/publish, inventori, assignment/revoke, pembayaran/webhook/issuance, refund/pencairan, dan check-in atomik. Kamera HP harus diperiksa melalui HTTPS; offline bundle/sinkronisasi masih menunggu kontrak backend.
4. Konfigurasi hosting/domain dan autentikasi akun deployment. Batch ini belum melakukan push, deployment, atau perubahan eksternal.

Perintah release dan konfigurasi environment ada di [runbook frontend](../deployment-frontend.md). Jangan menaruh secret backend pada variabel `NEXT_PUBLIC_*`.
