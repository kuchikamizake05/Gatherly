# Rencana pengerjaan backend Dien

Disusun dan direvisi 17 November 2026 berdasarkan issue, kondisi kode, dan kesepakatan pengguna. Ini urutan pengerjaan, belum komitmen jadwal. Kapasitas dan waktu tersedia belum diketahui. Sisihkan 20% kapasitas untuk integrasi dan perbaikan. Dokumen ini adalah rencana, bukan laporan fitur yang sudah selesai.

Tujuan pekerjaan adalah menghubungkan alur frontend dengan backend yang konsisten, mulai dari akses organizer sampai pembelian, check-in, dan administrasi.

## Keputusan pengguna dan penyesuaian arsitektur

- Backend dihosting di VPS. #58 diubah dari penyesuaian Vercel menjadi worker, penjadwalan, dan deployment VPS. WebSocket menjadi pilihan untuk pembaruan status langsung.
- Email wajib meliputi autentikasi dan pemberitahuan transaksi penting, termasuk e-ticket setelah diterbitkan. Rekomendasi event ditunda. Perbarui keputusan lama #25 dan dokumentasi terkait saat implementasi.
- Check-in wajib online. Saat koneksi putus, scanner tidak boleh mengesahkan tiket. Hapus kebutuhan validasi dan sinkronisasi offline pada #57 saat memperbarui issue.
- Kode saat ini sudah memiliki job rekonsiliasi pembayaran setiap 60 detik dan retry penerbitan tiket setiap 10 detik. Pada VPS, jalankan dengan pengawasan proses dan pertahankan lease/idempotensi agar restart atau beberapa proses tidak menggandakan pekerjaan.
- WebSocket dapat menggantikan polling status pesanan dan scanner yang sekarang setiap 5 detik. Tetap sediakan pembacaan API saat membuka halaman dan setelah tersambung kembali, dengan polling cadangan bila diperlukan.
- Gunakan webhook Midtrans untuk konfirmasi utama, worker untuk rekonsiliasi/retry, dan WebSocket untuk memberi tahu frontend setelah perubahan database tersimpan.
- Email dijalankan melalui pekerjaan tersimpan dengan retry dan deduplikasi. Pembayaran tidak dianggap gagal hanya karena email gagal. SMTP/provider pengiriman tetap diperlukan.
- Jadwalkan pengingat event, pembersihan dokumen sesuai kebijakan retensi, serta backup. TTL dapat tetap menangani data yang memang aman dihapus otomatis.
- Pencairan tetap berupa transfer manual oleh admin. VPS dan cron tidak mengotomatisasi transfer bank atau persetujuan admin.
- Midtrans menggunakan sandbox. Tenggat fleksibel, tidak memakai tenggat demo lama sebagai batas implementasi seluruh backlog.
- VPS tujuan adalah tinjau-vps sesuai pilihan pengguna. Penempatan Gatherly harus mempertahankan layanan existing dan menghindari konflik port.
- Email peserta berisi e-ticket masing-masing. Pembeli menerima ringkasan pesanan. Salinan semua e-ticket ke email pembeli tidak termasuk kesepakatan.
- Pengajuan refund pembeli wajib memiliki alasan jelas dan mendapat persetujuan admin. Batas paling lambat satu bulan sebelum acara sudah dikonfirmasi pengguna, contoh acara 20 Desember berarti batas 20 November. Implementasikan satu bulan kalender memakai zona waktu event dengan aturan akhir bulan yang eksplisit.
- Storage menggunakan Cloudflare R2 sesuai pilihan pengguna. Konfigurasi object storage sudah lengkap dan teruji sebagaimana dicatat di bawah. Jangan tampilkan atau menyalin nilai credential ke dokumen.
- Bucket R2 ditentukan pengguna sebagai gatherly. Isi R2_BUCKET_NAME dengan gatherly pada konfigurasi backend saat integrasi.
- Verifikasi R2 pada 17 November 2026 berhasil menggunakan konfigurasi lokal terbaru. Upload file uji unik mendapat HTTP 200, pembacaan dan kecocokan isi HTTP 200, serta penghapusan file uji HTTP 204. R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, dan R2_BUCKET_NAME tersedia. Endpoint dibentuk dari account ID. Ini memverifikasi akses object, bukan menyatakan integrasi fitur upload aplikasi atau pengaturan privasi bucket sudah selesai.
- Refund yang diminta pembeli harus menyertakan alasan dan mendapat persetujuan admin Gatherly. Biaya layanan 5% tidak dikembalikan untuk refund permintaan pembeli. Bedakan persetujuan admin dari keberhasilan transfer refund di provider.
- Organizer boleh menentukan waktu buka dan tutup scanner per event. Pembukaan harus sebelum penutupan, dan penutupan paling lambat saat event selesai. Tetap wajib online.
- Harga tiket ditetapkan organizer sebagai nilai dasar. Biaya aplikasi 5% ditambahkan di luar harga tersebut. Contoh harga dasar Rp100.000, biaya layanan Rp5.000, total pembeli Rp105.000. Refund permintaan pembeli mengembalikan Rp100.000 dan tidak mengembalikan biaya Rp5.000. Pendapatan organizer berasal dari nilai dasar tiket yang tidak direfund, tidak dipotong lagi 5%.
- Batas satu bulan berlaku pada waktu pengajuan refund, bukan waktu keputusan admin. Admin dapat meninjau pengajuan yang masuk tepat waktu setelah batas tersebut.
- Organizer wajib mengajukan pembatalan event dengan alasan kepada operator Gatherly. Pembatalan baru dijalankan setelah admin menyetujui. Pada pembatalan event yang disetujui, pembeli mendapat refund seluruh pembayaran termasuk biaya layanan. Batas satu bulan untuk permintaan pembeli tidak menghalangi refund karena pembatalan event.
- Email e-ticket peserta berisi lampiran PDF dan tautan tiket. Pembeli menerima ringkasan pesanan. Lampiran dan tautan mengacu ke tiket/QR yang sama, tidak menerbitkan tiket tambahan.
- Pencairan baru boleh dilakukan setelah event selesai dan seluruh refund yang telah disetujui selesai diproses. Cegah persetujuan refund dan pencairan serentak menghasilkan saldo yang tidak konsisten.
- Alamat backend yang disetujui adalah api.gatherly.scientivan.dev. Ketersediaan DNS dan konfigurasi HTTPS belum diverifikasi dan dikerjakan pada tahap deployment.

