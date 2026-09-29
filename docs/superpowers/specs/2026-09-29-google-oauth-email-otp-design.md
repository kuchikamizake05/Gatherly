# Desain Google OAuth dan Email OTP

## Tujuan

Menambahkan dua jalur autentikasi ke Gatherly:

1. login dan registrasi melalui Google menggunakan `passport-google-oauth20`;
2. verifikasi OTP melalui email untuk registrasi dan login dengan password.

Kedua jalur menghasilkan session Gatherly yang sama. Passport tidak mengelola session terpisah.

## Keputusan utama

- Email OTP dikirim melalui Nodemailer dengan konfigurasi SMTP generik. Gmail App Password dapat digunakan untuk demo.
- Automated test memakai fake mail transport dan tidak mengirim email sungguhan.
- Register biasa membuat user hanya setelah OTP berhasil diverifikasi.
- Login biasa membuat session hanya setelah password dan OTP berhasil diverifikasi.
- Register yang berhasil langsung membuat session agar pengguna tidak menerima OTP kedua.
- Google dan password memakai dokumen user yang sama.
- Akun Google hanya dapat dibuat atau ditautkan ketika Google menyatakan email telah terverifikasi.

## Model user

Dokumen user memperoleh:

- `passwordHash`, opsional untuk akun Google-only;
- `googleId`, opsional dan unik dengan sparse index;
- `emailVerifiedAt`, waktu email pertama kali diverifikasi melalui OTP atau Google.

Ketika callback Google menerima email terverifikasi:

1. cari user berdasarkan `googleId`;
2. jika tidak ada, cari user berdasarkan email ternormalisasi;
3. jika email sudah ada, tautkan `googleId` ke user tersebut;
4. jika email belum ada, buat user Google-only;
5. tolak bila `googleId` sudah terhubung ke user lain atau email Google tidak terverifikasi.

Pencocokan setelah akun tertaut memakai `googleId`. Access token dan refresh token Google tidak disimpan karena Gatherly hanya membutuhkan identitas pengguna.

## Challenge OTP

Koleksi `AuthChallenge` menyimpan:

- `purpose`: `register` atau `login`;
- email ternormalisasi;
- `userId` untuk login;
- nama dan password hash sementara untuk register;
- hash OTP;
- `expiresAt`, `resendAt`, `attempts`, dan `usedAt`;
- waktu pembuatan dan pembaruan.

OTP terdiri dari enam digit, berlaku 10 menit, maksimal lima percobaan, dan dapat dikirim ulang setelah 60 detik. Resend mengganti hash sehingga kode lama langsung tidak berlaku. TTL index membersihkan challenge kedaluwarsa, tetapi setiap operasi tetap memeriksa waktu secara eksplisit.

Server menghitung hash OTP memakai HMAC-SHA-256 dengan `OTP_SECRET` dan identitas challenge. Database tidak menyimpan kode OTP asli. Response dan log tidak menampilkan kode.

## Register dengan email

### `POST /api/v1/auth/register`

Input tetap memuat `name`, `email`, dan `password`. Server:

1. memvalidasi dan menormalisasi input;
2. menolak email yang sudah terdaftar;
3. membuat hash password;
4. membuat challenge dan OTP;
5. mengirim OTP melalui SMTP;
6. mengembalikan 202 dengan `challengeId`, `expiresAt`, dan `resendAt`.

Jika pengiriman email gagal, server menghapus challenge baru dan mengembalikan error layanan. Password asli tidak disimpan.

### `POST /api/v1/auth/register/verify`

Input memuat `challengeId` dan `code`. Dalam transaksi MongoDB, server mengonsumsi challenge secara atomik, memastikan email masih belum dipakai, membuat user dengan `emailVerifiedAt`, dan membuat session. Response 201 memuat user dan CSRF token serta menetapkan cookie session.

Dua verifikasi bersamaan hanya menghasilkan satu user dan satu challenge yang berhasil dikonsumsi.

## Login dengan email

### `POST /api/v1/auth/login`

Input memuat email dan password. Server memeriksa password, lalu membuat challenge login dan mengirim OTP. Response 202 hanya memuat metadata challenge. Server memakai respons generik untuk email asing, akun Google-only, dan password salah agar tidak membocorkan metode login atau keberadaan akun.

### `POST /api/v1/auth/login/verify`

Input memuat `challengeId` dan `code`. Dalam transaksi, server mengonsumsi challenge dan membuat session. Jika user lama belum memiliki `emailVerifiedAt`, verifikasi pertama mengisinya. Response 200 memuat user dan CSRF token serta menetapkan cookie session.

## Resend OTP

### `POST /api/v1/auth/otp/resend`

Input memuat `challengeId`. Endpoint memeriksa challenge aktif, cooldown, expiry, dan batas rate. Server mengirim kode baru lalu mengganti hash serta waktu challenge. Response 200 memuat `expiresAt` dan `resendAt` baru tanpa mengungkap email lengkap atau kode.

Resend tidak mengubah purpose atau identitas challenge. Challenge yang telah dipakai, terkunci, atau kedaluwarsa tidak dapat dikirim ulang.

