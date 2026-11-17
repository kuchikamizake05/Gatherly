# Demo workspace dan bukti kontribusi FE 2

## Menjalankan contoh

```sh
cd apps/frontend
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_MOCK=true pnpm dev
```

Buka `http://organizer.localhost:3000/login`. Akun contoh organizer `kolektifsawah`, password `GatherlyDemo2026!`. Akun panitia aktif `dimas.sawah` memakai password contoh yang sama. Ini kredensial fixture lokal, bukan akun server atau akun acara nyata.

Untuk alur password sementara, buat panitia melalui Pengaturan → Tim, simpan kredensial yang ditampilkan sekali, lalu masuk menggunakan akun tersebut. Password baru minimum 12 karakter. Reset password panitia menghasilkan kredensial baru dan kedaluwarsa 7 hari.

State contoh tersimpan di browser. Untuk mengulang dari awal, hapus data situs khusus `organizer.localhost` di profil browser demo. Jangan menghapus data browser pribadi secara keseluruhan. Jalankan demo di profil/browser terpisah.

## Urutan demo FE 2, sekitar 3 menit

1. Masuk, ganti periode dashboard, cari acara dan buka draf.
2. Buat acara melalui lima langkah, simpan/reload draf, tambah jenis tiket, tinjau lalu terbitkan. Gunakan tanggal di masa depan.
3. Buka kelola acara: ringkasan inventori, filter pesanan, detail tiket, refund sebagian, peserta dan unduh CSV. Sebutkan bahwa refund/pencairan contoh tidak mengirim uang.
4. Buat akun panitia, tunjuk acara, tunjukkan password sekali tampil dan kewajiban menggantinya. Cabut penugasan tanpa menghapus akun.
5. Scan QR melalui kamera atau cari kode `GTH-4A7N-29XM`. Ulangi check-in untuk menunjukkan tiket ditolak setelah digunakan. QR berisi URL tidak membuka situs.
6. Simpan profil/rekening, lihat nomor tersamarkan, ajukan pencairan acara yang tersedia. Tampilkan salah password dan konfirmasi yang tidak cocok.

Kamera sintetis pada E2E membuktikan decoder; izin kamera perangkat fisik tetap diuji lewat HTTPS. Bundle offline backend belum tersedia, sehingga tunjukkan pesan gagal koneksi tanpa mengklaim scan offline beroperasi.

## Pembagian presentasi kelompok, maksimum 10 menit

| Durasi | Pemilik | Materi |
| --- | --- | --- |
| 0:00–0:45 | Sako | Masalah, sasaran, dan fungsi Gatherly |
| 0:45–1:30 | Semua | Pembagian pekerjaan sesuai `docs/team-workflow.md` |
| 1:30–2:15 | Sako/Dien | Next.js/React, Express, MongoDB, cookie/CSRF, Midtrans Sandbox |
| 2:15–4:30 | Ancung | Discovery, autentikasi peserta, reservasi/pembayaran, tiket |
| 4:30–7:30 | Nasta | Demo FE 2 di atas |
| 7:30–9:00 | Dien | Bukti kuota atomik, webhook/recovery, dan check-in sekali pakai |
| 9:00–9:40 | Semua | Hasil pengujian dan batas integrasi yang masih terbuka |

Susunan slide: judul; masalah/alur pengguna; pembagian kerja; teknologi/arsitektur; demo peserta; demo organizer/panitia; pengujian; status deployment/integrasi. Jangan mengisi link web/video dengan alamat rekaan. Rekaman kelompok, PPT final, dan tautan publik masih memerlukan penyelesaian kelompok pada #23–24.

## Bukti yang dapat direview

- Branch `feat/organizer-issues.nasta`, commit bertahap bertaut nomor issue.
- Implementasi: `apps/frontend/src/modules/{organizer-auth,organizer-events,organizer-settings,team,check-in}`.
- Komponen bersama: `WorkspaceShell`, `PageHeader`, `StatCard`, `DataList`, `ResponsiveDialog`, `QueryState`.
- Tes: `apps/frontend/test/{organizer,qr-camera,workspace,settings}.spec.ts`, pada 390/834/1440 px.
- Kontrak yang perlu direview backend: [workspace-api-handoff.md](workspace-api-handoff.md).
- Tidak ada perubahan pada `.pen`, tidak ada data peserta nyata atau credential QR aktif di fixture.