## Pendekatan implementasi yang diusulkan

Pertahankan Express dan MongoDB yang ada. Pisahkan proses API/WebSocket dan worker agar retry pembayaran, tiket, serta email tidak bergantung pada browser atau restart proses API. Gunakan pekerjaan tersimpan di MongoDB dengan lease, nextAttemptAt, retry, dan kunci deduplikasi. Ini usulan awal yang memanfaatkan pola existing, belum keputusan memilih pustaka tertentu. Redis/antrean terpisah belum diperlukan sampai ada kebutuhan kapasitas atau beberapa instance yang membenarkannya.

Webhook adalah sumber pemberitahuan utama pembayaran. Dalam transaksi database, simpan perubahan bisnis dan pekerjaan lanjutan secara konsisten. Worker memproses tiket dan email. Setelah commit, notifikasi WebSocket memberi tahu klien untuk memperbarui tampilan. Kegagalan notifikasi tidak membatalkan transaksi. Saat reconnect, klien membaca ulang API.

WebSocket wajib memeriksa sesi dan hak akses tiap ruang pesanan/event. Pembeli hanya melihat pesanannya, petugas hanya event penugasannya, organizer hanya event miliknya. QR credential dan data sensitif tidak disiarkan ke semua koneksi. Check-in tetap melalui operasi API atomik, tidak disahkan secara lokal saat offline.

Email autentikasi bersifat segera dengan batas retry sebelum kode kedaluwarsa. Email e-ticket hanya dijadwalkan setelah issuance berhasil, dikirim kepada peserta dengan lampiran PDF dan tautan, dan tidak menggandakan tiket ketika dicoba ulang.

