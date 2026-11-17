# Frontend admin, issue #70 sampai #74

Rujukan: pita 13, 17, 20, 21, 22, dan 24 pada `gatherly.pen`, `design/frontend-rules.md`, serta kriteria issue GitHub. Pekerjaan ini menyelesaikan antarmuka dengan adapter `pending: true`. Ini bukan bukti bahwa API admin, pengiriman email, transfer bank, atau pencatatan audit backend sudah berjalan.

## Cakupan

| Issue | Implementasi dan regresi |
| --- | --- |
| #70 | Unggah lewat pemilih/seret berkas, kompresi gambar, batas ukuran/format, progres, pembatalan yang mengabaikan hasil terlambat, kegagalan saat luring. Konfirmasi teks harus persis cocok; Dialog desktop/tablet dan Drawer mobile. Penampil gambar/PDF, zoom/rotasi gambar, unduh, keyboard, penutupan, dan kegagalan memuat gambar. PDF memakai kontrol bawaan penampil browser. |
| #71 | Email kerja, password, verifikasi autentikator, kode cadangan, ingat perangkat, kontak admin utama, akun terkunci/nonaktif, kode salah, sesi/challenge berakhir, luring. Form memakai React Hook Form dan Zod. |
| #72 | Antrean/tab dengan hitungan, pencarian dan jenis organizer, CSV data yang ditampilkan pada mock, detail, penandaan sembilan bagian dengan catatan wajib, persetujuan, perbaikan, penolakan, label/nilai sebelumnya, dokumen, username bentrok, konflik admin lain, kosong/gagal/luring. |
| #73 | Daftar/detail organizer yang konsisten, pencarian, tab aktif/belum masuk/dibekukan, statistik dan penanggung jawab, acara dan aktivitas, bekukan/aktifkan/kirim ulang akses, konfirmasi dan alasan. |
| #74 | Antrean/riwayat pencairan, referensi dan tanggal transfer wajib, larangan tanggal masa depan, rekening lengkap hanya pada konfirmasi transfer; daftar/detail laporan, alasan dan pelapor, kelanjutan ke pembekuan, catatan penutupan wajib, serta pencegahan tindakan ulang setelah reload. |

Semua route hanya merender komponen modul. Tabel desktop memakai komponen `Table` bersama; mobile memakai daftar ringkas. Tab, checkbox, select, input, tombol, skeleton, dialog/drawer, dan StateView menggunakan komponen yang sudah ada.

## Menjalankan verifikasi

Di `apps/frontend`: `pnpm build`, `pnpm typecheck`, dan `pnpm audit --json`. Jalankan hasil build dengan `pnpm start --port 3225`.

Dari root, dengan Python Playwright dan Chromium terpasang:

```powershell
$env:GATHERLY_TEST_URL = 'http://admin.localhost:3225'
$env:GATHERLY_TEST_WIDTH = '390' # ulangi dengan 834 dan 1440
python apps/frontend/test/admin-browser.test.py
```

Suite menggunakan konteks browser terpisah pada tiap tes. Screenshot halaman tersimpan di `apps/frontend/test-results/<lebar>/` dan diabaikan Git. Pengecekan lebar mendeteksi scroll horizontal, dan tes admin mengumpulkan kesalahan runtime browser. Tidak ada script lint atau pengukuran coverage pada proyek ini; hasil browser tidak boleh disebut coverage kode 80%.

## Data demo dan skenario

Kredensial **fiktif khusus adapter mock**: `nadia@gatherly.xyz`, password `GatherlyDemo123!`, kode `123456`, kode cadangan `DEMO-BACKUP-01`. Email `locked@gatherly.xyz`, `disabled@gatherly.xyz`, dan `limited@gatherly.xyz` menguji pesan kegagalan. Kode cadangan demo hanya sekali per sesi browser. Simulasi sesi/ingat perangkat memakai storage browser dan tidak memberi keamanan autentikasi sebenarnya.

Perubahan fixture disimpan per sesi di `gatherly_admin_demo_changes_v1`, sehingga tab, detail, hitungan, dan reload tetap konsisten. Dokumen pada `public/mock/` merupakan contoh tanpa identitas pribadi.

Untuk state yang sulit dipicu, isi sessionStorage `gatherly_admin_scenario_<scope>` dengan `error` atau `empty`, lalu reload. Scope: `applications`, `organizers`, `payouts`, `reports`. Scope `applications` juga menerima `username_conflict` dan `review_conflict`. Hapus key untuk kembali normal. Ini hanya dibaca oleh adapter mock, tidak mencegat API sungguhan.

## Ketergantungan integrasi

| Issue backend | Yang belum boleh diklaim dari mock |
| --- | --- |
| #46 / B30 | Autentikator sungguhan, pemakaian kode cadangan, trusted-device, pembatasan percobaan, keamanan cookie/CSRF dan kebijakan sesi server. |
| #47 / B31 | Transaksi keputusan pengajuan, pembuatan akun organizer, email, keunikan username, konflik dua admin, URL dokumen yang terlindungi dan pencatatan aksesnya. CSV seluruh hasil dari backend. |
| #48 / B32 | Pembekuan penjualan seluruh acara, email/password sementara dan audit aktivitas sebenarnya. |
| #55 / B39 | Pencatatan transfer manual yang tahan retry/konkurensi. UI tidak memindahkan uang. |
| #56 / B40 | Laporan peserta, pengaitan organizer/acara, penyelesaian dan riwayat audit yang tersimpan di database. |

