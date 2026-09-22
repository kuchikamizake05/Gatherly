# Gatherly — Pembagian FE–BE dan kerja tim

Pembagian disepakati: Ancung sebagai FE 1, Nasta sebagai FE 2, Sako sebagai BE 1 sekaligus leader, dan Dien sebagai BE 2. Nama panggilan mengikuti kesepakatan tim; urutan nama pada README bukan urutan posisi.

| Anggota | Posisi | Kepemilikan | Kolaborasi |
| --- | --- | --- | --- |
| Ancung | FE 1 | Public discovery/detail, auth/account, checkout/order status, My Tickets/QR; API client dan auth state web | Review FE 2; konsumsi BE 1 dan BE 2 |
| Nasta | FE 2 | Organizer setup/dashboard/editor, inventory/order/attendee screens, assignment UI, committee scanner; shell dashboard dan tabel | Review FE 1; konsumsi BE 1 dan BE 2 |
| Sako | BE 1 | Auth/session/CSRF, organizer profiles, event/ticket-type CRUD, poster upload, committee assignments | Review BE 2; bantu test transaksi dan deployment |
| Dien | BE 2 | Reservations/orders, payment sessions/webhooks/reconciliation, issuance, check-in, summary/order/attendee APIs | Review BE 1; kontrak inventori bersama BE 1 |

Sako menangani BE 1 sekaligus koordinasi tim. Beban transaksi BE 2 paling berisiko; Sako membantu pengujian concurrency/recovery setelah fondasi auth/event siap. Review, pengujian integrasi, dan deployment dibagi bersama; tentukan owner per pekerjaan agar koordinasi tidak menambah seluruh beban implementasi ke Dien.

## Batas file dan aturan domain

- FE menyepakati shared button/input/dialog/notifikasi sebelum mengembangkan halaman; satu owner per shared-file change.
- BE 1 mengelola kapasitas/harga dan gate penjualan; BE 2 mengelola reserved/sold. Perubahan langsung pada counter di endpoint CRUD dilarang; keduanya memakai aturan/model transaksi yang sama.
- BE 1 menyediakan helper auth/ownership/assignment; BE 2 menggunakannya, bukan membuat pemeriksaan role kedua yang berbeda.
- BE 2 menerbitkan tiket setelah paid; FE tidak membuat credential atau menetapkan lunas.
- Edit skema bersama, API client, lockfile, dan konfigurasi dilakukan melalui PR kecil dan diberitahukan ke pemilik lain.

## Bekerja paralel

FE tidak perlu menunggu seluruh backend. Setelah kontrak terkait direview, buat fixture/mock untuk success/error yang bentuknya sama dengan API. Tandai mock jelas dan matikan pada demo integrasi; jangan menyamarkan data contoh sebagai data backend.

Per fitur, buat child issue FE dan BE, ditambah verifikasi integrasi. Child FE tergantung kontrak, bukan seluruh implementasi BE. Issue integrasi menunggu kedua implementasi. Lakukan demonstrasi kecil saat satu alur selesai.

## Git dan Definition of Done

- Branch memakai nomor GitHub Issue aktual, contoh `3-event-discovery` atau `15-checkout-states`.
- PR kecil menautkan issue terkait, menjelaskan masalah/hasil, bukti verifikasi, dan perubahan kontrak/env bila ada.
- Minimal satu reviewer lain. Review mencakup perilaku dan akses, bukan hanya format kode.
- Owner bertanggung jawab sampai integrasi berjalan; scaffold/generate AI belum berarti selesai.
- Done: acceptance criteria dipenuhi, validasi relevan lulus, review selesai, kode digabung, dokumentasi terkait diperbarui.
- Bug kritis kuota, payment, auth, atau check-in menghalangi penutupan milestone.
- Jangan commit .env, credential, data peserta nyata, atau QR aktif. Dependency audit dilakukan sebelum commit yang mengubah dependency dan ditindaklanjuti berdasarkan temuan.

## Penggunaan AI

Semua anggota boleh memakai AI. Setiap pemilik harus bisa menjelaskan alur, memperbaiki perubahan kecil, dan menunjukkan pengujian. Ukur kontribusi dari tanggung jawab yang selesai, review, pengujian, integrasi, dan koordinasi; bukan jumlah commit/baris/prompt. Catat bantuan anggota lain pada issue. Jangan membuat riwayat kontribusi palsu.

## Tahap kerja tanpa deadline rekaan

1. Review dokumen dan tetapkan owner: scope, wireflow, API, model.
2. Fondasi dan alur event: login → draf → publish → katalog. FE memakai mock sementara BE mengerjakan API.
3. Payment/QR proof of concept lalu reservasi/order/issuance yang terintegrasi.
4. Scanner, assignment, dashboard, dan pengujian concurrency.
5. Deployment demo, perbaikan, bukti rubrik, video maksimal 10 menit.

Review kemajuan mingguan: hasil yang bisa didemokan, hambatan, perubahan scope, dan pekerjaan minggu berikutnya. Tanggal milestone baru diisi setelah deadline mata kuliah dan kapasitas tim diketahui.
