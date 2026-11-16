# Struktur canvas desain Gatherly (pen.dev)

Disepakati 2026-11-15, diperbarui 2026-11-16. Berlaku untuk file desain `gatherly.pen` (dibagikan lewat Google Drive tim).

## Tata letak besar

Canvas dibaca dari atas ke bawah. Setiap bagian adalah satu **pita** (frame horizontal transparan):
kartu label putih bernomor di kiri, isi di kanan. Pita berikutnya ada di bawahnya.

Ada tiga app dalam satu codebase (routing berdasarkan host):

- **gatherly.xyz**: app utama untuk peserta dan calon organizer (form pengajuan).
- **organizer.gatherly.xyz**: ruang kerja penyelenggara. Akunnya terpisah dari akun peserta: username dipilih di form pengajuan (dicek ketersediaannya), password sementara dikirim lewat email setelah disetujui, dan wajib diganti saat login pertama. Panitia juga login di sini dengan akun yang dibuat organizer (Pengaturan, Tim) dan ditugaskan per acara. Satu form login tanpa pilihan peran; sistem mengarahkan organizer ke dashboard dan panitia ke daftar acara yang ditugaskan.
- **admin.gatherly.xyz**: tim Gatherly meninjau pengajuan, mengelola organizer, mencatat pencairan dana, dan meninjau laporan acara. Menu admin: Pengajuan, Organizer, Pencairan, Laporan.

Pita dikelompokkan per app dengan kartu pembatas hitam. Urutan di canvas mengikuti app, jadi pita 23 berada di kelompok organizer (setelah 19) dan pita 24 di kelompok admin (setelah 22).

| No | Bagian | App |
| --- | --- | --- |
| 00 | Peta desain | Fondasi |
| 01 | Arsitektur informasi (peran, pohon halaman per app, navigasi, alur besar) | Fondasi |
| 02 | Design system | Fondasi |
| 03 | Jelajahi & cari | gatherly.xyz |
| 04 | Detail acara (termasuk G. Melaporkan acara) | gatherly.xyz |
| 05 | Checkout | gatherly.xyz |
| 06 | E-tiket & bukti bayar | gatherly.xyz |
| 07 | Tiketku | gatherly.xyz |
| 08 | Disimpan | gatherly.xyz |
| 09 | Profil penyelenggara | gatherly.xyz |
| 10 | Masuk, daftar & verifikasi (login dengan kode OTP email) | gatherly.xyz |
| 11 | Lupa password | gatherly.xyz |
| 12 | Akun saya | gatherly.xyz |
| 13 | Pengajuan organizer (pilihan daftar baru / perbaiki pengajuan, cek username, terkirim, email) | gatherly.xyz |
| 14 | Masuk organizer & panitia (login, ganti password pertama, lupa password) | organizer.gatherly.xyz |
| 15 | Dashboard organizer | organizer.gatherly.xyz |
| 16 | Buat & edit acara | organizer.gatherly.xyz |
| 17 | Kelola acara (tiket, pesanan, peserta, penugasan panitia) | organizer.gatherly.xyz |
| 18 | Tim & panitia (buat akun panitia, tugaskan, cabut, nonaktifkan) | organizer.gatherly.xyz |
| 19 | Scan tiket (panitia dan organizer: pindai QR, cari manual, riwayat) | organizer.gatherly.xyz |
| 23 | Pengaturan organizer (profil, rekening pencairan, pengajuan pencairan, ubah password) | organizer.gatherly.xyz |
| 20 | Masuk admin | admin.gatherly.xyz |
| 21 | Tinjau pengajuan | admin.gatherly.xyz |
| 22 | Daftar organizer | admin.gatherly.xyz |
| 24 | Pencairan & laporan (tandai transfer manual, tinjau laporan acara) | admin.gatherly.xyz |

## Pita fitur (03–24)

Tiga frame perangkat berjajar: **Desktop (1440) | Tablet (834) | Mobile (390)**.

Di dalam frame perangkat:

- **Satu baris = satu skenario** (A. Layar utama, B. Cari acara, C. Filter, ..., state halaman di baris terakhir).
- Langkah berjalan ke kanan. **Setiap langkah ditampilkan full page.**
- Elemen yang ditekan diberi **titik kuning bernomor** di atas layarnya.
- Panah ke langkah berikutnya membawa label dengan nomor yang sama, misalnya "① Klik kolom cari".
- Di bawah setiap layar desktop dan mobile ada catatan **"Yang terjadi"**.

## Pola tetap

- Mobile: tombol aksi di bagian bawah, dialog dan menu tampil sebagai lembar bawah, toast di tengah atas.
- Desktop dan tablet: toast di kanan bawah layar pertama.
- Daftar di mobile ringkas: judul dan status satu baris, info lain digabung di baris abu-abu.
- Kartu acara di dashboard mobile: seluruh kartu membuka Kelola, menu "···" di kanan atas.
- Tab tanpa garis abu-abu panjang di bawahnya.
- Tidak ada fitur notifikasi di organizer dan admin.

## Data contoh yang dipakai konsisten

- Acara utama: **Festival Jazz di Sawah** oleh **Kolektif Sawah** (@kolektifsawah, sejak 2021), Desa Wisata Brayut, Sleman. Sabtu, 21 November 2026, 15.00–22.00 WIB.
- Tiket: Presale Rp80.000 (1–7 Oktober, kuota 50) dan Reguler Rp100.000 (8 Oktober–20 November, kuota 200). Terjual 168 dari 250. Maksimal 4 tiket per pesanan.
- Pesanan Aulia: GTH-4A7N, 2 tiket Reguler, dibayar 14 Oktober 2026 (tiket GTH-4A7N-29XM Aulia, GTH-4A7N-31PL Rafi).
- Pengajuan Kolektif Sawah: PNG-2609-0042, disetujui Senin, 14 September 2026.
- Biaya layanan 5% dipotong dari pendapatan organizer. Pembeli tidak membayar biaya tambahan.
- Tiket ditahan 15 menit saat pembayaran. Pengingat acara dikirim satu hari sebelum acara.
- Unggahan maksimal 1 MB per gambar, PDF legalitas maksimal 2 MB.
- Domain: gatherly.xyz.

## Kartu komponen (02)

Setiap komponen punya satu kartu spesifikasi:

1. Kapan dipakai
2. Anatomi berlabel
3. Varian dan ukuran
4. Matriks **semua** state (default, hover, pressed, focus, disabled, loading, error, terisi, dst. sesuai komponen)
5. Tabel interaksi "aksi → hasil" untuk mouse, keyboard, dan sentuh

Aturan brand dan gaya tetap berlaku: light mode, kuning `#FFDD33` + ink `#111113`, Manrope,
tanpa teks kapital semua yang di-tracking lebar, ilustrasi state berupa tiket geometris + titik kuning.
Aset brand ada di [brand/](brand/).
