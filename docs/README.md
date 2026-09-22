# Panduan dokumen Gatherly

Diperbarui 22 September 2026. Paket ini adalah rancangan kerja, bukan laporan aplikasi yang sudah selesai.

## Keputusan yang sudah tetap

- Next.js untuk frontend, ExpressJS untuk backend, MongoDB untuk database.
- Satu monorepo, dengan dua aplikasi pada `apps/web` dan `apps/api`.
- Pembagian tanggung jawab FE 1, FE 2, BE 1, BE 2; nama anggota belum ditetapkan.
- Linear untuk pekerjaan tim, GitHub untuk kode dan review.
- Target biaya Rp0; pembayaran Midtrans sandbox; email otomatis ditunda.

## Urutan baca

| Dokumen | Fungsi | Pemakai utama |
| --- | --- | --- |
| [requirements.md](requirements.md) | PRD ringkas: tujuan, scope, aturan bisnis, penerimaan | Semua anggota |
| [user-flows.md](user-flows.md) | Halaman, alur, dan keadaan gagal | FE dan reviewer BE |
| [architecture.md](architecture.md) | Struktur dan batas tanggung jawab teknis | Semua anggota |
| [data-model.md](data-model.md) | Koleksi, relasi, indeks, status, konsistensi data | BE, direview FE |
| [api-contract.md](api-contract.md) | Kontrak awal untuk implementasi dan mock FE | FE + BE |
| [team-workflow.md](team-workflow.md) | Kepemilikan, review, kerja paralel, aturan AI | Semua anggota |
| [integrations.md](integrations.md) | Kebutuhan eksternal, biaya, konfigurasi | BE dan penanggung jawab deployment |
| [testing.md](testing.md) | Pengujian risiko dan bukti rubrik | Semua anggota |
| [linear-workflow.md](linear-workflow.md) | Konfigurasi project Linear | Leader |
| [linear-backlog.md](linear-backlog.md) | Urutan milestone dan parent issue | Leader + semua anggota |

## Cara memakai

PRD menjadi acuan perilaku produk. Kontrak API menjadi acuan payload dan mock FE. Bila berubah, ubah dokumennya dalam PR yang sama dan beri tahu pemakai endpoint sebelum merge. Istilah status dalam API/model tidak boleh diganti sepihak.

Rancangan teknis awal menggunakan TypeScript, npm workspaces, sesi berbasis cookie, dan struktur modul. Ini usulan implementasi yang dapat direview tim; belum ada instalasi dependency atau scaffold aplikasi. Versi runtime/dependency dipilih dan dikunci saat setup.

## Pertemuan pertama

1. Baca PRD: pastikan batas pembelian, reservasi 15 menit, dan aturan perubahan acara diterima tim.
2. Tetapkan anggota ke empat posisi dan penanggung jawab koordinasi/deployment.
3. Review contoh API dan wireflow; tandai keputusan yang memerlukan perubahan.
4. Masukkan backlog ke Linear, baru pilih pekerjaan yang siap dikerjakan.
5. Demonstrasi integrasi pertama: login organizer → buat dan publikasikan acara → tampil di katalog peserta.

Tenggat dan nama owner tidak diada-adakan. Tidak ada workspace atau issue Linear yang dibuat oleh penyusunan dokumen ini.
