# Gatherly — Panduan Logo

Logo Gatherly adalah huruf **G** yang dibangun dari bentuk ubin app (squircle). Sudut kanan atasnya sengaja dibiarkan
kosong dan diisi **satu titik**: satu orang yang baru bergabung. Titik itulah *titik kumpul*, yang juga menjadi arti
Gatherly dalam bahasa sehari-hari.

Presentasi lengkap dengan mockup ada di [`presentation/gatherly-identity.html`](presentation/gatherly-identity.html)
(versi gambar di `presentation/slides/`).

## 1. Versi logo

| Versi | Kapan dipakai | File |
|---|---|---|
| Horizontal (utama) | Navbar, header email, dokumen | `logo/gatherly-horizontal-*.svg` |
| Bertumpuk | Ruang persegi: poster, badge, splash | `logo/gatherly-stacked-*.svg` |
| Simbol | Avatar, ikon, ruang sempit | `logo/gatherly-symbol-*.svg` |
| Simbol kecil | Di bawah 32 px (celah dibuat lebih lebar) | `logo/gatherly-symbol-small.svg` |
| Wordmark | Bila simbol sudah tampil di dekatnya | `logo/gatherly-wordmark-*.svg` |
| Ikon app | App icon, favicon, PWA | `logo/gatherly-app-icon.svg`, `web/` |

Skema warna di nama file:
- `-ink`: semua hitam, untuk latar putih atau kuning.
- `-on-dark`: G putih dengan titik kuning, untuk latar hitam. Ini versi paling khas.
- `-white`: semua putih, untuk latar foto atau warna gelap lain.

Versi `-on-dark` dan `-white` sengaja dibuat sedikit lebih tipis, karena bentuk putih di atas latar gelap terlihat
lebih tebal (irradiation).

## 2. Ruang kosong

Beri jarak kosong minimal **1 × diameter titik** di semua sisi logo. Jarak ini ikut membesar atau mengecil bersama
logonya, jadi jangan pakai jarak tetap dalam piksel.

## 3. Ukuran minimum

| Versi | Layar | Cetak |
|---|---|---|
| Horizontal | lebar 96 px | lebar 25 mm |
| Simbol | 16 px (pakai `gatherly-symbol-small.svg`) | 6 mm |

## 4. Warna

| Nama | HEX | RGB | CMYK (perkiraan) | Pantone (perkiraan) |
|---|---|---|---|---|
| Kuning Gatherly | `#FFDD33` | 255 221 51 | 0 13 80 0 | ≈ 115 C |
| Ink | `#111113` | 17 17 19 | 0 0 0 95 (rich black 60 40 40 100 untuk bidang besar) | ≈ Black 6 C |

Nilai CMYK dan Pantone di atas masih perkiraan. Cocokkan dengan swatch fisik sebelum naik cetak.

**Pasangan logo dan latar yang boleh dipakai:**
- ink di atas putih
- ink di atas kuning
- G putih + titik kuning di atas ink
- putih di atas foto yang tenang

Titik kuning **tidak** dipakai di atas latar putih, karena kontrasnya terlalu rendah. Di latar terang, pakai versi `-ink`.

## 5. Tipografi

Wordmark-nya adalah **Manrope ExtraBold (800)**, huruf kecil, tracking −3%, yang sudah diubah jadi outline path. Jadi
file logo tidak bergantung pada font yang terinstal. UI juga memakai Manrope. Lisensinya SIL Open Font License, jadi
aman untuk logo dan pemakaian komersial.

## 6. Larangan

- Jangan meregangkan, memiringkan, atau memutar logo.
- Jangan memakai warna di luar kuning dan ink.
- Jangan menambah bayangan, outline, gradient, atau efek lain.
- Jangan memindah, membesarkan, atau menghapus titik.
- Jangan mengetik ulang wordmark dengan font apa pun. Selalu pakai file SVG-nya.
- Jangan menaruh logo di atas foto yang ramai tanpa wadah (misalnya ubin ink).

## 7. Ikon web

Folder `web/` berisi `favicon.ico`, `favicon.svg`, PNG 16/32/48, `apple-touch-icon.png`, `icon-192/512.png`,
`maskable-512.png`, `site.webmanifest`, dan `head-snippet.html`. Untuk Next.js (App Router), salin ikon-ikon ini ke
`apps/frontend/app/` (`favicon.ico`, `icon.svg`, `apple-icon.png`) atau ke `public/` bersama manifest-nya.

## 8. Catatan serah-terima

- Simbol dibangun di kanvas 256 dengan squircle 200 unit, radius luar 80, stroke 48, dan titik r = 28. Palang G
  sedikit lebih tipis dari stroke (44) sebagai koreksi optik untuk garis horizontal.
- Spasi wordmark memakai advance width dan tracking saja, tanpa kerning. Sudah dicek secara visual, tapi perlu
  ditinjau sekali lagi di editor vektor.
- Bentuk-bentuk dalam satu file saling menumpuk dengan aturan `nonzero`. Untuk mesin potong vinyl atau bordir,
  jalankan *Outline Stroke + Unite* di editor vektor dulu.
- Hak merek belum dicek. Lakukan penelusuran di PDKI (pdki-indonesia.dgip.go.id) sebelum logo dipakai publik.
