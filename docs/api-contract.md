# Gatherly — Kontrak API v1

Ditinjau terhadap `main` ad1a181 pada 17 November 2026, untuk issue #5. Basis URL `/api/v1`; implementasi Express ada di `apps/backend/src/app.ts`. Dokumen ini dan Swagger mencerminkan implementasi saat audit, bukan bukti keberhasilan seluruh alur pada deployment. Perubahan kontrak berikutnya harus direview pemilik BE/FE dalam PR.

## Format, keamanan, dan validasi

- JSON untuk request biasa; upload memakai multipart field `file`. Nominal integer rupiah, tanggal ISO 8601, ID MongoDB string. Parameter `{id}` wajib diganti ID aktual, `{slug}` adalah slug publik.
- Umumnya sukses `{data: ...}`. Daftar berhalaman menggunakan `{data: [], meta: {page, limit, total}}`; beberapa endpoint memakai DTO khusus (contoh payout organizer `data.rows` beserta total, admin payout menambahkan `counts`). Jangan menerapkan satu bentuk pagination ke semua endpoint.
- Error `{error:{code,message,fields?,details?},requestId?}`. `requestId` tidak dijamin pada semua jalur error. Zod yang dilempar langsung maupun parser lokal menghasilkan 400 `VALIDATION_ERROR`. 401 autentikasi, 403 CSRF/hak akses, 404 resource, 409 konflik, 410 token/credential kedaluwarsa tertentu, 429 pembatasan, dan 5xx kegagalan layanan mengikuti handler.
- Login memakai cookie HttpOnly, Secure pada production, SameSite=Lax: buyer `gatherly_session`, workspace `gatherly_workspace`, admin `gatherly_admin`. Tidak memakai bearer JWT untuk sesi browser. Frontend harus mengirim credentials; token CSRF diperoleh dari respons login/verifikasi atau endpoint `me` pada ruang autentikasi masing-masing.
- Mutasi terautentikasi mengirim `X-CSRF-Token`. Admin diperiksa melalui `requireAdmin`; buyer melalui `requireSession/requireCsrf`; workspace melalui middleware workspace. Pengecualian publik/provider mengikuti tabel. Origin login buyer diperiksa terhadap konfigurasi, bukan pengganti verifikasi sesi/CSRF.
- Workspace diterima sebagai fallback `requireSession` **hanya** untuk prefix `/organizer`, `/committee`, `/realtime`. Cookie workspace tidak mengautentikasi endpoint buyer `/orders`, `/tickets`, `/account`, `/refunds`, atau `/me`. Organizer diperiksa ownership; panitia diperiksa assignment acara. Status frozen membatasi mutasi workspace sesuai middleware.
- Pagination tidak seragam: order umumnya limit 1–50; admin payout 1–100. Gunakan validator endpoint yang ditautkan pada inventaris. Field tidak dikenal ditolak hanya pada schema `.strict()`; schema Zod lain dapat membuangnya. Jangan mengirim filter MongoDB mentah.

## Autentikasi dan akun

