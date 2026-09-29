# Rencana Implementasi Google OAuth dan Email OTP

1. Tambahkan dependency Passport Google dan Nodemailer beserta type package.
2. Perluas konfigurasi environment dan `.env.example` tanpa menambahkan secret nyata.
3. Perluas model user, lalu tambahkan model OTP challenge dan OAuth state beserta indeks.
4. Pisahkan pembuatan session dari route agar semua metode login memakai mekanisme yang sama.
5. Buat mail service ber-interface kecil dengan Nodemailer transport untuk runtime dan fake transport untuk test.
6. Implementasikan pembuatan, resend, konsumsi, expiry, attempt limit, dan concurrency OTP.
7. Ubah route register/login menjadi alur dua tahap dan pertahankan `/auth/me` serta logout.
8. Konfigurasikan Passport Google tanpa Passport session dan implementasikan state sekali pakai.
9. Implementasikan account linking berdasarkan `googleId` lalu email Google terverifikasi.
10. Perbarui Postman collection, kontrak API, requirement, dan README konfigurasi.
11. Tambahkan integration test OTP serta unit/integration test boundary Google OAuth.
12. Jalankan dependency audit, typecheck, build, dan seluruh integration test.