#64 / B48 masih terbuka, tetapi shell dan komponen bersama yang diperlukan sudah tersedia dan digunakan; tidak menghalangi pengujian frontend ini. #70 sudah ditutup lewat pekerjaan tim sebelumnya; perubahan di sini memperbaiki regresi komponen bersama tersebut. Issue #71 sampai #74 tetap terbuka sampai perubahan di-commit, di-push, ditinjau dan digabung.

## Catatan kontrak untuk integrasi

Sumber tipe dan endpoint tetap `src/modules/admin/api.ts`. Prefix HTTP nyata `/api/v1`; mutasi melewati apiClient agar cookie/CSRF diurus bersama. Endpoint belum dialihkan ke backend.

- Detail pengajuan membutuhkan `previousValues?: Partial<Record<keyof Application, string>>` untuk label Diperbarui. Alternatif bentuk dari backend perlu dipetakan di adapter.
- Detail laporan membutuhkan `resolutionNote?: string` untuk menampilkan catatan setelah ditutup.
- Error yang ditangani meliputi `NOT_FOUND`, `USERNAME_TAKEN`, `ALREADY_REVIEWED`, `CHALLENGE_EXPIRED`, `SESSION_EXPIRED`, `ACCOUNT_LOCKED`, `ACCOUNT_DISABLED`, `RATE_LIMITED`, dan kegagalan koneksi. Pesan kepada pengguna tetap bahasa Indonesia tanpa kode teknis.
- Dokumen dibuka dari `documents[].url`; pencatatan akses dilakukan backend saat URL terlindungi diakses, sesuai draft komentar #47. File mock statis tidak mencatat akses.
- Catatan alasan/perbaikan maksimal 2.000 karakter; referensi transfer maksimal 100 karakter; tanggal transfer dikirim sebagai ISO dan harus tidak di masa depan. Server tetap wajib memvalidasi ulang.
- Saat API siap, hapus `pending: true` dalam PR integrasi terpisah, samakan bentuk data/error, hubungkan ekspor CSV backend, dan ulangi tes dengan layanan sebenarnya. `NEXT_PUBLIC_SITE_URL` dapat mengatur tautan halaman publik bila domain deployment berbeda.

## Hasil verifikasi terakhir

Verifikasi pada build produksi lokal Next.js 16.4.5, tanpa rebuild selama suite berjalan:

| Pemeriksaan | Hasil |
| --- | --- |
| Browser Chromium, 390 px | 32/32 lolos, 201,602 detik |
| Browser Chromium, 834 px | 32/32 lolos, 187,263 detik |
| Browser Chromium, 1440 px | 32/32 lolos, 191,349 detik |
| Total eksekusi skenario | 96/96 lolos |
| Error runtime halaman browser | Tidak ditemukan oleh listener `pageerror` pada suite admin |
| Scroll horizontal | Tidak ditemukan pada tujuh route daftar/detail yang diperiksa di tiap ukuran |
| `pnpm build` dan pemeriksaan TypeScript di build | Lolos |
| `pnpm typecheck` terpisah | Lolos |
| `pnpm audit --json` frontend | 0 kerentanan pada audit terakhir |
| `git diff --check` | Lolos |
| Lint dan persentase coverage | Belum tersedia sebagai script proyek; tidak diklaim lolos atau mencapai persentase tertentu |

Build masih menampilkan peringatan pemilihan root akibat lockfile root dan frontend. Build selesai berhasil; lockfile milik tim tidak dihapus untuk menyembunyikan peringatan.

Tes: `apps/frontend/test/admin-browser.test.py`. Log lokal: `apps/frontend/test-results/admin-390.txt`, `admin-834.txt`, dan `admin-1440.txt`. Screenshot daftar, detail, masuk, verifikasi, dan skeleton ada di subfolder ukuran masing-masing. Artefak lokal diabaikan Git dan dapat dilampirkan saat membuat PR.

Cara mengulang dari root repo, dengan Python Playwright yang sudah terpasang dan frontend berjalan di port 3218:

```powershell
$env:GATHERLY_TEST_URL = 'http://admin.localhost:3218'
$env:GATHERLY_TEST_WIDTH = '390' # ulangi dengan 834 dan 1440
python apps/frontend/test/admin-browser.test.py
```

Regresi yang direproduksi gagal sebelum diperbaiki meliputi dokumen yang belum terhubung, ID pengajuan tidak dikenal yang menampilkan salinan data, laporan tertutup yang masih bisa ditindak, fokus pencarian hilang, unggahan luring yang tampak berhasil, acara draf yang hilang, tautan acara laporan yang salah, dan catatan melebihi batas panjang.

Scope frontend berbasis mock siap untuk commit dan review. Build dan tes lokal tidak menggantikan review tim atau pengujian backend/deployment.
