# Rencana implementasi sesi pembayaran Midtrans

1. Tambahkan konfigurasi Sandbox dan field payment session pada order.
2. Buat adapter HTTP Midtrans dengan timeout dan klasifikasi hasil.
3. Buat service state machine dengan atomic claim untuk mencegah charge ganda.
4. Pasang endpoint `POST /api/v1/orders/:id/payment-session`.
5. Tambahkan integration test state, concurrency, ownership, dan payload.
6. Jalankan typecheck, build, integration test Atlas, dan smoke test Sandbox terpisah.
7. Commit dan push branch #12 setelah seluruh verifikasi lulus.
