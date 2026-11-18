# Panduan Mencoba Gatherlyy

Panduan ini untuk mencoba Gatherlyy versi produksi dari empat sisi: peserta, organizer, panitia, dan admin. Semua pembayaran memakai Midtrans mode Sandbox, jadi tidak ada uang sungguhan yang ditarik.

| Peran | Alamat |
| --- | --- |
| Peserta | [gatherlyy.fun](https://gatherlyy.fun) |
| Organizer dan panitia | [organizer.gatherlyy.fun](https://organizer.gatherlyy.fun) |
| Admin | [admin.gatherlyy.fun](https://admin.gatherlyy.fun) |

## Akun demo admin

Akun ini khusus untuk penilaian dan pengujian.

| Data | Nilai |
| --- | --- |
| Email | `demo@gatherlyy.fun` |
| Password | `Demo-ArwUvveEc2My` |
| Kunci authenticator (TOTP) | `RMJC3AOFTW3TPCG4EZKHLPLSQVKYVKNX` |

Konsol admin meminta kode 2FA setelah password. Pilih salah satu cara.

1. **Aplikasi authenticator** (Google Authenticator, Microsoft Authenticator, Authy, dan sejenisnya). Pilih *Tambah akun*, lalu *Masukkan kunci penyiapan*. Isi nama akun `Gatherlyy Admin Demo`, tempel kunci di atas, dan pilih jenis *berbasis waktu*. Masukkan 6 digit yang tampil di aplikasi.
2. **Kode cadangan**. Tekan *Gunakan kode cadangan* di halaman kode. Setiap kode hanya berlaku satu kali, dan harus diketik lengkap dengan tanda hubung.

   `t7sm-sq88`, `v6ru-cbbk`, `e4tb-r9xf`, `tgpp-cdh7`, `8828-7e39`, `basg-r93h`, `ezba-5x9s`, `b3s9-2ws4`

Akun peserta tidak disediakan, karena siapa pun bisa mendaftar sendiri. Akun organizer dan panitia dibuat lewat alur di bawah, supaya seluruh proses ikut teruji.

## 1. Peserta: mencari acara sampai mendapat e-tiket

1. Buka [gatherlyy.fun](https://gatherlyy.fun), lalu tekan **Daftar**. Daftar dengan email (kode verifikasi dikirim ke email) atau dengan akun Google.
2. Di beranda, cari acara lewat kolom pencarian atau pilih kategori, misalnya **Teknologi**.
3. Buka salah satu acara. Halaman detail menampilkan deskripsi, jadwal, lokasi dengan peta, penyelenggara, dan pilihan tiket.
4. Pilih jumlah tiket, lalu tekan **Beli tiket**.
5. Isi data peserta. Centang **Ini tiketku** untuk memakai data akun sendiri. Periksa ringkasan pesanan, lalu tekan **Lanjut ke pembayaran**.
6. Pilih metode pembayaran, misalnya **BCA Virtual Account**, lalu salin nomor VA yang muncul.
7. Bayar lewat simulator Midtrans Sandbox, bukan lewat aplikasi bank sungguhan:
   - BCA VA: [simulator.sandbox.midtrans.com/bca/va/index](https://simulator.sandbox.midtrans.com/bca/va/index). Tempel nomor VA, tekan **Inquire**, lalu **Pay**.
   - QRIS: [simulator.sandbox.midtrans.com/v2/qris/index](https://simulator.sandbox.midtrans.com/v2/qris/index). Tempel URL gambar QR dari halaman pembayaran.
8. Kembali ke tab Gatherlyy. Setelah pembayaran terkonfirmasi, halaman berganti menjadi **Anda siap berangkat!** dan e-tiket dikirim ke email.
9. Buka **Tiketku** untuk melihat e-tiket dengan kode QR. Dari sini peserta bisa mengunduh e-tiket PDF, menambahkan acara ke kalender, mengunduh bukti pembayaran, atau mengajukan pengembalian dana (paling lambat satu bulan sebelum acara).

## 2. Organizer: mengajukan diri dan mengelola acara

1. Masuk sebagai peserta di [gatherlyy.fun](https://gatherlyy.fun), lalu buka [gatherlyy.fun/become-organizer](https://gatherlyy.fun/become-organizer).
2. Isi formulir pengajuan: data penyelenggara, penanggung jawab, dan foto KTP. Untuk pengujian, cukup pakai gambar contoh.
3. Masuk ke [konsol admin](https://admin.gatherlyy.fun) dengan akun demo admin. Buka **Pengajuan**, pilih pengajuan tadi, lalu tekan **Setujui**.
4. Username dan password sementara organizer dikirim ke email penanggung jawab. Masuk di [organizer.gatherlyy.fun](https://organizer.gatherlyy.fun), lalu ganti password saat diminta.
5. Di **Dashboard**, organizer melihat ringkasan penjualan dan hal yang perlu diperhatikan.
6. Buka **Acara**, lalu **Buat acara**. Editor terdiri dari lima langkah: info acara dan poster, waktu dan tempat (dengan pratinjau peta), jenis tiket, detail, lalu tinjau dan terbitkan. Selama belum diterbitkan, acara tersimpan sebagai draf.
7. Supaya acara bisa langsung dipindai saat pengujian, centang **Atur waktu check-in sendiri** di langkah waktu dan tempat, lalu isi **Buka check-in** dengan waktu yang sudah lewat. Secara bawaan, check-in baru dibuka dua jam sebelum acara dimulai.
8. Setelah acara terbit, buka **Kelola** pada acara tersebut. Tab **Ringkasan**, **Pesanan**, **Peserta**, **Tiket**, dan **Panitia** dipakai untuk memantau penjualan, melihat detail pesanan, mengekspor CSV, dan mengatur panitia.

## 3. Panitia: check-in dengan kode QR

1. Sebagai organizer, buka **Pengaturan**, lalu **Tim**, dan tekan **Tambah anggota**. Username dan password sementara panitia ditampilkan sekali setelah akun dibuat.
2. Buka acara, lalu tab **Panitia**, dan tekan **Tugaskan panitia** untuk anggota tersebut.
3. Masuk sebagai panitia di [organizer.gatherlyy.fun](https://organizer.gatherlyy.fun), sebaiknya lewat ponsel. Panitia hanya melihat acara yang ditugaskan kepadanya.
4. Tekan **Mulai scan** dan izinkan akses kamera. Arahkan kamera ke QR pada e-tiket dari langkah peserta. Hasil hijau **Tiket valid** muncul dan peserta tercatat hadir.
5. Tekan **Pindai berikutnya**, lalu pindai QR yang sama sekali lagi. Hasil merah **Tiket sudah digunakan** muncul, karena satu tiket hanya berlaku untuk satu kali masuk.
6. Tanpa kamera, gunakan **Cari manual** dengan nama peserta atau kode tiket. Semua pemindaian tercatat di **Riwayat**.

## 4. Admin: operasional platform

Masuk di [admin.gatherlyy.fun](https://admin.gatherlyy.fun) dengan akun demo admin.

| Menu | Yang bisa dicoba |
| --- | --- |
| Pengajuan | Meninjau, menyetujui, menolak, atau meminta perbaikan pengajuan organizer |
| Organizer | Melihat daftar organizer beserta statistiknya, membekukan atau mengaktifkan kembali organizer |
| Pencairan | Melihat pencairan dana organizer untuk acara yang sudah selesai dan menandainya sudah ditransfer |
| Keuangan | Memutuskan permintaan pembatalan acara dan pengembalian dana dari pembeli |
| Laporan | Meninjau laporan acara dari pengguna |

## Catatan

- Data di produksi adalah data contoh untuk tugas. Mohon tidak menghapus atau membekukan organizer dan acara milik orang lain.
- Pembayaran Sandbox hanya bisa diselesaikan lewat simulator Midtrans. Aplikasi m-banking sungguhan tidak bisa membayar VA atau QRIS Sandbox.
- Email (kode verifikasi, e-tiket, persetujuan organizer) kadang masuk ke folder spam.