## Paket perubahan dan bukti selesai

| Paket | Lingkup | Bukti selesai |
| --- | --- | --- |
| P0 | Audit #4, dukungan kontrak #5, selisih kebutuhan lama/baru | Matriks endpoint nyata/mock, model existing/baru, transisi dan aturan migrasi tertulis |
| P1 | Fondasi VPS #58 dan mekanisme pekerjaan/email | API dan worker dapat restart, pekerjaan tersimpan dapat dilanjutkan, retry tidak menggandakan efek |
| P2 | Akun workspace #44 dan admin #46 | Login, password sementara, 2FA, sesi, dan pembatasan peran teruji |
| P3 | Pengajuan #45, review #47, organizer #48/#54 | Pengajuan → perbaikan/persetujuan → login organizer berjalan melalui frontend |
| P4 | Akun peserta #52, saved events/profil publik #53 | API nyata terhubung dan otorisasi akun teruji |
| P5 | Event #49, checkout #50, pembayaran/tiket #58 | Reservasi dan pembayaran aman saat concurrency, e-ticket tersedia dan emailnya dapat dicoba ulang |
| P6 | Refund #51 dan pembatalan event #49 | Refund pembeli wajib diajukan tepat waktu dan disetujui admin, biaya layanan tidak kembali. Pembatalan event wajib disetujui admin dan mengembalikan seluruh pembayaran. Retry tidak menggandakan refund dan tiket batal ditolak |
| P7 | Scanner online #57 dan WebSocket #58 | Scan serentak hanya satu berhasil, koneksi putus tidak mengesahkan tiket, reconnect memulihkan tampilan |
| P8 | Pencairan #55 dan laporan peserta #56 | Saldo memperhitungkan refund, pencairan ganda dicegah, laporan hanya dapat ditinjau admin |
| P9 | Integrasi #21, deployment #23, presentasi #24 | Alur nyata lulus smoke test di VPS, dokumentasi dan bukti demo sesuai hasil aktual |

P1 dan P2 mendahului onboarding. P5 menyediakan transaksi dasar sebelum P6. P6 mendahului perhitungan saldo final P8. Infrastruktur WebSocket dapat disiapkan di P1, sementara integrasi status pesanan dilakukan pada P5 dan scanner pada P7. Integrasi frontend, Swagger, Postman, serta pengujian dilakukan pada setiap paket, lalu diverifikasi menyeluruh pada P9.

Titik mulai berikutnya adalah P0. Baca model/service/test yang ada, buat matriks kesenjangan, lalu tentukan perubahan kontrak dan migrasi sebelum mengubah perilaku bisnis. Jangan mengerjakan ulang issue closed tanpa temuan kesenjangan atau regresi.

## Verifikasi implementasi yang masih diperlukan

Keputusan produk utama sudah disetujui pengguna. Tidak ada pertanyaan produk yang menghalangi audit P0. Rincian teknis berikut diperiksa pada tahap terkait.

- Uji koneksi nyata MongoDB replica set, SMTP, OAuth, dan webhook sandbox. Konfigurasi lokal tersedia, tetapi tidak sama dengan pengujian deployment. R2 sudah lolos uji upload, baca, dan hapus.
- Periksa akses DNS api.gatherly.scientivan.dev, origin frontend, sesi cookie, HTTPS/WSS, dan OAuth callback sebelum deployment.
- Catat aturan pembulatan biaya ke integer rupiah, pembagian biaya pada refund parsial, dan perhitungan batas akhir bulan dalam kontrak agar implementasi deterministik.
- Pisahkan status permintaan refund/pembatalan, keputusan admin, dan proses provider. Persetujuan bukan bukti refund telah berhasil. Sesuaikan editor event, halaman pesanan, dan konsol admin untuk alur baru ini.
- Verifikasi batas kemampuan sandbox Midtrans untuk metode pembayaran yang diuji. Refund manual membutuhkan pencatatan bukti dan status terpisah bila provider tidak mendukung otomatisasi.
- Semua perubahan saldo memakai snapshot nilai dasar, biaya layanan, total pembayaran, dan refund. Jangan mengubah perhitungan pesanan historis secara diam-diam.
- Akun organizer dan panitia terpisah membutuhkan rancangan kompatibilitas data lama karena model existing menghubungkan organizer ke User. Tentukan migrasi pada P0.