| Operasi | Input / hasil / batas penting |
| --- | --- |
| POST /auth/register | `name` 2–100, `email`, `password` 12–128; 202 challenge, belum membuat user. |
| POST /auth/register/verify | `challengeId`, `code`; 201 user + CSRF dan cookie. |
| POST /auth/login | `email`, `password`; 202 challenge setelah password benar. |
| POST /auth/login/verify | `challengeId`, `code`; 200 user + CSRF dan cookie. |
| POST /auth/otp/resend | `challengeId`; 200 expiry/cooldown baru. OTP 6 digit, 10 menit, 5 percobaan, resend 60 detik. |
| GET /auth/google; GET /auth/google/callback | OAuth state sekali pakai, query callback `code/state`, redirect; provider perlu konfigurasi. |
| GET /auth/me; POST /auth/logout | Buyer: info user + CSRF; logout 204 dan invalidasi sesi. |
| POST /workspace/auth/login | `username` 3–40 lowercase `[a-z0-9][a-z0-9._-]*`, `password` 1–128; 200 profil workspace + CSRF dan cookie. Role organizer/committee. |
| POST /workspace/auth/password/first | `newPassword` 12–128; sesi workspace dengan kewajiban ganti password. Password sementara berlaku 7 hari. |
| POST /workspace/auth/password | `currentPassword`, `newPassword` 12–128. |
| POST /workspace/auth/password/forgot; POST /workspace/auth/password/reset | `usernameOrEmail`; lalu `token/password`. Reset organizer berlaku 30 menit sekali pakai; reset panitia dilakukan organizer. |
| GET /workspace/auth/me; POST /workspace/auth/logout | Workspace identity/CSRF; logout menghapus sesi. |
| POST /admin/auth/login | `email` domain `gatherly.xyz`, `password`; 200 `{data:{challengeId}}`, belum login. |
| POST /admin/auth/totp; POST /admin/auth/backup-code | `challengeId` min20, `code` 6–128, `rememberDevice?`; 200 identitas/CSRF dan cookie. Challenge 5 menit/5 percobaan. TOTP replay dilindungi counter, backup code sekali pakai. |
| GET /admin/auth/me; POST /admin/auth/logout | Sesi admin aktif; logout memakai CSRF. Sesi 8 jam atau 7 hari jika rememberDevice; tidak ada klaim idle timeout 30 menit. |
| PATCH /account | Buyer: `name` 2–100, `phone` nullable format telepon 7–25 karakter. |
| POST /account/password | `newPassword` 12–128, `currentPassword?` (dibutuhkan service bila akun memiliki password). |
| PATCH /account/notifications; POST /account/delete | `{reminders,recommendations}` boolean; penghapusan memerlukan `confirmation` sesuai handler. |

Kode admin yang harus dipahami FE: `UNAUTHENTICATED` (401), `CHALLENGE_INVALID` (401, invalid/kedaluwarsa/habis percobaan), `CODE_INVALID` (401), `CHALLENGE_USED` (409), `ACCOUNT_LOCKED` (429). Backend tidak mengirim `CHALLENGE_EXPIRED` dari jalur ini. Credential admin disediakan operator, bukan endpoint registrasi publik.

## Acara, aplikasi organizer, dan penyimpanan

Acara dibuat melalui `POST /organizer/events`: `title` 2–160, `description` 1–5000, `category` string 2–80, `startsAt`, `endsAt`, `timezone`, `venueName` 2–160, `address` 2–300, `city` 2–100. Tambahan: `posterAssetId?`, `locationType=offline|online`, `terms[]`, `performerLabel`, `performers[{name,note?,time?,photoAssetId?,photoUrl?}]`, `showRemaining`, `checkInOpensAt?`, `checkInClosesAt?`. Update PATCH menerima subset ditambah `salesClosed`; service membatasi perubahan setelah transaksi berbayar. Kategori bukan enum tetap pada validator saat audit.

`POST /organizer/events/{id}/ticket-types` menerima `name` 2–80, `description?` max500, `price` integer **>=0**, `capacity` integer >0, `salesStartsAt`, `salesEndsAt`. PATCH menerima subset. Kapasitas tidak boleh kurang dari reserved+sold. Stop/resume memakai endpoint per jenis, bukan mengubah status pembayaran. Publish wajib poster dan jenis tiket serta rentang waktu valid. Jendela check-in default dua jam sebelum mulai sampai acara berakhir. Duplicate membuat draf dengan kuota reserved/sold nol; cancel menerima `confirmTitle` dan `reason` 10–1000 lalu meminta keputusan admin.

Katalog publik `/events`: `q`, `category`, `minPrice`, `maxPrice`, `date=today|tomorrow|weekend|week`, `area=campus`, `sort=date_asc|price_asc`, `page>=1`, `limit=1..100`; query diperiksa handler; `startingPrice` dapat null bila tidak ada tiket yang dapat dibeli. `minPrice/maxPrice` inklusif dan sort harga memakai harga jenis yang cocok (`matchingStartingPrice`). `/events/{slug}` tidak membuka draf. Profil organizer publik melalui `/organizers/{username}`. Saved-event adalah resource buyer.

Pendaftaran organizer menggunakan `/organizer-applications`, bukan `POST /organizers` lama (sekarang 403 `APPLICATION_REQUIRED`). Payload profil/PIC/berkas mengikuti [`application.schemas.ts`](../apps/backend/src/modules/applications/application.schemas.ts). Upload menerima JPEG/PNG/PDF maksimum 2 MB; saat submit, KTP maksimum 1 MB (JPEG/PNG/PDF), dokumen legal PDF maksimum 2 MB, cookie kepemilikan upload; berkas disimpan private R2. Lookup memakai nomor pengajuan + email dan cookie edit; revisi hanya saat status/token mengizinkan. Admin dapat request-fix (`flags[{field,note}]`), reject (`reason` 5–2000), approve (tanpa body); review race menghasilkan `REVIEW_CONFLICT`, username konflik `USERNAME_TAKEN`. Detail review menyediakan signed URL berumur terbatas dan mencatat akses detail; tidak menjamin audit setiap pembukaan URL storage.

