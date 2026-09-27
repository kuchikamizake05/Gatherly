# Rencana implementasi reservasi tiket atomik

1. Tambahkan model order, status kanonis, snapshot, dan indeks idempotency.
2. Tambahkan `checkoutVersion` pada event dan selaraskan mutasi event yang memengaruhi checkout.
3. Buat schema validasi, serializer `OrderDTO`, dan service transaksi reservasi.
4. Pasang endpoint create/list/detail order pada `/api/v1/orders`.
5. Tambahkan integration test dengan guard database `gatherly_test`, termasuk perebutan slot terakhir.
6. Jalankan typecheck, build, dan integration test terhadap Atlas.
7. Cocokkan hasil aktual dengan kontrak API dan siapkan bukti yang dapat dipindahkan ke Postman.