## Google OAuth

### `GET /api/v1/auth/google`

Server membuat state acak sekali pakai, menyimpan hash-nya dalam `OAuthState`, menetapkan cookie HttpOnly `gatherly_oauth_state`, lalu mengarahkan browser ke Google dengan scope `profile` dan `email`.

### `GET /api/v1/auth/google/callback`

Server memverifikasi query state, cookie state, expiry, dan status sekali pakai sebelum memproses profil Google. Passport berjalan dengan `session:false`. Setelah user ditemukan, ditautkan, atau dibuat, server membuat session Gatherly, membersihkan cookie state, lalu mengarahkan browser ke:

```text
${WEB_ORIGIN}/auth/callback?status=success
```

Kegagalan mengarahkan pengguna ke `/auth/callback?error=<kode-aman>`. Redirect tidak memuat token Google, session token, email, atau detail provider.

`OAuthState` memiliki hash unik, `expiresAt`, `usedAt`, dan TTL index. State hanya dapat digunakan sekali.

## Email transport

Nodemailer memakai environment berikut:

- `SMTP_HOST`;
- `SMTP_PORT`;
- `SMTP_SECURE`;
- `SMTP_USER`;
- `SMTP_PASS`;
- `SMTP_FROM`.

Google OAuth memakai:

- `GOOGLE_CLIENT_ID`;
- `GOOGLE_CLIENT_SECRET`;
- `GOOGLE_CALLBACK_URL`.

OTP memakai `OTP_SECRET`. Semua secret hanya berada dalam `.env`; `.env.example` memakai placeholder.

Mail service menerima interface transport kecil agar test dapat merekam email tanpa jaringan. Development dan demo memakai Nodemailer SMTP sungguhan.

## Keamanan dan rate limit

- Register, login, verify, resend, dan Google start memakai pembatasan request yang sesuai.
- Pesan login salah tetap generik.
- OTP salah menambah `attempts` secara atomik.
- Challenge terkunci setelah lima kesalahan.
- Challenge kedaluwarsa atau terpakai tidak dapat dikonsumsi kembali.
- OTP, password, OAuth state, token Google, cookie session, dan SMTP credential tidak masuk log.
- Callback hanya menerima state yang cocok dengan cookie dan record database.
- Cookie OAuth state memakai HttpOnly, SameSite=Lax, Secure pada production, path callback, dan umur pendek.
- Endpoint password tetap memvalidasi Origin. Callback OAuth mengandalkan state sekali pakai.

## Perubahan kontrak lama

`POST /auth/register` berubah dari 201 user menjadi 202 challenge. `POST /auth/login` berubah dari 200 session menjadi 202 challenge. Client harus memanggil endpoint verify untuk menyelesaikan kedua alur.

`GET /auth/me` dan `POST /auth/logout` tetap kompatibel. Semua modul lain tetap menggunakan model session yang sama.

## Error stabil

- `400 VALIDATION_ERROR`: format body, challenge ID, atau OTP tidak valid.
- `401 UNAUTHENTICATED`: kredensial login salah atau challenge login tidak valid.
- `409 EMAIL_ALREADY_EXISTS`: email telah terdaftar saat memulai atau menyelesaikan register.
- `409 OTP_INVALID`: kode salah dan challenge masih memiliki percobaan.
- `409 OTP_EXPIRED`: challenge kedaluwarsa.
- `409 OTP_LOCKED`: batas percobaan tercapai.
- `409 OTP_ALREADY_USED`: challenge sudah dikonsumsi.
- `429 RATE_LIMITED`: cooldown resend atau batas request tercapai.
- `503 EMAIL_UNAVAILABLE`: SMTP gagal menerima email.
- Google callback memakai kode redirect aman seperti `oauth_denied`, `oauth_state_invalid`, atau `oauth_failed`.

## Pengujian

Integration test harus membuktikan:

- register tidak membuat user sebelum OTP benar;
- register sukses membuat tepat satu user dan session;
- login tidak membuat session sebelum OTP benar;
- kode salah, expiry, lock, resend, dan kode lama ditolak dengan benar;
- dua verifikasi bersamaan hanya menghasilkan satu keberhasilan;
- kegagalan mail transport tidak meninggalkan challenge aktif;
- akun lama mendapat `emailVerifiedAt` setelah login OTP pertama;
- akun Google baru, login ulang, dan linking email terverifikasi memakai user yang benar;
- email Google tidak terverifikasi ditolak;
- duplicate email dan `googleId` tidak membuat user ganda;
- OAuth state salah, kedaluwarsa, dan terpakai ditolak;
- callback sukses membuat session tanpa mengekspos token provider;
- logout tetap menghapus session.

Unit test memakai fake mail transport dan fake Google profile/strategy boundary. Tidak ada test otomatis yang mengirim email sungguhan atau menghubungi Google.

## Kriteria selesai

Fitur selesai ketika register dan login password mewajibkan email OTP, Google OAuth menghasilkan session Gatherly yang aman, account linking mencegah duplikasi, seluruh failure mode utama teruji, dan tidak ada secret baru yang masuk repository.