Asset organizer menggunakan `POST /organizer/posters`; media publik `/media/{id}` redirect ke URL storage. Metadata `StorageAsset` adalah sumber ownership/private. Jangan menganggap seluruh URL storage publik atau unggahan poster memakai Cloudinary.

## Checkout, pembayaran, tiket, check-in

| Method/path | Input / akses | Respons / perilaku |
| --- | --- | --- |
| POST /orders | Buyer + CSRF; header `Idempotency-Key` UUID; body `ticketTypeId`, `quantity` 1–4, `attendees[{name,email?,phone?,birthDate?}]`, `contactPhone?`. Jumlah attendees = quantity, name 2–100. | 201 order baru atau 200 retry key/payload sama; nominal dihitung server; konflik key/payload ditolak. Reservasi 15 menit. |
| GET /orders; GET /orders/{id} | Buyer; daftar page/limit atau ID milik sendiri. | DTO order; detail menyertakan ID tiket yang sudah diterbitkan. |
| POST /orders/{id}/payment-session | Buyer pemilik + CSRF; `method?` max30. | 200 `{data:{snapToken,redirectUrl,expiresAt}}`; 202 `{data:{status}}` jika belum ready. Jangan anggap 202 sebagai paid. |
| POST /orders/{id}/cancel | Buyer pemilik + CSRF, tanpa body. | 204 setelah pembatalan pending diproses; paid memakai refund, bukan jalur ini. |
| POST /payments/midtrans/notifications | Tanpa sesi/CSRF; payload provider `order_id`, `status_code`, `gross_amount`, `signature_key`, status terkait. | Verifikasi signature/status/nominal server; dedup/reconcile di service. Provider callback FE bukan bukti lunas. |
| GET /tickets; GET /tickets/{ticketId} | Buyer pemilik. | Daftar tiket; credential QR hanya untuk tiket berhak. Token tidak dimasukkan ke semua respons daftar. |
| GET /tickets/shared/{token} | Tanpa cookie; token URL rahasia 43 karakter. | Akses e-ticket berbasis credential; no-store/no-referrer. Jangan menaruh token nyata dalam dokumentasi. |
| POST /orders/{orderId}/tickets/resend | Buyer pemilik + CSRF. | 204; 409 `RESEND_UNAVAILABLE` jika belum issued/cooldown 60 detik. |
| POST /committee/events/{eventId}/check-ins | Buyer/workspace + CSRF + assignment; **tepat satu** `qrPayload` (`gatherly:v1:<43 base64url>`) atau `ticketCode`. | Scan/manual online, atomic unused→used; scan ulang/di luar jendela/tiket batal ditolak dan dicatat. Tidak menerima antrean scan offline. |
| GET /organizer/events/{eventId}/summary; GET /organizer/events/{eventId}/attendees | Organizer pemilik. | Laporan penjualan/kuota/kehadiran; tidak ada endpoint CSV pada router laporan saat audit. |
| POST /realtime/ticket | Buyer/workspace + CSRF, tanpa body. | 200 `{data:{token}}`, grant 30 detik; konsumsi pada handshake WebSocket, bukan JWT akses universal. |

Harga dasar Rp100.000 → subtotal Rp100.000 + fee 5% Rp5.000 = total Rp105.000. Status UI tidak boleh mengganti enum database secara langsung; lihat [state machine](data-model.md).

## Refund, payout, dan moderasi

