# Rencana implementasi notifikasi dan rekonsiliasi pembayaran

1. Tambahkan PaymentEvent dan metadata rekonsiliasi pada order.
2. Implementasikan verifikasi signature, nominal, fingerprint, dan normalisasi status.
3. Implementasikan transaksi bersama untuk paid, failed, expired, pending, dan discrepancy.
4. Pasang webhook publik Midtrans.
5. Tambahkan GET Status adapter serta worker durable berbasis lease.
6. Uji duplicate, stale notification, expiry race, dan recovery pada Atlas.
7. Jalankan typecheck/build, commit, dan push branch #13.
