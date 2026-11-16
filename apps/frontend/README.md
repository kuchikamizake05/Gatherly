# Gatherly frontend

Satu app Next.js 16 untuk tiga domain. Aturan lengkap ada di [design/frontend-rules.md](../../design/frontend-rules.md),
peta desain di [design/canvas-structure.md](../../design/canvas-structure.md).

## Menjalankan

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

| App | Alamat lokal | Folder |
| --- | --- | --- |
| gatherly.xyz | http://localhost:3000 | `app/(main)` |
| organizer.gatherly.xyz | http://organizer.localhost:3000 | `app/organizer` |
| admin.gatherly.xyz | http://admin.localhost:3000 | `app/admin` |

`proxy.ts` membaca host lalu mengarahkan ke folder yang sesuai. Di dalam app organizer dan admin, tulis tautan tanpa awalan folder (`/events`, bukan `/organizer/events`).

Tanpa backend: isi `NEXT_PUBLIC_API_MOCK=true` di `.env.local`, semua data memakai contoh dari desain.

## Struktur

```
app/
├── (main)/
│   ├── (auth)/        login, register, verify, forgot-password, reset-password (tanpa navbar)
│   └── (site)/        halaman dengan navbar + footer
│       ├── (buyer)/   halaman yang butuh login peserta: checkout, orders, tickets, saved, account
│       └── ...        beranda, events, organizers, become-organizer
├── organizer/
│   ├── (auth)/        login, change-password, forgot-password, reset-password
│   └── (workspace)/   dashboard, events, profile, settings (sidebar + penjaga login)
└── admin/
    ├── (auth)/        login, verify, backup-code
    └── (console)/     applications, organizers, payouts, reports
src/
├── components/
│   ├── ui/            komponen dasar shadcn yang sudah disesuaikan ke desain
│   ├── elements/      komponen gabungan bersama (kartu acara, empty state, dan seterusnya)
│   └── layout/        site-shell, workspace-shell, guards
├── modules/<fitur>/   types.ts, api.ts, hooks.ts per fitur
└── lib/               api client, format Rupiah dan tanggal, utils
```

## Cara mengerjakan satu halaman

1. Buka halamannya. Setiap halaman sekarang berisi `RouteStub` yang menunjukkan nomor pita desain dan data yang sudah tersambung.
2. Lihat pita itu di file desain (tiga ukuran: 1440, 834, 390).
3. Ganti `RouteStub` dengan UI asli. Hook data sudah tersedia di `src/modules/<fitur>/hooks.ts`.
4. Komponen yang dipakai di lebih dari satu halaman masuk ke `src/components/elements`.
5. Lengkapi keadaan memuat, kosong, gagal, dan luring sesuai desain.

## Data dan mock

- Semua request lewat `api` di `src/lib/api/client.ts`. Cookie sesi dan header CSRF sudah diurus.
- Endpoint yang belum dibuat backend ditandai `pending: true` di `api.ts` dan selalu memakai data contoh. Nomor issue backend ada di komentar tiap file (B28 sampai B42).
- Begitu endpoint asli siap, hapus `pending: true`. Halaman tidak perlu diubah selama bentuk datanya sama.
- Bentuk data untuk endpoint yang sudah ada mengikuti `docs/api-contract.md`. Cocokkan dengan Swagger saat integrasi.

## Komponen dasar yang sudah sesuai desain

`Button` (primary, secondary, outline, ghost, danger, icon, prop `loading`), `Input`, `Field` (label + helper + error),
`Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Badge` (tone), `Tabs` bergaris bawah dengan angka,
`Dialog`, `Drawer` (lembar bawah mobile dan laci kiri), `Toaster` (kanan bawah, tengah atas di mobile), `Skeleton` shimmer,
`Tooltip`, `Popover`, `DropdownMenu`, `Table`, `Avatar`, `Separator`.

## Keadaan halaman

Pakai `StateView` (`src/components/elements/state-view.tsx`) untuk semua keadaan selain konten normal:
kosong, tidak ditemukan, gagal dimuat, kedaluwarsa, berhasil. Komponen ini selalu memenuhi lebar dan tinggi ruang yang tersedia.

```tsx
<StateView
  illustration="no-tickets"
  title="Belum punya tiket"
  description="Tiket yang Anda beli akan muncul di sini."
  action={<Button asChild><Link href="/">Jelajahi acara</Link></Button>}
/>
```

- `layout="page"` (bawaan) mengisi area di bawah navbar atau topbar. Di mobile tombol aksi menempel di bawah.
- `layout="section"` untuk di dalam kartu. `layout="screen"` untuk layar penuh tanpa shell.
- Ilustrasi: `no-results`, `not-found`, `failed-load`, `no-tickets`, `nothing-saved`, `no-events`, `waiting`, `verifying`, `preparing`, `success`, `failed`, `expired`.
- Hanya satu aksi. Jangan ulangi tombol yang sama di tempat lain.
- Banner luring sudah otomatis di bawah navbar dan topbar (`OfflineBanner`). Nonaktifkan tombol yang butuh koneksi dengan `useOnline()` dari `src/hooks/use-online.ts`.

Helper format: `formatRupiah`, `formatRupiahShort`, `formatDateShort`, `formatDateLong`, `formatTime`, `formatTimeRange` di `src/lib/format.ts`.