| Method/path | Input / akses | Respons / konflik penting |
| --- | --- | --- |
| POST /refunds/orders/{orderId} | Buyer pemilik + CSRF; `reason` 10–1000, `ticketIds?` 1–4 ID. | Refund tiket unused paid sebelum cutoff satu bulan kalender; fee buyer tidak dikembalikan. |
| POST /admin/refunds/{id}/decision; POST /admin/cancellations/{id}/decision | Admin + CSRF; `approve` boolean, `note` 3–1000. | Keputusan memicu state/worker, bukan langsung menjamin provider selesai. |
| POST /admin/refunds/{id}/transferred | Admin + CSRF; `transferReference` 3–200, `transferredAt`. | Penyelesaian manual refund; status/nominal diperiksa service. |
| GET /organizer/bank-account; PUT /organizer/bank-account | Organizer; PUT + CSRF `{bank:2–80, accountNumber:5–30 digit, holderName:2–100}`. | Nomor rekening dimasking pada respons organizer; disimpan sebagai rekening payout. |
| GET /organizer/payouts; POST /organizer/payouts | Organizer; POST + CSRF `{eventId}`. | GET `data:{available,processing,transferred,rows}`; POST201 requested. Konflik `PAYOUT_UNAVAILABLE`, `REFUNDS_PENDING`, `PAYOUT_EXISTS`, `BANK_REQUIRED`, `NO_BALANCE`. |
| GET /admin/payouts | Admin; `tab=requested|transferred`, `page>=1`, `limit=1..100`. | `data[]`, `meta`, `counts:{requested,transferred}`; rekening penuh untuk admin berhak. |
| POST /admin/payouts/{id}/transferred | Admin + CSRF; **`transferReference`** 3–200 dan `transferredAt` (tidak sebelum requestedAt/tidak masa depan). | 204; pengulangan409 `ALREADY_TRANSFERRED`; bukan transfer bank otomatis. |
| POST /events/{slug}/reports | Buyer + CSRF; `reason=fraud|wrong_info|inappropriate|other`, `note?` max1000 (other min10). | Laporan tersimpan; satu laporan aktif per buyer/event. |
| POST /admin/reports/{id}/close | Admin + CSRF; `note` 1–2000. | Menutup laporan sesuai service. |
| POST /admin/organizers/{id}/freeze | Admin + CSRF; `reason` 5–2000. | Membatasi organizer; unfreeze terpisah, tidak menghapus data transaksi. |

## Inventaris seluruh route terpasang

Daftar berikut diambil dari mount router `app.ts` dan AST sumber, termasuk route dinamis pada loop. Status yang ditampilkan adalah status eksplisit respons handler (dan 200 implisit), **bukan** daftar lengkap semua error service/middleware. Semua endpoint menggunakan basis `/api/v1`. Kolom input menampilkan field schema Swagger jika tersedia; field bertanda validator sumber harus dibaca pada tautan handler/schema terkait sebelum membangun integrasi baru. OpenAPI memakai schema respons terbuka untuk DTO baru yang belum didefinisikan rinci, bukan klaim field stabil yang tidak diperiksa.

