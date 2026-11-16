# Aturan frontend Gatherly

Disepakati 2026-11-16. Berlaku untuk `apps/frontend` (gatherly.xyz, organizer.gatherly.xyz, admin.gatherly.xyz).
Rujukan visual: [canvas-structure.md](canvas-structure.md) dan pita 02 Design system di file pen.dev.

## Stack

| Kebutuhan | Pilihan |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, token di `app/globals.css` |
| Komponen dasar | shadcn/ui (Radix), ikon lucide |
| Lembar bawah mobile | Drawer dari shadcn |
| Toast | sonner |
| Form | react-hook-form + zod |
| Data dari API | Server Components untuk halaman publik, TanStack Query untuk halaman yang butuh login |
| Tanggal | date-fns locale `id` |
| QR | qrcode (tampil), qr-scanner (kamera) |
| Unggah foto | browser-image-compression sebelum dikirim |
| Scanner offline | idb-keyval |
| Font | Manrope lewat `next/font` |

## Tiga app dalam satu project

- `app/(main)` untuk gatherly.xyz, `app/organizer` untuk organizer.gatherly.xyz, `app/admin` untuk admin.gatherly.xyz. Rincian folder ada di `apps/frontend/README.md`.
- `proxy.ts` membaca host lalu me-rewrite ke folder yang sesuai. Folder `organizer` dan `admin` tidak bisa dibuka lewat domain utama.
- Lokal: `localhost:3000`, `organizer.localhost:3000`, `admin.localhost:3000`.
- Komponen bersama ada di `src/components/ui` (shadcn), `src/components/elements` (komponen gabungan), dan `src/components/layout` (navbar, sidebar, topbar).

## Responsif

| Desain | Breakpoint | Lebar |
| --- | --- | --- |
| Mobile 390 | tanpa prefix | < 768 px |
| Tablet 834 | `md:` | 768 sampai 1279 px |
| Desktop 1440 | `xl:` | ≥ 1280 px |

- Tulis untuk mobile dulu, lalu tambahkan `md:` dan `xl:`.
- Mobile: dialog dan menu memakai Drawer dari bawah, tombol aksi utama menempel di bawah layar.
- Mobile: tabel menjadi daftar ringkas, judul dan status dalam satu baris, info lain digabung di baris abu-abu.
- Sidebar organizer dan admin: desktop bisa diciutkan, tablet tampil ciut, mobile menjadi laci kiri.
- Tidak boleh ada scroll horizontal di halaman.

## Keadaan halaman

Setiap fitur punya keadaan memuat, kosong, gagal, dan luring sebagai halaman atau bagian penuh, sesuai desain.

- **Wajib penuh lebar dan penuh tinggi.** Keadaan kosong, tidak ditemukan, gagal, kedaluwarsa, berhasil, dan sejenisnya selalu memakai `StateView`, yang mengisi seluruh lebar dan tinggi ruang yang tersedia. Isinya di tengah, dan di mobile tombol aksinya menempel di bawah layar.
- Jangan bungkus `StateView` dengan wadah yang membatasi lebar atau tinggi (misalnya `max-w-*`, `h-*`, atau `div` tanpa flex). Taruh langsung di halaman, atau di wadah `flex flex-1 flex-col w-full`.
- Di dalam kartu, pakai `layout="section"`: tetap selebar kartu dengan jarak dalam, tidak menempel ke tepi.
- Memuat juga mengikuti ukuran penuh: skeleton mengisi lebar konten dan mengikuti bentuk aslinya.

- **Memuat konten:** skeleton shimmer sesuai bentuk aslinya. Bila data datang di bawah 300 ms, skeleton tidak ditampilkan.
- **Aksi:** spinner kecil di tombol, tombol dikunci, label berubah (Simpan menjadi Menyimpan).
- **Per route:** `loading.tsx`, `error.tsx`, dan `not-found.tsx`.
- **Kosong:** satu aksi utama saja, tidak ada tombol yang sama di tempat lain.

## Interaksi

- **Semua elemen yang bisa diklik wajib `cursor: pointer`**: tombol, tautan, kartu yang bisa diklik, tab, chip, checkbox, radio, switch, select, dan label yang memicu input. Elemen nonaktif memakai `cursor: not-allowed`. Aturan dasarnya dipasang di `globals.css`, jangan bergantung pada bawaan Tailwind v4.
- Area sentuh minimal 44 px.
- Fokus keyboard terlihat: cincin 2 px dengan jarak 2 px, hanya saat `:focus-visible`.
- Ikon tanpa teks wajib punya `aria-label`.
- Form: validasi saat kolom ditinggalkan, bukan saat mengetik. Saat dikirim dan ada kesalahan, halaman menggulir ke kolom pertama yang salah.
- Toast: kanan bawah di desktop dan tablet, tengah atas di mobile. Toast bisa diusap untuk ditutup.

## Motion

Prinsip: makin sering sesuatu dilihat, makin sedikit gerakannya. Animasi hanya memakai `transform` dan `opacity`.

Token (di `@theme` pada `globals.css`):

- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` untuk elemen yang muncul atau merespons.
- `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` untuk elemen yang berpindah di layar.
- `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` untuk Drawer.
- Hover dan perubahan warna memakai `ease`. Jangan pernah memakai `ease-in`.

Durasi: tekan 100 sampai 160 ms, menu dan tooltip 150 ms, muncul 200 ms, hilang 150 ms, Drawer 300 ms.

Aturan:

- Tombol dan kartu yang ditekan mengecil ke skala 0.97.
- Hover hanya untuk mouse: `@media (hover: hover) and (pointer: fine)`.
- Elemen muncul dengan fade dan naik 8 px. Tidak pernah membesar dari nol.
- Menu dan popover membesar dari 0.96 ke arah pemicunya. Dialog membesar dari tengah.
- Pergantian label tombol (Simpan, Menyimpan, Tersimpan) memakai crossfade 200 ms dengan blur 2 px.
- Aksi keyboard dan pindah tab tanpa animasi, kecuali garis tab aktif yang boleh bergeser.
- Perubahan tata letak (sidebar diciutkan) memakai `ease-in-out` 200 ms, tanpa animasi saat halaman pertama dimuat.
- Skeleton memakai shimmer linear pelan lalu crossfade ke konten. Konten yang sudah pernah dimuat tampil langsung.
- Angka penting (penjualan, saldo, total bayar) tidak menghitung naik dan tidak memantul. Nilai baru cukup crossfade.
- Badge jumlah yang berubah membesar sekali dari 0.9 ke 1.
- `prefers-reduced-motion: reduce`: fade dan warna tetap, gerakan dan skala dimatikan.

Momen di Gatherly:

| Seberapa sering | Contoh | Gerakan |
| --- | --- | --- |
| Berkali-kali sehari | Jelajahi acara, daftar pesanan, scan tiket | Efek tekan dan crossfade saja |
| Kadang | Simpan acara, profil tersimpan, pencairan diajukan | Muncul singkat 200 ms tanpa pegas |
| Jarang | Pembayaran berhasil, e-tiket terbit, acara pertama terbit | Pegas kecil sekitar 400 ms |
| Sekali | Akun organizer pertama kali aktif | Pegas masuk, item muncul bergantian 50 ms |

## Teks dan tampilan

Berlaku untuk semua teks yang dilihat pengguna: judul, tombol, label, pesan error, toast, dan email.

| Aturan | Benar | Salah |
| --- | --- | --- |
| Tanpa em dash (—). En dash (–) hanya untuk rentang singkat yang memang tertulis begitu di desain: jam dan chip harga. Selain itu pakai "sampai", jeda pakai koma atau kalimat baru. | 15.00 – 22.00 WIB, Rp50–150rb, Buka sampai Jumat | Acara seru — jangan lewatkan |
| Minim "·", ":", dan ";". Pecah jadi kalimat pendek atau baris terpisah. | Sab, 21 Nov 2026, Desa Wisata Brayut | Sab · 21 Nov · Brayut |
| Huruf kapital hanya di awal kalimat dan nama diri. Tanpa teks kapital semua dengan tracking lebar. | Simpan perubahan | SIMPAN PERUBAHAN, Simpan Perubahan |
| Tanpa eyebrow (label kecil di atas judul). | Judul langsung | "FITUR UNGGULAN" di atas judul |
| Bahasa baku dengan "Anda" (A kapital). Tanpa bahasa santai. | Periksa email Anda | Cek email kamu yuk |
| Tombol diawali kata kerja dan spesifik. | Simpan rekening, Ajukan pencairan | OK, Submit, Ya |
| Pesan error menjelaskan apa yang terjadi dan apa yang harus dilakukan, tidak menyalahkan, tanpa kode teknis. | Koneksi terputus. Periksa internet Anda lalu coba lagi. | Error 500, Input Anda salah |
| Tanpa emoji. Tanda seru hanya untuk momen berhasil yang jarang. | Anda siap berangkat! | Berhasil disimpan! 🎉 |
| Elipsis (…) hanya untuk proses yang sedang berjalan. | Memastikan pembayaran Anda… | Lihat selengkapnya… |
| Setiap input punya label yang terlihat. Placeholder hanya contoh isi. | Label "Email", placeholder "nama@email.com" | Hanya placeholder "Masukkan email" |

Istilah baku (ikuti desain, jangan diganti sinonim):

| Pakai | Jangan |
| --- | --- |
| Masuk, Keluar, Daftar | Login, Logout, Sign up |
| e-tiket, Tiketku | E-Ticket, Tiket Saya |
| penyelenggara (halaman publik), organizer (ruang organizer dan admin) | EO, host |
| panitia | staf, crew |
| password, email | kata sandi, surel |
| pesanan, pembayaran, pengembalian dana | order, payment, refund (di teks UI) |
| pencairan dana | withdraw, payout (di teks UI) |

Format:

- Rupiah `Rp100.000`, tanpa spasi. Angka ringkas di kartu sempit `Rp36,25 jt`.
- Tanggal `Sab, 21 Nov 2026` atau `Sabtu, 21 November 2026`. Jam 24 jam dengan titik dan zona: `15.00 WIB`.
- Semua lewat helper di `src/lib/format.ts`, jangan diformat manual.

Tampilan:

- Light mode saja.
- Warna, radius, bayangan, dan durasi hanya dari token di `globals.css`. Tidak ada kode hex langsung di komponen, kecuali di ilustrasi.
- Ikon hanya dari lucide, ukuran 16, 18, 20, atau 24.
- Logo aplikasi atau merek lain (Instagram, TikTok, X, Google, bank, e-wallet, dan sejenisnya) diambil dari [thesvg.org](https://thesvg.org) (`/icons/<nama>/mono.svg` atau `default.svg`), lalu ditaruh di `src/components/elements/BrandIcons.tsx`. Jangan menggambar ulang sendiri.

## Gambar

- Pakai `next/image` dengan rasio tetap: poster 16:9, foto penampil lanskap.
- Foto dikompres di browser sebelum diunggah. Batas 1 MB per gambar, PDF legalitas 2 MB.

## Data

- Semua request lewat satu `apiClient` di `src/lib/api` yang mengurus cookie sesi, header CSRF, dan pemetaan pesan error.
- Data yang berubah langsung (hitungan scanner, status pembayaran) memakai polling TanStack Query tiap 3 sampai 5 detik.
