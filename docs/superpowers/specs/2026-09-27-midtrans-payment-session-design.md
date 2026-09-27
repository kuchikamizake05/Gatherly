# Desain sesi pembayaran Midtrans Snap

Tanggal: 27 September 2026  
Issue: #12  
Pemilik: Dien (BE 2)

## Tujuan

Tahap ini membuat satu sesi Midtrans Snap Sandbox untuk order yang masih payable. Implementasi menyimpan token Snap agar pengguna dapat membuka kembali sesi yang sama tanpa membuat transaksi provider baru.

Endpoint yang ditambahkan:

```text
POST /api/v1/orders/:id/payment-session
```

## Batas scope

Tahap ini membuat sesi pembayaran dan menyimpan hasilnya. Tahap ini tidak menetapkan order sebagai paid, memproses webhook, merekonsiliasi state uncertain, melepas reservasi, atau menerbitkan tiket. Issue #13 dan #14 menangani perilaku tersebut.

Browser callback dan redirect Snap tidak menjadi sumber status pembayaran. Backend hanya mengubah hasil pembayaran setelah verifikasi provider pada #13.

## Pendekatan

Backend memakai adapter internal berbasis `fetch`, bukan SDK Midtrans. Pendekatan ini menghindari dependency tambahan dan membuat timeout, payload, respons, serta pengujian adapter tetap eksplisit.

```text
backend/src/modules/payments/
├── midtrans.client.ts
├── payment.schemas.ts
└── payment.service.ts
```

- `midtrans.client.ts` mengirim request terautentikasi dan mengklasifikasikan hasil HTTP.
- `payment.schemas.ts` memvalidasi respons provider sebelum disimpan.
- `payment.service.ts` mengatur state session, kepemilikan order, dan recovery boundary.
- `order.routes.ts` menyediakan endpoint terautentikasi dan mengubah hasil service menjadi respons HTTP.

## Konfigurasi

Backend membaca:

- `MIDTRANS_SERVER_KEY`, wajib dan hanya tersedia di server.
- `MIDTRANS_IS_PRODUCTION`, bernilai `false` untuk MVP.
- `MIDTRANS_REQUEST_TIMEOUT_MS`, default 8.000 ms.

Startup menolak mode production untuk scope demo ini. Sandbox memakai endpoint:

```text
POST https://app.sandbox.midtrans.com/snap/v1/transactions
```

Adapter mengirim `Authorization: Basic base64(MIDTRANS_SERVER_KEY + ":")`, `Accept: application/json`, dan `Content-Type: application/json`. Adapter tidak mencatat header Authorization, Server Key, Snap token, atau redirect URL.

## Perubahan model order

Order memperoleh field berikut:

- `snapToken`, credential provider yang hanya dikembalikan dari endpoint payment session milik buyer.
- `redirectUrl`, URL Snap untuk order tersebut.
- `paymentSessionAttempts`, jumlah panggilan provider yang benar-benar dimulai.
- `paymentSessionLastError`, kode internal aman untuk diagnosis dan rekonsiliasi.
- `leaseUntil`, batas deteksi proses yang berhenti saat state `creating`.

Listing order dan log tidak mengembalikan credential provider.

## State machine

Endpoint membaca order dengan filter buyer aktif. ID yang tidak ada atau milik pengguna lain menghasilkan 404.

| State awal | Aksi |
| --- | --- |
| `ready` | Kembalikan token, redirect URL, dan expiry yang tersimpan dengan 200 |
| `creating` | Jangan panggil provider; kembalikan 202 |
| `uncertain` | Jangan panggil provider; kembalikan 202 |
| `closed` | Tolak dengan 409 `ORDER_NOT_PAYABLE` |
| `not_started` dan payable | Claim secara atomik menjadi `creating`, lalu panggil provider |

Order payable harus memiliki `paymentStatus=pending`, `reservationStatus=held`, dan `expiresAt` setelah waktu server. Order paid, failed, expired, released, converted, atau melewati expiry ditolak. Endpoint dapat menutup `paymentSessionState` tanpa melepas reserved; rekonsiliasi #13 menangani pelepasan inventori.

Claim `not_started → creating` memakai conditional update. Dua request serentak hanya menghasilkan satu panggilan Midtrans. Claim menetapkan lease singkat dan menambah `paymentSessionAttempts`.

## Request Snap

Payload berasal dari snapshot order:

