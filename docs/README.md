# Panduan dokumen Gatherly

Diperbarui 22 September 2026. Paket ini adalah rancangan kerja, bukan laporan aplikasi yang sudah selesai.

## Keputusan yang sudah tetap

- Next.js untuk frontend, ExpressJS untuk backend, MongoDB untuk database.
- Satu monorepo, dengan dua aplikasi pada `frontend` dan `backend`.
- Pembagian final: Ancung — FE 1, Nasta — FE 2, Sako — BE 1 sekaligus leader, Dien — BE 2.
- GitHub Issues dan GitHub Project untuk pekerjaan tim, kode, dan review.
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

## Cara memakai

PRD menjadi acuan perilaku produk. Kontrak API menjadi acuan payload dan mock FE. Bila berubah, ubah dokumennya dalam PR yang sama dan beri tahu pemakai endpoint sebelum merge. Istilah status dalam API/model tidak boleh diganti sepihak.

Rancangan teknis awal menggunakan TypeScript, npm workspaces, sesi berbasis cookie, dan struktur modul. Ini usulan implementasi yang dapat direview tim; belum ada instalasi dependency atau scaffold aplikasi. Versi runtime/dependency dipilih dan dikunci saat setup.

## Pertemuan pertama

1. Baca PRD: pastikan batas pembelian, reservasi 15 menit, dan aturan perubahan acara diterima tim.
2. Gunakan pembagian posisi yang disepakati; tetapkan owner pekerjaan bersama seperti deployment.
3. Review contoh API dan wireflow; tandai keputusan yang memerlukan perubahan.
4. Gunakan [GitHub Project Gatherly MVP](https://github.com/users/kuchikamizake05/projects/3/views/1) untuk memperbarui status pekerjaan, lalu pilih issue yang siap dikerjakan.
5. Demonstrasi integrasi pertama: login organizer → buat dan publikasikan acara → tampil di katalog peserta.

Project [Gatherly MVP](https://github.com/users/kuchikamizake05/projects/3/views/1) dan 25 issue sudah dibuat di GitHub. Semua issue masih berada di Backlog tanpa assignee akun GitHub dan tanpa deadline. Tenggat belum ditetapkan.
