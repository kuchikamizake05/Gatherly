# Gatherly — Alur pengguna dan halaman

Pembagian role: **FE 1 — Ancung**, **FE 2 — Nasta**, **BE 1 — Sako**, **BE 2 — Dien**. Lihat [tanggung jawab tim](team-workflow.md).

Dokumen fungsional untuk wireframe; bukan keputusan final gaya visual. Bahasa Indonesia, rupiah, dan zona waktu eksplisit. Harga/kuota dihitung backend.

## Daftar halaman

| Route web | Akses | Isi dan aksi utama | Pemilik |
| --- | --- | --- | --- |
| `/` dan `/events` | Publik | Cari/filter acara terpublikasi, buka detail | FE 1 |
| `/events/[slug]` | Publik | Poster, informasi, tipe tiket, pilih 1–4 unit | FE 1 |
| `/login`, `/register` | Publik | Autentikasi; kembali ke tujuan semula | FE 1 |
| `/account` | Login | Lihat nama/email dan logout | FE 1 |
| `/checkout/[orderId]` | Pemilik order | Data peserta yang sudah diisi, ringkasan, countdown, bayar | FE 1 |
| `/orders/[orderId]` | Pemilik order | Pending/verifying/paid/failed/expired dan aksi lanjut | FE 1 |
| `/my-tickets`, `/tickets/[ticketId]` | Pemilik | Daftar tiket/pesanan, QR per unit, status masuk, cetak | FE 1 |
| `/organizer/setup` | Login | Buat profil organizer sendiri | FE 2 |
| `/organizer`, `/organizer/events` | Organizer | Daftar acara sendiri dan ringkasan | FE 2 |
| `/organizer/events/new`, `/organizer/events/[id]/edit` | Owner | Wizard data acara, poster, tipe tiket, preview/publish | FE 2 |
| `/organizer/events/[id]` | Owner | Tab inventori, orders, peserta, panitia; tutup penjualan | FE 2 |
| `/committee`, `/committee/events/[id]/scan` | Panitia ditugaskan | Pilih acara, kamera, lookup manual, hasil scan | FE 2 |

## Peserta

Katalog menyediakan filter rentang harga. Harga pada kartu berasal dari tipe yang masih dapat dibeli: Presale habis tidak lagi menjadi harga awal. Saat filter harga aktif, tampilkan matchingStartingPrice sebagai harga yang cocok filter. Acara tanpa tiket tersedia menampilkan badge status, bukan angka harga yang menyesatkan.

Katalog → detail → login bila perlu → pilih tipe/jumlah dan isi nama peserta → reservasi server → checkout → Snap sandbox → status terverifikasi → tiket QR.

Nama peserta dikumpulkan pada langkah sebelum POST order; halaman checkout adalah ringkasan setelah reservasi berhasil. Pilihan dari sebelum login dipertahankan, tetapi kuota dicek ulang setelah login. Bila kuota tidak cukup, tetap di pemilihan tiket dan tampilkan ketersediaan terbaru. Jangan mulai countdown sebelum order berhasil dibuat.

Tutup popup pembayaran → order tetap pending; lanjutkan sesi yang sama dari halaman order. Timer habis → pembayaran tidak dimulai ulang; server memastikan status provider. Paid tetapi tiket belum siap → tampilkan pemrosesan, bukan tombol bayar lagi. Status pembayaran dibaca ulang melalui API; tidak disimpulkan dari redirect.

## Organizer

Login → profil organizer → draf acara → tambah tipe tiket → preview → publish → lihat katalog. Semua field wajib harus valid sebelum publish. Hapus hanya draf tanpa pesanan; konfirmasi sebelum hapus. Tutup penjualan tidak membatalkan pesanan aktif. Penetapan panitia menggunakan email akun yang sudah ada.

Dashboard organizer membaca `/organizer/summary`: jumlah published saat ini dan metrik penjualan berlabel periode. Tab Pesanan membuka detail read-only dari `/organizer/events/:id/orders/:orderId`, termasuk pembeli, rincian harga, timeline, dan referensi tiket tanpa QR rahasia.

## Panitia

Login → daftar acara yang ditugaskan → izinkan kamera → pindai → tunggu API → hasil → scan berikutnya. Alternatif: cari kode/nama pada acara tersebut → pilih tiket → konfirmasi check-in dengan API yang sama.

Hasil: berhasil, sudah digunakan (dengan waktu), salah acara, tidak valid, belum/jauh lewat waktu check-in, akses dicabut, atau gagal koneksi. Pada koneksi gagal jangan menyatakan tiket invalid maupun berhasil. Jika respons sukses sebelumnya hilang, scan ulang bisa menunjukkan sudah digunakan; tampilkan waktu untuk membantu verifikasi petugas.

Tambahkan halaman `/committee/events/[id]/check-ins` (FE 2), dituju melalui tombol Riwayat pada scanner. Gunakan GET `/committee/events/:id/check-ins` untuk daftar dan counter total hadir/paidTickets. Sediakan empty, loading, retry, pagination, dan akses dicabut; tombol kembali membuka scanner acara yang sama. Semua petugas yang masih ditugaskan melihat riwayat acara tersebut, bukan hanya scan mereka sendiri.

## Komponen dan state bersama

FE 1 memiliki API client, auth state, dan kartu acara; FE 2 memiliki shell organizer, tabel, scanner. Button/input/dialog/notification disepakati bersama dengan satu owner per perubahan.

Semua halaman data memiliki loading, empty, error/retry; form memiliki label, validasi, disabled saat submit, dan pelestarian input saat error. Dialog keyboard-accessible, fokus terlihat, target sentuh cukup besar, status memakai teks dan ikon. Mobile scanner dan QR diuji pada HP, bukan hanya emulator.

Email, reset password berbasis email, OAuth, refund, kursi, dan offline scanner tidak perlu dirancang sebagai fitur aktif MVP. Prompt Stitch sebelumnya adalah bahan eksplorasi; bila berbeda, PRD dan dokumen ini menjadi acuan terbaru.