## Inventaris VPS yang terverifikasi

Pemeriksaan baca-saja pada 17 November 2026 menemukan Simpleart berjalan sebagai container simpleart-blue pada 127.0.0.1 port 3001, Kalis sebagai kalis-backend.service di /opt/kalis/app/backend pada port 8790, serta tiga service Tinjau aktif berupa agent, index-poller, dan xbot. tinjau-scoreboard-api tidak aktif. Tiga container Iabee berhenti. Reverse proxy yang aktif adalah Caddy pada port 80/443, termasuk konfigurasi api.kalis.scientivan.dev menuju 127.0.0.1 port 8790. Timer healthcheck Tinjau juga aktif. Docker, cron, SSH, fail2ban, dan service sistem pendukung berjalan. Tidak ada layanan yang diubah saat pemeriksaan.

Setelah inventaris tersebut, pengguna meminta penghapusan seluruh Tinjau di VPS. Pada 17 November 2026, 12 unit service/timer Tinjau dihentikan dan dihapus beserta direktori /opt/tinjau, akun service, konfigurasi logrotate, dan kunci deploy khususnya. Verifikasi setelah penghapusan menunjukkan tidak ada unit Tinjau, sementara Kalis dan Caddy tetap aktif serta Simpleart tetap healthy. Log historis pada journal sistem bersama tidak dihapus agar riwayat aplikasi lain tetap terjaga. Alias SSH lokal tinjau-vps tetap menjadi nama koneksi VPS yang digunakan untuk Gatherly.

## 1. Audit dan sepakati kontrak

- Review model, indeks, dan transisi yang benar-benar diimplementasikan untuk #4 bersama Sako.
- Koordinasikan kontrak API #5 dengan Sako dan Ancung. Ini tetap tugas mereka, Dien membantu kebutuhan integrasi backend.
- Cocokkan komentar kontrak pada issue dengan modul api.ts frontend dan docs/api-contract.md.
- Selesaikan perbedaan rancangan lama dan baru, terutama akun terpisah, tiket gratis, refund, perubahan event, scanner offline, email, dan deployment.
- Catat kebutuhan perubahan model serta kompatibilitas data lama sebelum menulis fitur.

Hasil tahap ini adalah kontrak, model, dan acceptance criteria yang disepakati. Issue #11–#14, #18, dan #20 yang sudah closed menjadi dasar yang diperiksa untuk regresi.

## 2. Fondasi akses dan deployment

- #44 / B28 untuk akun organizer dan panitia terpisah, password sementara, assignment, dan pembatasan organizer dibekukan.
- #46 / B30 untuk akun admin internal, TOTP, backup codes, dan audit log.
- Mulai #58 / B42 dengan cookie sesi, rate limit dan lockout di MongoDB, serta rancangan pembayaran dan penerbitan tiket tanpa ketergantungan interval lokal.
- Tentukan pemulihan saat webhook atau penerbitan tiket gagal. Pemeriksaan expiresAt tidak boleh melepas kuota yang masih dapat dibayar di provider.

Hasil tahap ini adalah hak akses yang teruji dan mekanisme pemulihan yang sesuai runtime deployment.

## 3. Onboarding dan administrasi organizer

- #45 / B29 untuk form pengajuan, upload dokumen, username, nomor pengajuan, dan perbaikan isian.
- #47 / B31 untuk review, persetujuan, penolakan, dan penerbitan akses organizer. Bergantung pada pengajuan dan autentikasi admin.
- #48 / B32 untuk daftar organizer, freeze, unfreeze, dan kirim ulang akses.
- #54 / B38 untuk profil dan pengaturan keamanan organizer.