| Method/path | Akses | Input | Respons handler | Sumber |
| --- | --- | --- | --- | --- |
| `GET /account` | buyer | — | 200 | [handler](../apps/backend/src/modules/account/account.routes.ts#L33) |
| `PATCH /account` | buyer+CSRF | `name`, `phone` | 200 | [handler](../apps/backend/src/modules/account/account.routes.ts#L40) |
| `POST /account/avatar` | buyer+CSRF | multipart file | 200 | [handler](../apps/backend/src/modules/account/account.routes.ts#L51) |
| `POST /account/delete` | buyer+CSRF | `confirmation` | 204 | [handler](../apps/backend/src/modules/account/account.routes.ts#L127) |
| `DELETE /account/google` | buyer+CSRF | — | 204 | [handler](../apps/backend/src/modules/account/account.routes.ts#L93) |
| `PATCH /account/notifications` | buyer+CSRF | `reminders`, `recommendations` | 204 | [handler](../apps/backend/src/modules/account/account.routes.ts#L119) |
| `POST /account/password` | buyer+CSRF | `currentPassword`, `newPassword` | 204 | [handler](../apps/backend/src/modules/account/account.routes.ts#L82) |
| `POST /account/sessions/revoke-others` | buyer+CSRF | — | 200 | [handler](../apps/backend/src/modules/account/account.routes.ts#L109) |
| `GET /admin/applications` | admin | — | 200 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L57) |
| `GET /admin/applications.csv` | admin | — | 200 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L98) |
| `GET /admin/applications/{id}` | admin | — | 200 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L121) |
| `POST /admin/applications/{id}/approve` | admin+CSRF | — | 204 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L216) |
| `POST /admin/applications/{id}/reject` | admin+CSRF | `reason` | 204 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L181) |
| `POST /admin/applications/{id}/request-fix` | admin+CSRF | `flags` | 204 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L159) |
| `POST /admin/auth/backup-code` | publik / credential khusus | `challengeId`, `code`, `rememberDevice` | 200 | [handler](../apps/backend/src/modules/admin/admin-auth.routes.ts#L53) |
| `POST /admin/auth/login` | publik / credential khusus | `email`, `password` | 200 | [handler](../apps/backend/src/modules/admin/admin-auth.routes.ts#L13) |
| `POST /admin/auth/logout` | admin+CSRF | — | 204 | [handler](../apps/backend/src/modules/admin/admin-auth.routes.ts#L161) |
| `GET /admin/auth/me` | admin | — | 200 | [handler](../apps/backend/src/modules/admin/admin-auth.routes.ts#L154) |
| `POST /admin/auth/totp` | publik / credential khusus | `challengeId`, `code`, `rememberDevice` | 200 | [handler](../apps/backend/src/modules/admin/admin-auth.routes.ts#L53) |
| `GET /admin/cancellations` | admin | — | 200 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L112) |
| `POST /admin/cancellations/{id}/decision` | admin+CSRF | `approve`, `note` | 200 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L129) |
| `GET /admin/organizers` | admin | — | 200 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L336) |
| `GET /admin/organizers/{id}` | admin | — | 200 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L373) |
| `POST /admin/organizers/{id}/freeze` | admin+CSRF | `reason` | 204 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L408) |
| `POST /admin/organizers/{id}/resend-access` | admin+CSRF | — | 204 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L432) |
| `POST /admin/organizers/{id}/unfreeze` | admin+CSRF | — | 204 | [handler](../apps/backend/src/modules/admin/admin-organizers.routes.ts#L420) |
| `GET /admin/payouts` | admin | — | 200 | [handler](../apps/backend/src/modules/payouts/payout.routes.ts#L186) |
| `POST /admin/payouts/{id}/transferred` | admin+CSRF | `transferReference`, `transferredAt` | 204 | [handler](../apps/backend/src/modules/payouts/payout.routes.ts#L231) |
| `GET /admin/refunds` | admin | query/header: `status` | 200 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L62) |
| `POST /admin/refunds/{id}/decision` | admin+CSRF | `approve`, `note` | 200 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L87) |
| `POST /admin/refunds/{id}/transferred` | admin+CSRF | `transferReference`, `transferredAt` | 204 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L96) |
| `GET /admin/reports` | admin | — | 200 | [handler](../apps/backend/src/modules/event-reports/event-report.routes.ts#L32) |
| `GET /admin/reports/{id}` | admin | — | 200 | [handler](../apps/backend/src/modules/event-reports/event-report.routes.ts#L46) |
| `POST /admin/reports/{id}/close` | admin+CSRF | `note` | 204 | [handler](../apps/backend/src/modules/event-reports/event-report.routes.ts#L52) |
| `GET /auth/google` | publik / credential khusus | — | 302, 503 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L132) |
| `GET /auth/google/callback` | publik / credential khusus | query/header: `state` | 302 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L143) |
| `POST /auth/login` | publik / credential khusus | `email`, `password` | 202 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L100) |
| `POST /auth/login/verify` | publik / credential khusus | `challengeId`, `code` | 200 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L110) |
| `POST /auth/logout` | buyer+CSRF | — | 204 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L194) |
| `GET /auth/me` | buyer | — | 200 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L170) |
| `POST /auth/otp/resend` | publik / credential khusus | `challengeId` | 200 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L122) |
| `POST /auth/password/forgot` | publik / credential khusus | `email` | 204 | [handler](../apps/backend/src/modules/account/account.routes.ts#L145) |
| `POST /auth/password/reset` | publik / credential khusus | `token`, `password` | 204 | [handler](../apps/backend/src/modules/account/account.routes.ts#L152) |
| `POST /auth/register` | publik / credential khusus | `name`, `email`, `password` | 202 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L78) |
| `POST /auth/register/verify` | publik / credential khusus | `challengeId`, `code` | 201 | [handler](../apps/backend/src/modules/auth/auth.routes.ts#L88) |
| `GET /committee/events` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/check-ins/check-in.routes.ts#L30) |
| `GET /committee/events/{eventId}/check-ins` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/check-ins/check-in.routes.ts#L52) |
| `POST /committee/events/{eventId}/check-ins` | buyer+CSRF atau workspace+CSRF | `qrPayload`, `ticketCode` | 200 | [handler](../apps/backend/src/modules/check-ins/check-in.routes.ts#L63) |
| `GET /committee/events/{eventId}/tickets` | buyer atau workspace | query/header: `q` | 200 | [handler](../apps/backend/src/modules/check-ins/check-in.routes.ts#L37) |
| `GET /events` | publik / credential khusus | — | 200 | [handler](../apps/backend/src/modules/public-events/public-event.routes.ts#L28) |
| `GET /events/{slug}` | publik / credential khusus | — | 200 | [handler](../apps/backend/src/modules/public-events/public-event.routes.ts#L49) |
| `POST /events/{slug}/reports` | buyer+CSRF | `reason`, `note` | 201 | [handler](../apps/backend/src/modules/event-reports/event-report.routes.ts#L20) |
| `GET /events/suggestions` | publik / credential khusus | — | 200 | [handler](../apps/backend/src/modules/public-events/public-event.routes.ts#L39) |
| `GET /me/saved-events` | buyer | — | 200 | [handler](../apps/backend/src/modules/saved-events/saved-event.routes.ts#L17) |
| `DELETE /me/saved-events/{slug}` | buyer+CSRF | — | 204 | [handler](../apps/backend/src/modules/saved-events/saved-event.routes.ts#L39) |
| `PUT /me/saved-events/{slug}` | buyer+CSRF | — | 204 | [handler](../apps/backend/src/modules/saved-events/saved-event.routes.ts#L30) |
| `GET /media/{id}` | publik / credential khusus | — | 302 | [handler](../apps/backend/src/modules/storage/storage.routes.ts#L7) |
| `GET /orders` | buyer | query/header: `page`, `limit` | 200 | [handler](../apps/backend/src/modules/orders/order.routes.ts#L43) |
| `POST /orders` | buyer+CSRF | `ticketTypeId`, `quantity`, `contactPhone`, `attendees`; query/header: `Idempotency-Key` | 200, 201 | [handler](../apps/backend/src/modules/orders/order.routes.ts#L25) |
| `GET /orders/{id}` | buyer | — | 200 | [handler](../apps/backend/src/modules/orders/order.routes.ts#L87) |
| `POST /orders/{id}/cancel` | buyer+CSRF | — | 204 | [handler](../apps/backend/src/modules/orders/order.routes.ts#L106) |
| `POST /orders/{id}/payment-session` | buyer+CSRF | `method` | 200, 202 | [handler](../apps/backend/src/modules/orders/order.routes.ts#L61) |
| `POST /orders/{orderId}/tickets/resend` | buyer+CSRF | — | 204 | [handler](../apps/backend/src/modules/tickets/ticket.routes.ts#L30) |
| `POST /organizer-applications` | publik / credential khusus | JSON: validator sumber | 201 | [handler](../apps/backend/src/modules/applications/application.routes.ts#L133) |
| `POST /organizer-applications/{number}/fix` | publik / credential khusus | JSON: validator sumber | 204 | [handler](../apps/backend/src/modules/applications/application.routes.ts#L289) |
| `POST /organizer-applications/documents` | publik / credential khusus | multipart file | 201 | [handler](../apps/backend/src/modules/applications/application.routes.ts#L74) |
| `POST /organizer-applications/lookup` | publik / credential khusus | `number`, `email` | 200 | [handler](../apps/backend/src/modules/applications/application.routes.ts#L264) |
| `GET /organizer-applications/username` | publik / credential khusus | query/header: `username` | 200 | [handler](../apps/backend/src/modules/applications/application.routes.ts#L55) |
| `GET /organizer-applications/verify-email` | publik / credential khusus | query/header: `token` | 200 | [handler](../apps/backend/src/modules/applications/application.routes.ts#L234) |
| `GET /organizer/bank-account` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/payouts/payout.routes.ts#L39) |
| `PUT /organizer/bank-account` | buyer+CSRF atau workspace+CSRF | `bank`, `accountNumber`, `holderName` | 200 | [handler](../apps/backend/src/modules/payouts/payout.routes.ts#L54) |
| `GET /organizer/events` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/events/event.routes.ts#L171) |
| `POST /organizer/events` | buyer+CSRF atau workspace+CSRF | `title`, `description`, `category`, `startsAt`, `endsAt`, `timezone`, `venueName`, `address`, `city`, `posterAssetId` | 201 | [handler](../apps/backend/src/modules/events/event.routes.ts#L197) |
| `GET /organizer/events/{eventId}/attendees` | buyer atau workspace | query/header: `checkInStatus` | 200 | [handler](../apps/backend/src/modules/reports/organizer-report.routes.ts#L80) |
| `GET /organizer/events/{eventId}/orders` | buyer atau workspace | query/header: `q`, `paymentStatus` | 200 | [handler](../apps/backend/src/modules/reports/organizer-report.routes.ts#L52) |
| `GET /organizer/events/{eventId}/orders/{orderId}` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/reports/organizer-report.routes.ts#L67) |
| `GET /organizer/events/{eventId}/summary` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/reports/organizer-report.routes.ts#L40) |
| `DELETE /organizer/events/{id}` | buyer+CSRF atau workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/events/event.routes.ts#L269) |
| `GET /organizer/events/{id}` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/events/event.routes.ts#L215) |
| `PATCH /organizer/events/{id}` | buyer+CSRF atau workspace+CSRF | `title`, `description`, `salesClosed` | 200 | [handler](../apps/backend/src/modules/events/event.routes.ts#L232) |
| `POST /organizer/events/{id}/cancel` | buyer+CSRF atau workspace+CSRF | `confirmTitle`, `reason` | 201 | [handler](../apps/backend/src/modules/events/event.routes.ts#L475) |
| `GET /organizer/events/{id}/committee` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/events/event.routes.ts#L388) |
| `POST /organizer/events/{id}/committee` | buyer+CSRF atau workspace+CSRF | `email` | 201 | [handler](../apps/backend/src/modules/events/event.routes.ts#L405) |
| `DELETE /organizer/events/{id}/committee/{userId}` | buyer+CSRF atau workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/events/event.routes.ts#L460) |
| `POST /organizer/events/{id}/duplicate` | buyer+CSRF atau workspace+CSRF | — | 201 | [handler](../apps/backend/src/modules/events/event.routes.ts#L495) |
| `POST /organizer/events/{id}/publish` | buyer+CSRF atau workspace+CSRF | — | 200 | [handler](../apps/backend/src/modules/events/event.routes.ts#L283) |
| `POST /organizer/events/{id}/ticket-types` | buyer+CSRF atau workspace+CSRF | `name`, `description`, `price`, `capacity`, `salesStartsAt`, `salesEndsAt` | 201 | [handler](../apps/backend/src/modules/events/event.routes.ts#L299) |
| `DELETE /organizer/events/{id}/ticket-types/{typeId}` | buyer+CSRF atau workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/events/event.routes.ts#L361) |
| `PATCH /organizer/events/{id}/ticket-types/{typeId}` | buyer+CSRF atau workspace+CSRF | JSON: validator sumber | 200 | [handler](../apps/backend/src/modules/events/event.routes.ts#L317) |
| `POST /organizer/events/{id}/ticket-types/{typeId}/resume` | buyer+CSRF atau workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/events/event.routes.ts#L551) |
| `POST /organizer/events/{id}/ticket-types/{typeId}/stop` | buyer+CSRF atau workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/events/event.routes.ts#L551) |
| `GET /organizer/payouts` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/payouts/payout.routes.ts#L74) |
| `POST /organizer/payouts` | buyer+CSRF atau workspace+CSRF | `eventId` | 201 | [handler](../apps/backend/src/modules/payouts/payout.routes.ts#L117) |
| `POST /organizer/posters` | buyer+CSRF atau workspace+CSRF | multipart file | 201 | [handler](../apps/backend/src/modules/events/event-assets.routes.ts#L10) |
| `GET /organizer/profile` | workspace | — | 200 | [handler](../apps/backend/src/modules/workspace/organizer-profile.routes.ts#L30) |
| `PATCH /organizer/profile` | workspace+CSRF | multipart file | 204 | [handler](../apps/backend/src/modules/workspace/organizer-profile.routes.ts#L36) |
| `GET /organizer/summary` | buyer atau workspace | — | 200 | [handler](../apps/backend/src/modules/reports/organizer-report.routes.ts#L31) |
| `GET /organizer/team` | workspace | — | 200 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L231) |
| `POST /organizer/team` | workspace+CSRF | JSON: validator sumber | 201 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L305) |
| `DELETE /organizer/team/{id}` | workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L381) |
| `PUT /organizer/team/{id}/assignments` | workspace+CSRF | JSON: validator sumber | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L355) |
| `POST /organizer/team/{id}/deactivate` | workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L371) |
| `POST /organizer/team/{id}/reactivate` | workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L371) |
| `POST /organizer/team/{id}/reset-password` | workspace+CSRF | — | 200 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L349) |
| `GET /organizer/team/username` | workspace | query/header: `username` | 200 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L224) |
| `POST /organizers` | buyer+CSRF | — | 403 | [handler](../apps/backend/src/modules/organizers/organizer.routes.ts#L32) |
| `GET /organizers/{username}/profile` | publik / credential khusus | — | 200 | [handler](../apps/backend/src/modules/saved-events/saved-event.routes.ts#L51) |
| `GET /organizers/me` | buyer | — | 200 | [handler](../apps/backend/src/modules/organizers/organizer.routes.ts#L45) |
| `POST /payments/midtrans/notifications` | publik / credential khusus | JSON: validator sumber | 200 | [handler](../apps/backend/src/modules/payments/payment.routes.ts#L8) |
| `POST /realtime/ticket` | buyer+CSRF atau workspace+CSRF | — | 200 | [handler](../apps/backend/src/modules/realtime/auth.ts#L17) |
| `GET /refunds` | buyer | — | 200 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L34) |
| `POST /refunds/orders/{orderId}` | buyer+CSRF | `reason`, `ticketIds` | 201 | [handler](../apps/backend/src/modules/refunds/refund.routes.ts#L43) |
| `GET /tickets` | buyer | query/header: `page`, `limit` | 200 | [handler](../apps/backend/src/modules/tickets/ticket.routes.ts#L61) |
| `GET /tickets/{ticketId}` | buyer | — | 200 | [handler](../apps/backend/src/modules/tickets/ticket.routes.ts#L83) |
| `GET /tickets/shared/{token}` | publik / credential khusus | — | 200 | [handler](../apps/backend/src/modules/tickets/ticket.routes.ts#L14) |
| `POST /workspace/auth/login` | publik / credential khusus | `username`, `password` | 200 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L52) |
| `POST /workspace/auth/logout` | workspace+CSRF | — | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L169) |
| `GET /workspace/auth/me` | workspace | — | 200 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L163) |
| `POST /workspace/auth/password` | workspace+CSRF | `currentPassword`, `newPassword` | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L196) |
| `POST /workspace/auth/password/first` | workspace+CSRF | `newPassword` | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L176) |
| `POST /workspace/auth/password/forgot` | publik / credential khusus | `usernameOrEmail` | 200 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L109) |
| `POST /workspace/auth/password/reset` | publik / credential khusus | `token`, `password` | 204 | [handler](../apps/backend/src/modules/workspace/workspace.routes.ts#L138) |

## Swagger dan pembaruan kontrak

Swagger UI `/api/v1/docs/`, JSON `/api/v1/docs/json`. `src/docs/swagger-spec.ts` memakai skema eksplisit ditambah inventaris route `src/docs/mounted-operations.ts`; metadata `x-source` menunjukkan handler. Inventaris bukan inferensi runtime atas seluruh middleware; pemeriksaan akses/payload tetap direview terhadap sumber. Endpoint langsung `/health` tersedia di `/api/v1/health`; `/api/v1/internal/maintenance` memakai Bearer `CRON_SECRET` dan hanya menjalankan subset maintenance legacy. Worker VPS merupakan jalur background penuh (payments, issuance, refund, email, reminders, assets).

Dari `apps/backend`, setelah perubahan route jalankan `node scripts/generate-contract-inventory.mjs`, lalu `node scripts/generate-contract-inventory.mjs --check` dan test `test/contract-docs.test.ts`. Generator sengaja gagal untuk ekspresi route yang tidak dikenali agar perubahan baru tidak diam-diam hilang dari spesifikasi. Jangan mengubah hasil generate secara manual.

Lihat [catatan audit dan batas pengujian](implementation/2026-11-17-contract-review.md). Pemeriksaan schema/kontrak dan test tanpa DB tidak membuktikan OAuth/SMTP/Midtrans/R2/WebSocket lintas domain berhasil di deployment. Review akhir kontrak dengan Ancung/Dien dilakukan melalui PR; dokumen tidak mengklaim persetujuan reviewer yang belum diberikan.
