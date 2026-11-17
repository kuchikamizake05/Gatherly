# Implementasi workspace Nasta, 17 November 2026

Branch: `feat/organizer-issues.nasta`. `origin/main` sampai `dda1f94` sudah digabung. Commit dilakukan bertahap menurut issue; belum dipush dan belum menutup issue GitHub.

Seluruh Markdown proyek, termasuk arsip spesifikasi/rencana dan `design/frontend-rules.md`, dibaca sebelum implementasi dilanjutkan. `gatherly.pen` dibaca melalui Pencil sebagai referensi, tanpa perubahan desain. Konvensi komponen diselaraskan dengan pembaruan `main` menjadi PascalCase di folder fitur `components`.

## Hasil implementasi frontend

| Issue | Hasil |
| --- | --- |
| #64 | `WorkspaceShell`, `PageHeader`, `StatCard`, `DataList`, dialog responsif dan state query bersama; sidebar desktop/tablet dan drawer mobile |
| #65 | Login username/password, redirect role, password pertama, lupa/reset password, validasi konfirmasi, error akun/lock/expiry, logout dan pemulihan sesi |
| #66 | Dashboard, periode URL, statistik/chart, perhatian draf/pesanan, daftar acara dengan pencarian/status, kartu mobile dan acara ditugaskan |
| #67 | Ringkasan/inventori acara, filter/pagination pesanan, panel detail, kirim ulang tiket, refund semua/sebagian tiket, peserta/polling/CSV, stop/resume, duplikat dan pembatalan dengan nama/alasan |
| #68 | Navigasi pengaturan, buat panitia/cek username, kredensial sekali tampil, assignment, reset password, nonaktif/aktif/hapus, batas 20 anggota |
| #69 | Profil/logo/tautan, username terkunci, rekening dengan masking, pencairan per acara, password saat ini/baru/konfirmasi |
| #10 | Wizard lima langkah, draf/autosave/restore, waktu Indonesia, batas inventori, review/publish; memakai FileUpload dan RegionFields bersama |
| #17 | Penugasan dan pencabutan per acara, sinkronisasi daftar tim/acara panitia, tanpa menghapus akun |
| #19 | Decoder QR kamera, fallback manual, hasil/riwayat, pencegahan check-in kedua, cleanup kamera, penanganan jaringan dan antrean offline yang belum dikonfirmasi |

Simulasi menyimpan state contoh agar reload, refund, assignment, dan perubahan rekening dapat diuji. Password sementara dibuat acak dan ditampilkan sekali; yang disimpan pada fixture hanya digest, bukan password plaintext. Simulasi browser ini bukan mekanisme autentikasi atau transaksi produksi.

## Verifikasi dan bukti

Suite Playwright mencakup lebar 390/834/1440 px, termasuk lima langkah publish, reload draf, isolasi acara/duplikat, assignment/revoke/deactivation, kredensial/password pertama, password salah/lock, profil, masking/pencairan, refund sebagian/ekspor CSV, check-in ulang, decoding stream QR sintetis, dan penolakan QR URL tanpa navigasi.

Hasil terakhir: **57 passed** pada Next.js 16.4.6 (`pnpm test:e2e --workers=3`). Rangkaian 54 tes sebelum penambahan regresi isolasi acara juga lulus pada ketiga ukuran. Fixture acara baru/duplikat dimulai tanpa penjualan dan pesanan acara lain; identitas, inventori, serta assignment menggunakan state acara terkait.

Pemeriksaan visual tambahan pada dashboard, profil, tim, pencairan, keamanan, pesanan, dan ringkasan di tiga ukuran tidak menemukan overflow horizontal. Nominal pencairan mobile diringkas dengan angka lengkap sebagai caption. Kamera HP nyata dan aksesibilitas menyeluruh semua area aplikasi belum diuji.

Next.js diperbarui menjadi 16.4.6 dan resolusi `source-map-js` diperbarui. Audit production tidak lagi melaporkan advisory pada lockfile frontend. Referensi patch: [advisory image optimization](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), [advisory cache functions](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).

Build produksi menangkap kebutuhan `Suspense` pada form auth yang membaca query URL; batas tersebut sekarang berada di `OrganizerAuthShell`. Build standar tanpa flag mock dan pemeriksaan TypeScript lulus pada dependency yang diperbarui.

## Bagian yang belum selesai secara integrasi/kelompok

- API B28/B33/B35/B38/B39/B41 belum lengkap. DTO event lama belum memuat jenis tiket/field editor baru, create belum menerima draf parsial, dan assignment lama masih berbasis email peserta. Gunakan mode contoh sampai kontrak diselaraskan. Rincian request/response/error ada di [handoff API](workspace-api-handoff.md), disiapkan untuk review tanpa mengirim komentar eksternal.
- #19: bundle offline masih kosong pada adapter pending. Belum ada bukti sinkronisasi offline lintas perangkat atau kamera fisik melalui HTTPS. UI tidak mengklaim check-in berhasil saat koneksi gagal.
- #21–22: tes workspace lulus pada mock. Journey peserta/admin, backend asli, Midtrans/webhook/recovery, keyboard/screen reader menyeluruh, dan kamera fisik masih perlu verifikasi kelompok.
- #23: [runbook frontend](../deployment-frontend.md), akun contoh dan script smoke tersedia. Pemeriksaan `vercel whoami` melaporkan logged out. Deployment publik frontend, domain/HTTPS, integrasi serta tautan README final belum selesai.
- #24: [alur demo, pembagian waktu presentasi dan bukti kontribusi](workspace-demo.md) tersedia. PPT dan rekaman kelompok final belum dibuat. Workflow Presentations mewajibkan `load_workspace_dependencies`, tool yang tidak tersedia pada sesi ini.

Jalankan ulang dari `apps/frontend`: `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`, dan `pnpm audit --prod`. Hasil tes tersimpan di `test-results` (diabaikan Git); jangan mengunggah trace dari data nyata atau credential aktif.