Hasil tahap ini adalah satu alur dari pengajuan sampai organizer dapat masuk dan mengelola profil. Dokumen dan endpoint administratif dibatasi sesuai peran.

## 4. Akun peserta dan penemuan event

- #52 / B36 untuk profil peserta, password/reset, koneksi Google, sesi perangkat, preferensi email, dan penghapusan akun.
- #53 / B37 untuk simpan event dan profil publik organizer.

Tahap ini dapat dikerjakan setelah kontrak dan akses siap, tanpa menunggu seluruh administrasi organizer selesai.

## 5. Event dan transaksi

- #49 / B33 untuk konten event, tiket gratis, upload, kontrol penjualan, dan duplikasi draft. Koordinasikan dengan API event milik Sako.
- #50 / B34 untuk data peserta per tiket, pembatalan order pending, pemeriksaan kuota, dan reservasi 15 menit.
- #51 / B35 untuk refund, pembatalan tiket, serta penolakan tiket batal saat check-in.
- Selesaikan pembatalan event pada #49 setelah mekanisme refund tersedia, termasuk status dan pengiriman pemberitahuan.
- Selesaikan bagian pembayaran dan issuance #58, lalu uji retry dan pemulihan kegagalan.

Hasil tahap ini adalah alur transaksi yang menjaga kuota, tidak menggandakan tiket, dan tetap konsisten saat refund atau pembatalan.

## 6. Check-in, pencairan, dan laporan

- #57 / B41 untuk lookup manual, riwayat semua panitia, pembaruan jumlah hadir, dan batas waktu scanner. Check-in wajib online sesuai keputusan pengguna.
- #55 / B39 untuk rekening, saldo bersih per event selesai, permintaan pencairan, serta pencatatan transfer admin. Perhitungan harus memperhitungkan refund dan mencegah pencairan ganda.
- #56 / B40 untuk laporan peserta, akses admin, penutupan dengan catatan, dan hubungan ke freeze organizer.
- Lengkapi sisa #58 untuk pengingat harian dan konfigurasi deployment yang disepakati.

Hasil tahap ini adalah operasi pasca pembelian dan pasca event yang dapat digunakan dari frontend.

## 7. Integrasi dan penyelesaian

- #21 untuk uji end-to-end, otorisasi, concurrency, retry pembayaran, tiket duplikat, refund, dan konflik check-in.
- Uji integrasi database memakai replica set untuk perilaku transaksi nyata. Jalankan typecheck dan build backend.
- Hilangkan pending/mock per endpoint setelah API nyata lolos pengujian bersama frontend.
- Perbarui kontrak, Swagger, Postman, dan bukti pengujian bersama pemilik #5.
- #23 untuk deployment, smoke test, akun demo, dan tautan README bersama tim.
- #24 untuk bukti kontribusi, alur demo, PPT, dan video bersama tim.

Satu PR sebaiknya mencakup satu alur yang dapat ditinjau, dengan perubahan model, API, dan pengujian yang relevan. Jangan menunggu semua fitur selesai untuk integrasi frontend.

## Dependensi dan keputusan terbuka

- Jalur onboarding adalah fondasi akses → pengajuan → review → akun organizer.
- Jalur transaksi adalah fondasi runtime → event → checkout dan pembayaran → tiket → refund/check-in/pencairan.
- Keputusan scanner online dan email wajib di atas menggantikan pertanyaan lingkup sebelumnya. Issue dan dokumen lama masih perlu diperbarui agar sesuai.
- Dokumentasi deployment lama masih memakai endpoint pemeliharaan yang dipanggil scheduler eksternal. Ganti dengan dokumentasi proses/worker VPS setelah penggantinya teruji.
- Tenggat lama #23 dan #24 sudah digantikan kesepakatan tenggat fleksibel untuk rencana ini.
- Semua issue #44–#58 mencantumkan Dien sebagai Owner dalam deskripsi, tetapi belum memiliki Assignee GitHub saat diperiksa. Issue open yang secara formal meng-assign scientivan adalah #4, #21, #23, dan #24.
