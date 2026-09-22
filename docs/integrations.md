# Gatherly — Integrasi dan batas biaya Rp0

Rancangan 22 September 2026. Tidak ada akun, pembelian, atau layanan yang diaktifkan oleh dokumen ini. Free tier memiliki batas; jangan mengaktifkan upgrade atau billing tanpa keputusan tim.

| Kebutuhan | Pilihan | Keputusan MVP dan kendala |
| --- | --- | --- |
| Pembayaran | Midtrans Snap sandbox | Dipakai; uang simulasi; akun dan sandbox keys diperlukan |
| QR generation | qrcode | Library lokal, tanpa akun/API berbayar; QR payload berasal dari BE |
| QR scanner | qr-scanner | Library browser, tanpa biaya per scan; validasi tiket tetap di API |
| Kamera | getUserMedia browser | Izin pengguna dan HTTPS/localhost; uji HP nyata, sediakan kode manual |
| Database | MongoDB Atlas Free atau replica set lokal | MongoDB wajib; Atlas Free kandidat bersama; gunakan database dev/test terpisah |
| Poster | Lokal saat development; Cloudinary Free kandidat deployment | Pilih free tier bila batas mencukupi; akun diperlukan untuk cloud; jangan gunakan filesystem ephemeral sebagai penyimpanan final |
| Unduh tiket | Tampilan cetak browser | Save as PDF; tidak butuh generator PDF eksternal |
| Lokasi | Alamat + tautan lokasi | Tidak butuh API peta berbayar |
| Email tiket/reset password | Ditunda | Bukan dependensi MVP; halaman Tiket Saya tetap berfungsi |
| Hosting | Dipilih saat spike deployment | Harus mendukung Next, Express, HTTPS, webhook, dan job reconciliation; tidak menjanjikan selalu aktif gratis |

## Payment spike

Buktikan satu transaksi dummy melalui Snap → simulator → webhook terverifikasi → status di API. Setelah berhasil, hubungkan dengan reservasi. Server Key hanya di Express; Client Key dapat dipakai frontend. Pastikan mode sandbox pada script, API endpoint, dan key sekaligus.

Webhook memerlukan URL yang dapat diakses provider. Development bisa memakai tunnel HTTPS; URL yang berubah harus diperbarui di dashboard. Saat deployment, cek endpoint dari luar dan lakukan transaksi sandbox baru. Frontend dapat tetap lokal selama konfigurasi return URL dan akses provider sesuai.

Kegagalan provider tidak boleh menghilangkan data order. Job pemulihan harus berjalan kembali setelah restart atau hosting tidur. Di demo, aktifkan layanan terlebih dahulu dan verifikasi semua dependensi sebelum presentasi.

## Environment yang direncanakan

| Variable | Aplikasi | Rahasia/fungsi |
| --- | --- | --- |
| MONGODB_URI | API | Rahasia koneksi dan user database dengan hak minimum |
| SESSION_SECRET | API | Rahasia untuk sesi; berbeda dev/test |
| WEB_ORIGIN | API | Origin tepercaya untuk request browser/CSRF |
| MIDTRANS_SERVER_KEY | API | Rahasia sandbox; tidak masuk NEXT_PUBLIC |
| MIDTRANS_IS_PRODUCTION | API | false; deployment demo harus menolak true tanpa perubahan scope |
| API_INTERNAL_URL | Web server | Target proxy ke Express; tidak dipakai sebagai secret storage |
| NEXT_PUBLIC_MIDTRANS_CLIENT_KEY | Web | Public sandbox key untuk Snap |
| POSTER_STORAGE | API | local atau cloudinary sesuai environment |
| UPLOAD_DIR | API | Folder development yang dipilih eksplisit |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | API | Hanya bila cloudinary dipilih; secret tidak dikirim ke browser |

Nama variable adalah kontrak awal untuk scaffold. Buat .env.example tanpa nilai nyata saat kode setup dibuat. Jangan menampilkan credential pada screenshot, log, issue, atau video.

## Rubrik tambahan

Payment gateway termasuk daftar bonus. Email ditunda demi biaya/scope. QR/kamera adalah kebutuhan inti dan tidak dianggap otomatis sebagai bonus pihak ketiga. Cloudinary tidak identik dengan Google Drive yang disebut rubrik; konfirmasi dosen jika ingin mengklaim bonus. Deployment selain Vercel juga tercantum, tetapi pilih platform berdasarkan kelayakan dan batas gratis, bukan hanya poin.

## Sumber resmi

- [Midtrans sandbox gratis dan simulasi](https://docs.midtrans.com/docs/testing-payment-on-sandbox)
- [Snap integration](https://docs.midtrans.com/docs/snap-snap-integration-guide)
- [QR generation](https://github.com/soldair/node-qrcode)
- [QR scanner](https://github.com/nimiq/qr-scanner)
- [Kamera dan secure context](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Atlas Free](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
- [Cloudinary plans](https://cloudinary.com/pricing)
- [Batas domain test Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

Rujukan ditinjau saat penyusunan; batas layanan diperiksa kembali ketika akun dan deployment benar-benar dibuat.
