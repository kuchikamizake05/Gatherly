# Gatherly — Pengujian dan bukti penilaian

Rencana, belum hasil uji. Setiap issue memiliki acceptance criteria. Simpan hasil relevan pada PR/Linear: kondisi, input, hasil yang diharapkan, hasil aktual, dan bukti. Jangan menulis passed sebelum dijalankan.

## Matriks pengujian

| ID | Skenario | Hasil wajib | Penanggung jawab awal |
| --- | --- | --- | --- |
| T01 | Daftar/login/logout; password salah; sesi expired | Password tersimpan hash; sesi invalid ditolak; logout benar-benar mencabut sesi | BE 1 + FE 1 |
| T02 | Akses order/tiket/CRUD milik akun lain | Ditolak di API meski URL/body dimodifikasi | BE 1 + BE 2 |
| T03 | Publish tanpa data/tipe/poster; tanggal invalid | Validasi field jelas; draf tidak muncul publik | BE 1 + FE 2 |
| T04 | Dua checkout bersamaan untuk satu slot | Satu sukses, satu konflik; counters konsisten | BE 2, direview BE 1 |
| T05 | Retry checkout key sama; payload diubah | Tidak ada order ganda; perubahan payload menghasilkan 409 | BE 2 |
| T06 | Checkout berlomba dengan edit kuota/tutup sales | Aturan gate dan capacity konsisten; tidak ada overselling | BE 1 + BE 2 |
| T07 | Sesi payment timeout setelah request terkirim | Recovery tidak membuat sesi payable ganda atau melepas stok prematur | BE 2 |
| T08 | Webhook invalid/nominal berbeda/duplikat/urutan terbalik | Invalid tidak menerbitkan tiket; duplikat tidak menggandakan; paid tidak turun | BE 2 |
| T09 | Expiry job berlomba dengan paid notification | Inventory berubah sekali; status provider direkonsiliasi; tanpa stok negatif | BE 2, direview BE 1 |
| T10 | Crash setelah paid sebelum issuance; restart worker | Jumlah tiket tepat sesuai quantity; UI processing pulih ke issued | BE 2 + FE 1 |
| T11 | Browser kembali tanpa callback sukses, popup ditutup | Backend menentukan status; pending dapat dilanjutkan; tidak ada pembayaran kedua otomatis | FE 1 + BE 2 |
| T12 | QR valid, salah acara, invalid, di luar waktu masuk | Hasil jelas dan sesuai; tidak ada informasi pribadi lintas acara | BE 2 + FE 2 |
| T13 | Dua petugas scan bersamaan; respons pertama hilang | Satu check-in; scan ulang tidak menambah jumlah; waktu asli ditampilkan | BE 2 + FE 2 |
| T14 | Assignment dicabut; role/body dipalsukan | Akses scan tidak diberikan tanpa assignment yang sah | BE 1 + BE 2 |
| T15 | Kamera ditolak/tidak ada; koneksi terputus | Kode manual tersedia; kegagalan koneksi bukan sukses/invalid ticket | FE 2 |
| T16 | Poster terlalu besar, MIME palsu, upload tak berhak | Ditolak; tidak ada file berbahaya; error form dapat dipulihkan | BE 1 + FE 2 |
| T17 | Mobile, keyboard, loading/empty/error, cetak QR | Semua alur utama terbaca dan dapat dioperasikan; tidak ada data mock aktif | FE 1 + FE 2 |
| T18 | Clean checkout dan deployment demo | Setup terdokumentasi; webhook/kamera/worker/DB berfungsi; tanpa rahasia di repo | Owner deployment + reviewer |

## Lapisan verifikasi

### Pemeriksaan kesesuaian UI–API

- T19 — Filter harga: Presale habis tidak menjadi startingPrice; filter inklusif cocok dengan tipe aktif dalam rentang; min > max ditolak; acara tanpa tiket tersedia hanya muncul tanpa filter harga. Periksa matchingStartingPrice dan pagination.total. Owner BE 1 + FE 1.
- T20 — Ringkasan organizer: dua organizer tidak saling melihat metrik; quantity dan gross sales berasal dari paid orders sekali; batas from inklusif/to eksklusif berdasarkan paidAt; publishedEvents tetap angka saat ini; empty menghasilkan nol. Owner BE 2 + FE 2.
- T21 — Detail order organizer: event/order yang tidak cocok atau milik pihak lain menghasilkan 404; timeline tidak berulang akibat webhook duplikat; QR/payment credential tidak bocor. Owner BE 2 + FE 2.
- T22 — Riwayat panitia: hanya check-in sukses pada event ditugaskan; newest-first dan pagination benar; counter keseluruhan tidak sama dengan panjang halaman; assignment dicabut menolak request selanjutnya; tidak ada email/nominal/QR. Owner BE 2 + FE 2.

- Unit: aturan harga, status, permissions, validasi.
- API integration: Mongo replica set test terisolasi; transaksi/concurrency dan unique constraints sungguhan.
- Payment adapter tests: provider responses yang deterministik untuk error/duplikat; lanjut minimal satu alur nyata sandbox sampai webhook.
- Browser E2E: daftar/login, publish/katalog, checkout/tiket, committee check-in.
- Manual perangkat: kamera HP dan izin/HTTPS. Emulator saja tidak membuktikan kamera perangkat bekerja.

Jangan menjalankan pengujian destruktif terhadap database demo atau data anggota. Reset hanya database test yang eksplisit. Jadwalkan pemeriksaan recovery dan concurrency sebelum milestone transaksi dinyatakan selesai.

## Pemetaan rubrik

| Rubrik | Bukti yang disiapkan |
| --- | --- |
| G1 ketepatan fitur | Alur tiga peran lengkap, T03–T14, kebutuhan US3 |
| G2 kontribusi | Assignment disepakati, issue/PR/review/bukti hasil; bukan hitungan commit |
| G3 alur pengembangan | Commit dan integrasi bertahap sepanjang pengerjaan |
| G4 presentasi | Setiap anggota menjelaskan bagian miliknya dan keputusan penting |
| G5 video | Video kelompok maksimal 10 menit |
| BE1 Express / BE2 MongoDB | Kode, konfigurasi aman, demo data persisten |
| BE3 CRUD | Tambah/baca/ubah/hapus draf acara tanpa order |
| BE4 hashing | Penjelasan penyimpanan hash tanpa menampilkan password atau secret |
| BE5 pengamanan API | T01–T02, T08, T14–T16; session/CSRF/ownership |
| FE1 Next / FE3 struktur | Routing, reusable components, logika API terpisah |
| FE2 desain / FE4 interaktivitas | Responsif dan states pada T17 |
| FE5 API/form | Data API, validasi client/server, error recovery |
| BE6 / FE6 ketepatan waktu | Deadline diisi setelah diberikan; submit lebih awal |
| G6 tambahan | Midtrans sandbox sebagai kandidat bukti integrasi; penerimaan demo sandbox dikonfirmasi pada dosen |

## Susunan demo maksimal 10 menit

Usulan 9 menit: masalah/scope 1 menit; organizer membuat/publish acara 2 menit; pembelian sandbox dan tiket 2 menit; scan berhasil lalu duplicate 1,5 menit; keamanan/kuota dan bukti test 1,5 menit; kontribusi/penutup 1 menit. Siapkan data demo fiktif dan periksa koneksi sebelum rekaman.
