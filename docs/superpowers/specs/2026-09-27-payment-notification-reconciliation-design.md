# Desain notifikasi dan rekonsiliasi pembayaran

Tanggal: 27 September 2026  
Issue: #13  
Pemilik: Dien (BE 2)

## Tujuan

Tahap ini memverifikasi status pembayaran dari Midtrans, mengubah inventori tepat sekali, dan memulihkan order ketika webhook atau respons provider hilang. Browser callback tidak menetapkan status pembayaran.

Endpoint publik provider:

```text
POST /api/v1/payments/midtrans/notifications
```

## Komponen

```text
backend/src/modules/payments/
├── payment-event.model.ts
├── payment-notification.service.ts
├── payment-reconciliation.service.ts
└── payment.routes.ts
backend/src/jobs/payment-reconciliation.job.ts
```

Webhook tidak memakai session atau CSRF. Signature Midtrans, identitas order, dan nominal menjadi batas kepercayaannya.

## Verifikasi notifikasi

Handler menjalankan urutan berikut:

1. Validasi field wajib dan batas ukuran body.
2. Hitung `SHA512(order_id + status_code + gross_amount + ServerKey)`.
3. Bandingkan signature dengan operasi timing-safe.
4. Cari order berdasarkan `providerOrderId`.
5. Cocokkan gross amount sebagai rupiah integer dan currency `IDR` bila tersedia.
6. Bentuk fingerprint dari identitas transaksi dan status terverifikasi.
7. Simpan `PaymentEvent` secara durable.
8. Terapkan event dalam transaksi MongoDB.
9. Tandai event `processed` dan balas 200.

Signature, Server Key, dan payload provider mentah tidak masuk log atau database. Signature invalid, order asing, dan nominal berbeda ditolak tanpa mengubah order.

## PaymentEvent

Payment event menyimpan:

- `providerOrderId`, `providerTransactionId`, dan `fingerprint` unik.
- Status provider dan status normalisasi.
- `processingStatus`: `received`, `processed`, atau `retry`.
- `receivedAt`, `processedAt`, dan `errorCode` aman.

Notifikasi duplikat dengan fingerprint yang sama membaca event lama. Event processed langsung mendapat acknowledgment. Event retry diproses kembali; unique index tidak boleh membuat event gagal hilang selamanya.

## Normalisasi status

| Status provider | Syarat | Hasil |
| --- | --- | --- |
| `settlement` | status code 200 | paid |
| `capture` | status code 200 dan fraud absent/accept | paid |
| `pending` | — | pending |
| `expire` | — | expired |
| `deny`, `cancel` | — | failed |
| `authorize`, refund, chargeback, atau status asing | — | reconciliation required |

Pending atau notifikasi lama tidak menurunkan order paid. Success menetapkan `paidAt` sekali dari `settlement_time`, `transaction_time`, atau waktu server jika timestamp provider tidak valid.

## Transaksi inventori

Success pada order `pending/held` menjalankan satu transaksi:

```text
order.paymentStatus: pending → paid
order.reservationStatus: held → converted
order.issuanceStatus: not_ready → processing
ticketType.reserved -= quantity
ticketType.sold += quantity
```

Failure atau expiry yang terverifikasi pada order `pending/held` menjalankan:

```text
order.paymentStatus: pending → failed|expired
order.reservationStatus: held → released
order.paymentSessionState → closed
ticketType.reserved -= quantity
```

Conditional state transition dan counter update mencegah webhook, retry, dan worker mengubah inventori dua kali. Order paid mengabaikan pending, failed, atau expired yang datang terlambat.

Paid yang datang setelah reservasi released tidak mengurangi reserved dan tidak menambah sold. Sistem mencatat `paymentStatus=paid`, mempertahankan `reservationStatus=released` dan `issuanceStatus=not_ready`, lalu menetapkan `reconciliationRequired=true` dengan alasan aman. UI dapat menunjukkan pembayaran terkonfirmasi tetapi tiket sedang diperiksa tanpa menyebut pembayaran gagal.

Timeline pembayaran menyimpan transisi terverifikasi sekali dan tetap berurutan. Notifikasi duplikat tidak menambah item timeline.

## Rekonsiliasi

Worker berjalan berkala dalam proses backend dan menjalankan catch-up saat startup. Timer hanya memicu pekerjaan; state, jadwal, dan lease tersimpan di MongoDB.

Worker mengklaim order melalui `nextReconcileAt` dan `leaseUntil`:

- Order expired dengan `paymentSessionState=not_started` dan tanpa provider attempt dilepas langsung.
- State `ready`, `creating`, atau `uncertain` diperiksa melalui `GET /v2/{providerOrderId}/status`.
- Paid, failed, expired, dan pending memakai pemroses status yang sama dengan webhook.
- Pending dijadwalkan ulang.
- Timeout atau 5xx memperpanjang backoff tanpa melepas inventori.
- Not found sebelum expiry hanya dijadwalkan ulang.
- Not found setelah expiry menutup sesi dan memerlukan dua observasi terpisah sebelum release.

Worker memakai exponential backoff terbatas. Lease yang habis membuat pekerjaan dapat diambil proses lain setelah restart.

## Respons dan retry

- Webhook valid dan processed atau duplicate: 200.
- Payload/signature invalid: 400.
- Order tidak dikenal atau nominal berbeda: 400 tanpa kebocoran detail.
- Kegagalan database sementara setelah event durable: 503 agar provider mencoba kembali.
- Error internal tidak mengembalikan payload mentah provider.

## Pengujian

Integration test memakai `gatherly_test` dan provider adapter palsu. Kasus wajib:

1. Signature valid dan invalid.
2. Order ID, nominal, dan currency tidak cocok.
3. Settlement dan capture valid mengonversi inventori tepat sekali.
4. Duplicate webhook tidak menggandakan timeline, sold, atau ticket issuance state.
5. Pending atau expired setelah paid tidak menurunkan status.
6. Failure dan expiry melepas reserved tepat sekali.
7. Webhook paid berlomba dengan worker expiry; hanya satu transisi menang.
8. Paid setelah release ditandai untuk rekonsiliasi tanpa stok negatif.
9. Provider timeout, 5xx, pending, dan not found menjadwalkan ulang dengan benar.
10. Lease expired dapat dipulihkan setelah restart.

## Kriteria selesai

- Hanya status provider terverifikasi yang mengubah pembayaran.
- Inventory invariant bertahan pada duplicate dan concurrency.
- Order paid tidak pernah turun status.
- Expiry tidak dilepas berdasarkan timer lokal saja jika sesi provider mungkin ada.
- Worker pulih setelah restart tanpa timer per-order.
- Typecheck, build, dan integration test lulus.
- Webhook serta hasilnya siap dibuktikan melalui Postman dan Midtrans Sandbox.
