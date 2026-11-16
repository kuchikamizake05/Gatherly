# Cara kerja tim Gatherly

## Sebelum mulai

1. Baca [design/frontend-rules.md](design/frontend-rules.md) untuk aturan UI, teks, dan interaksi.
2. Baca [apps/frontend/README.md](apps/frontend/README.md) untuk struktur folder dan cara memakai data.
3. Buka file desain `gatherly.pen` (dari Google Drive tim) di pen.dev. Peta pitanya ada di [design/canvas-structure.md](design/canvas-structure.md).

## Membaca desain

- Satu pita = satu fitur, misalnya "07 · Tiketku".
- Setiap pita punya tiga frame perangkat: Desktop (1440), Tablet (834), Mobile (390).
- Di dalam frame perangkat, satu baris = satu skenario ("A Layar utama", "B ...", dan seterusnya). Langkahnya berjalan ke kanan (A1, A2, ...).
- Titik kuning bernomor menunjukkan elemen yang ditekan. Catatan "Yang terjadi" di bawah layar menjelaskan perilakunya.
- Baris terakhir biasanya keadaan halaman: memuat, kosong, gagal, luring.

## Branch dan PR

- Satu issue = satu branch, misalnya `fe/b43-auth-pembeli` atau `be/b28-akun-organizer`.
- Satu PR untuk satu issue. Tulis `Closes #nomor` di deskripsi PR.
- Sertakan screenshot di 390, 834, dan 1440 px untuk perubahan tampilan.
- Minta review minimal satu orang sebelum merge.

## Cek sebelum membuka PR

- [ ] `pnpm build` di `apps/frontend` lolos tanpa error.
- [ ] Tampilan sama dengan desain di tiga ukuran, tanpa scroll horizontal.
- [ ] Semua keadaan di pita desain sudah ada: memuat, kosong, gagal, luring.
- [ ] Teks mengikuti aturan "Teks dan tampilan" di `design/frontend-rules.md`.
- [ ] Semua yang bisa diklik memakai cursor pointer, fokus keyboard terlihat.
- [ ] Tidak ada komponen dobel. Komponen yang sama dipakai ulang dari `src/components/elements`.

## Komponen bersama

1. Komponen yang dipakai lebih dari satu halaman ditaruh di `apps/frontend/src/components/elements/`, satu file per komponen, dengan komentar singkat di atasnya: dipakai di mana dan rujukan pita desainnya.
2. Sebelum membuat komponen, cek folder itu dulu. Bila sudah ada tapi kurang sesuai, tambahkan prop atau varian, jangan membuat salinan.
3. PR yang menambah komponen bersama mencantumkan contoh pemakaian di deskripsinya dan menandai anggota tim frontend lain.
4. Komponen yang hanya dipakai satu fitur ditaruh di `apps/frontend/src/modules/<fitur>/components/`, bukan di folder `app/`. Folder `app/` hanya untuk routing.
5. Nama file komponen `.tsx` sesuai nama komponennya (`LoginForm.tsx`), file `.ts` huruf kecil (`hooks.ts`). File route Next.js dan `src/components/ui/` tetap huruf kecil.

## Data dari backend

- Semua request lewat modul di `apps/frontend/src/modules/<fitur>/`.
- Endpoint yang belum dibuat backend ditandai `pending: true` dan memakai data contoh. Saat endpoint asli siap, hapus tanda itu di PR terpisah dan cek ulang halamannya.
- Perubahan bentuk data dibahas bersama backend dan dicatat di `docs/api-contract.md`.
