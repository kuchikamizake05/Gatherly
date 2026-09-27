# Desain Struktur Repository dan Dokumentasi Milestone 1

## Tujuan

Menyiapkan repository Gatherly untuk pengumpulan Milestone 1 dengan struktur monorepo yang konsisten, Postman collection yang aman, dan README yang sesuai dengan implementasi aktual.

## Struktur target

```text
Gatherly/
├── apps/
│   ├── server/
│   └── web/
├── docs/
├── postman/
│   ├── Gatherly API.postman_collection.json
│   ├── Gatherly Local.postman_environment.json
│   └── README.md
├── package.json
├── package-lock.json
└── README.md
```

`backend` berpindah ke `apps/server` dan memakai nama package `@gatherly/server`. `frontend` berpindah ke `apps/web` dan memakai nama package `@gatherly/web`.

Folder template lain tidak disalin karena Gatherly belum membutuhkan MCP server, shared package, contract package, atau service terpisah.

## Migrasi workspace

Perpindahan memakai Git rename agar sejarah file tetap terbaca. Root `package.json` mengubah workspace menjadi `apps/server` dan `apps/web`, kemudian memperbarui script `dev`, `build`, dan `typecheck` ke nama package baru.

`package-lock.json` dibuat ulang melalui npm agar path workspace dan nama package sinkron. Source import internal tidak berubah karena struktur di dalam masing-masing aplikasi tetap sama.

Dokumentasi aktif seperti README, `docs/README.md`, dan `docs/architecture.md` mengikuti path baru. Dokumen spesifikasi historis dalam `docs/superpowers` tetap memakai path lama karena menjelaskan konteks implementasi saat dokumen dibuat.

## Postman collection

Collection mencakup endpoint yang telah tersedia untuk:

- health check;
- autentikasi dan profil organizer;
- event dan ticket type;
- order dan payment session;
- webhook Midtrans;
- tiket buyer;
- lookup dan check-in panitia;
- ringkasan, order, dan attendee organizer.

Request dikelompokkan berdasarkan domain. Collection menggunakan variable untuk base URL, ID resource, idempotency key, CSRF token, QR payload, ticket code, dan signature webhook. Script test menyimpan ID serta CSRF token dari respons yang relevan dan memeriksa status dasar.

Collection menyediakan contoh body, header, query, serta deskripsi akses. Contoh respons yang dapat direproduksi disimpan sebagai Postman examples setelah endpoint dijalankan pada database test. Endpoint Midtrans tetap memakai sandbox dan tidak menyimpan server key dalam export.

Environment lokal hanya berisi nilai dummy atau kosong. File tidak memuat password nyata, MongoDB URI, Midtrans Server Key, cookie sesi aktif, atau credential QR aktif. `postman/README.md` menjelaskan urutan penggunaan, cara memperoleh cookie melalui login, cara mengisi variable lokal, dan batasan webhook sandbox.

## README utama

README diperbarui untuk:

- menghapus pernyataan bahwa aplikasi masih pada tahap perencanaan;
- menjelaskan kemampuan yang sudah tersedia;
- menampilkan struktur `apps/server` dan `apps/web`;
- mencantumkan stack aktual;
- menyediakan langkah instalasi, konfigurasi environment, development, build, typecheck, dan integration test;
- menautkan dokumentasi dan Postman collection;
- mempertahankan daftar anggota kelompok;
- menyediakan placeholder URL laporan Google Drive yang jelas sampai tim memberikan tautan final.

README tidak mengklaim deployment atau fitur frontend yang belum tersedia.

## Verifikasi

Migrasi dianggap berhasil bila:

- `npm install` menyelesaikan workspace dengan nama dan path baru;
- root typecheck dan build lulus;
- integration test server lulus terhadap `gatherly_test`;
- tidak ada referensi aktif ke workspace lama;
- JSON collection dan environment Postman valid;
- Git tidak mendeteksi kehilangan file aplikasi;
- repository tidak memuat credential atau session aktif.

## Kriteria selesai

Pekerjaan selesai ketika repository memakai struktur target, semua aplikasi tetap dapat dibangun dan diuji, Postman collection dapat diimpor tanpa rahasia, serta README menjelaskan kondisi proyek dan proses pengembangan secara akurat.