```json
{
  "transaction_details": {
    "order_id": "<providerOrderId>",
    "gross_amount": 200000
  },
  "item_details": [
    {
      "id": "<ticketTypeId>",
      "price": 100000,
      "quantity": 2,
      "name": "Regular"
    }
  ],
  "customer_details": {
    "first_name": "Alya Putri",
    "email": "alya@example.com"
  },
  "expiry": {
    "start_time": "2026-09-27 10:00:00 +0700",
    "unit": "minutes",
    "duration": 15
  }
}
```

`gross_amount` sama dengan `totalAmount`. Subtotal item juga harus sama dengan jumlah tersebut. `providerOrderId` dibuat sekali saat order dibuat dan tidak berubah saat retry.

Expiry Snap dimulai pada `createdAt` order selama 15 menit. Adapter memformat waktu tersebut dalam zona `Asia/Jakarta` dengan offset `+0700`. Endpoint menolak pembuatan sesi jika sisa waktu tidak melebihi minimum provider 20 detik atau order sudah expired. Penolakan menutup payment session, tetapi mempertahankan reservasi untuk rekonsiliasi #13.

## Hasil provider

Respons sukses harus berisi string `token` dan `redirect_url`. Service menyimpannya bersama state `ready`, menghapus lease, dan mengembalikan:

```json
{
  "data": {
    "snapToken": "<credential>",
    "redirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/example-token",
    "expiresAt": "2026-09-27T03:15:00.000Z"
  }
}
```

Hasil nonterminal:

```json
{
  "data": {
    "status": "creating"
  }
}
```

atau:

```json
{
  "data": {
    "status": "uncertain"
  }
}
```

## Penanganan kegagalan

| Kondisi | State tersimpan | Respons API |
| --- | --- | --- |
| Respons sukses valid | `ready` | 200 |
| Request lain sedang membuat sesi | `creating` | 202 |
| Timeout atau network error | `uncertain` | 202 |
| Provider 5xx atau respons sukses tidak valid | `uncertain` | 202 |
| Provider 429 | `uncertain` | 503 `PROVIDER_UNAVAILABLE` |
| Provider 400/401/403 yang pasti | `not_started` | 502 `PROVIDER_REJECTED` |
| Order tidak payable | `closed` bila terminal | 409 `ORDER_NOT_PAYABLE` |

State uncertain mencegah retry provider otomatis karena request pertama mungkin telah berhasil meskipun responsnya hilang. Issue #13 harus memeriksa status transaksi menggunakan `providerOrderId` sebelum mengizinkan tindakan berikutnya.

Pesan error tidak memuat payload mentah provider, token, URL, atau credential.

## Pengujian

Test menyuntikkan transport Midtrans palsu ke adapter atau service. Mock tidak menggantikan integration test MongoDB; state transition tetap berjalan pada `gatherly_test`.

Kasus wajib:

1. Order payable menghasilkan payload dari snapshot dan state `ready`.
2. Dua request serentak memanggil Midtrans tepat sekali.
3. State `ready` mengembalikan token lama tanpa panggilan provider.
4. State `creating` dan `uncertain` menghasilkan 202 tanpa panggilan baru.
5. Timeout, network error, 5xx, 429, 4xx, dan respons malformed menghasilkan state serta error yang ditetapkan.
6. Order expired, paid, released, atau milik buyer lain ditolak.
7. Gross amount dan subtotal item selalu sama dengan snapshot order.
8. Expiry dihitung dari `createdAt`, bukan waktu endpoint dipanggil.
9. Log dan response error tidak membocorkan secret atau Snap token.
10. Satu smoke test Sandbox nyata menerima token dan redirect URL untuk order test yang unik.

Test Atlas memakai guard nama database tepat `gatherly_test` dan membersihkan fixture setelah selesai. Smoke test Sandbox dipisahkan dari suite deterministik agar tidak membuat transaksi provider pada setiap test run.

## Kriteria selesai

- Endpoint hanya dapat digunakan pemilik order dengan session dan CSRF yang valid.
- Satu order memiliki paling banyak satu sesi Snap aktif.
- Retry untuk state ready memakai token yang tersimpan.
- Timeout tidak menyebabkan pembuatan transaksi provider kedua.
- Expiry provider mengikuti reservasi 15 menit.
- Typecheck, build, integration test, dan smoke test Sandbox lulus.
- Request dan respons endpoint siap dimasukkan ke Postman collection.
