/**
 * Data contoh yang sama dengan desain (design/canvas-structure.md, bagian "Data contoh").
 * Dipakai oleh mock di setiap modul fitur selama endpoint backend belum siap.
 */

const IMG = (id: string) => `https://images.unsplash.com/${id}?w=1200&q=80&auto=format&fit=crop`;

export const FIX = {
  buyer: {
    id: "u_aulia",
    name: "Aulia Nur Fajri",
    email: "aulia@mail.ugm.ac.id",
    phone: "0812 3456 7890",
    googleEmail: "aulia.nf@gmail.com",
    joinedAt: "2026-08-03T02:00:00Z",
  },
  organizer: {
    id: "org_kolektifsawah",
    username: "kolektifsawah",
    name: "Kolektif Sawah",
    city: "Kabupaten Sleman",
    since: 2021,
    description:
      "Kolektif musik dan seni yang menggelar konser jazz, lokakarya, dan pasar seni di ruang terbuka sekitar Yogyakarta sejak 2021.",
    links: [
      { type: "instagram", url: "instagram.com/kolektifsawah" },
      { type: "tiktok", url: "tiktok.com/@kolektifsawah" },
      { type: "website", url: "kolektifsawah.id" },
    ],
    pic: { name: "Rafi Pratama", role: "Ketua", email: "rafi@kolektifsawah.id", phone: "0813 2222 4410" },
    eventCount: 5,
  },
  festival: {
    id: "ev_festival_jazz",
    slug: "festival-jazz-di-sawah",
    title: "Festival Jazz di Sawah",
    category: "Musik",
    poster: IMG("photo-1511192336575-5a79af67a629"),
    startsAt: "2026-11-21T08:00:00Z",
    endsAt: "2026-11-21T15:00:00Z",
    timezone: "Asia/Jakarta",
    venueName: "Desa Wisata Brayut",
    address: "Jl. Brayut, Pandowoharjo, Sleman, Yogyakarta 55512",
    city: "Sleman",
    description:
      "Sore yang pelan di tengah sawah Brayut: panggung kayu, angin kampung, dan jazz yang dimainkan musisi lokal Yogyakarta. Bawa tikar, datang sebelum matahari terbenam.",
    performerLabel: "Yang akan tampil",
    performers: [
      { name: "Sekar Jazz Collective", note: "Pembuka", time: "15.30", photo: IMG("photo-1577549023027-0c4ba20418bb") },
      { name: "Bentang Kuartet", note: "Jazz tradisi", time: "17.30", photo: IMG("photo-1737305917963-4b27bded6959") },
      { name: "Trio Lumbung", note: "Penutup", time: "20.00", photo: IMG("photo-1785038235596-3446d85979e6") },
    ],
    terms: [
      "Usia minimal 17 tahun, bawa kartu identitas.",
      "Dilarang membawa minuman beralkohol ke area festival.",
      "Satu e-tiket ber-QR untuk tiap peserta. Nama peserta diisi sebelum bayar.",
      "Maksimal 4 tiket per pesanan.",
      "Tiket tidak dapat dikembalikan, kecuali acara dibatalkan penyelenggara.",
      "Tunjukkan kode QR di pintu masuk. Panitia memindai satu kali.",
    ],
    ticketTypes: [
      { id: "tt_presale", name: "Presale", price: 80000, capacity: 50, sold: 50, salesStartsAt: "2026-10-01T03:00:00Z", salesEndsAt: "2026-10-07T16:59:00Z", status: "sold_out" as const },
      { id: "tt_reguler", name: "Reguler", price: 100000, capacity: 200, sold: 118, salesStartsAt: "2026-10-08T03:00:00Z", salesEndsAt: "2026-11-20T16:59:00Z", status: "on_sale" as const },
    ],
    maxPerOrder: 4,
  },
  catalog: [
    { slug: "senja-akustik-di-kotabaru", title: "Senja Akustik di Kotabaru", category: "Musik", startsAt: "2026-10-24T12:00:00Z", venueName: "Kotabaru", startingPrice: 75000, poster: IMG("photo-1501386761578-eac5c94b800a") },
    { slug: "workshop-risograph", title: "Workshop Risograph", category: "Lokakarya", startsAt: "2026-10-25T03:00:00Z", venueName: "Ruang Kolektif Prawirotaman", startingPrice: 150000, poster: IMG("photo-1513364776144-60967b0f800f") },
    { slug: "jogja-night-run-5k", title: "Jogja Night Run 5K", category: "Olahraga", startsAt: "2026-10-31T12:30:00Z", venueName: "Alun-Alun Kidul", startingPrice: 120000, poster: IMG("photo-1452626038306-9aae5e071dd3") },
    { slug: "festival-jazz-di-sawah", title: "Festival Jazz di Sawah", category: "Musik", startsAt: "2026-11-21T08:00:00Z", venueName: "Desa Wisata Brayut", startingPrice: 100000, poster: IMG("photo-1511192336575-5a79af67a629") },
    { slug: "meetup-desainer-produk-12", title: "Meetup Desainer Produk #12", category: "Komunitas", startsAt: "2026-10-29T11:00:00Z", venueName: "Kopi Klotok Kaliurang", startingPrice: 0, poster: IMG("photo-1528605248644-14dd04022da1") },
  ],
  order: {
    id: "ord_4a7n",
    orderCode: "GTH-4A7N",
    createdAt: "2026-10-14T07:03:00Z",
    paidAt: "2026-10-14T07:06:00Z",
    expiresAt: "2026-10-14T07:18:00Z",
    quantity: 2,
    unitPrice: 100000,
    totalAmount: 200000,
    attendees: [
      { name: "Aulia Nur Fajri", email: "aulia@mail.ugm.ac.id" },
      { name: "Rafi Pratama", email: "rafi@kolektifsawah.id" },
    ],
    tickets: [
      { id: "tk_29xm", ticketCode: "GTH-4A7N-29XM", attendeeName: "Aulia Nur Fajri" },
      { id: "tk_31pl", ticketCode: "GTH-4A7N-31PL", attendeeName: "Rafi Pratama" },
    ],
    paymentMethod: "BCA Virtual Account",
  },
  orgEvents: [
    { id: "ev_festival_jazz", title: "Festival Jazz di Sawah", startsAt: "2026-11-21T08:00:00Z", venueName: "Desa Wisata Brayut", sold: 168, capacity: 250, gross: 16800000, status: "on_sale" as const },
    { id: "ev_keroncong", title: "Keroncong di Pendopo", startsAt: "2026-12-05T12:00:00Z", venueName: "Pendopo Kalurahan", sold: 74, capacity: 120, gross: 3700000, status: "on_sale" as const },
    { id: "ev_gamelan_synth", title: "Malam Eksperimen Gamelan dan Synth", startsAt: "2026-12-11T13:00:00Z", venueName: "Kedai Kebun Forum", sold: 0, capacity: 180, gross: 0, status: "scheduled" as const },
    { id: "ev_halaman_8", title: "Panggung Halaman Rumah #8", startsAt: "2026-12-20T09:00:00Z", venueName: "Kampung Gedongkiwo", sold: 52, capacity: 80, gross: 0, status: "on_sale" as const },
    { id: "ev_zine", title: "Pameran Zine Jogja", startsAt: null, venueName: null, sold: 0, capacity: 0, gross: 0, status: "draft" as const },
  ],
  team: [
    { id: "c_dimas", name: "Dimas Satria", username: "dimas.sawah", assignedEvents: 2, status: "active" as const },
    { id: "c_nisa", name: "Nisa Rahmawati", username: "nisa.sawah", assignedEvents: 1, status: "active" as const },
    { id: "c_yoga", name: "Yoga Pradana", username: "yoga.sawah", assignedEvents: 0, status: "never_logged_in" as const },
    { id: "c_laras", name: "Laras Ayu", username: "laras.sawah", assignedEvents: 0, status: "inactive" as const },
  ],
  bank: { bank: "BCA", accountNumber: "8610224410", holderName: "Rafi Pratama" },
  payouts: [
    { eventId: "ev_pasar_musik", eventTitle: "Pasar Musik Kampung", eventDate: "2026-10-31T09:00:00Z", net: 14962500, status: "available" as const },
    { eventId: "ev_festival_jazz", eventTitle: "Festival Jazz di Sawah", eventDate: "2026-11-21T08:00:00Z", net: 15960000, status: "waiting_event" as const },
    { eventId: "ev_keroncong", eventTitle: "Keroncong di Pendopo", eventDate: "2026-12-05T12:00:00Z", net: 3515000, status: "waiting_event" as const },
  ],
  applications: [
    { id: "app_0042", number: "PNG-2609-0042", organizerName: "Kolektif Sawah", type: "Komunitas", submittedAt: "2026-09-14T03:12:00Z", status: "new" as const },
    { id: "app_0041", number: "PNG-2609-0041", organizerName: "UKM Musik UGM", type: "Organisasi kampus", submittedAt: "2026-09-14T01:40:00Z", status: "fix_submitted" as const },
    { id: "app_0040", number: "PNG-2609-0040", organizerName: "Teater Gardanalla", type: "Komunitas", submittedAt: "2026-09-13T14:05:00Z", status: "new" as const },
    { id: "app_0038", number: "PNG-2609-0038", organizerName: "Jogja Runners", type: "Komunitas", submittedAt: "2026-09-13T07:22:00Z", status: "new" as const },
    { id: "app_0036", number: "PNG-2609-0036", organizerName: "PT Cahaya Panggung", type: "Perusahaan", submittedAt: "2026-09-12T02:17:00Z", status: "new" as const },
  ],
  adminPayouts: [
    { id: "po_0007", number: "CR-2611-0007", organizerName: "Kolektif Sawah", eventTitle: "Pasar Musik Kampung", amount: 14962500, requestedAt: "2026-11-15T03:20:00Z", bank: "BCA 8610224410 a.n. Rafi Pratama", status: "requested" as const },
    { id: "po_0006", number: "CR-2611-0006", organizerName: "Jogja Runners", eventTitle: "Jogja Night Run 5K", amount: 8550000, requestedAt: "2026-11-14T09:05:00Z", bank: "BNI 0412778190 a.n. Jogja Runners", status: "requested" as const },
  ],
  reports: [
    { id: "rp_1", eventTitle: "Festival Jazz di Sawah", organizerName: "Kolektif Sawah", reason: "fraud" as const, createdAt: "2026-11-17T14:40:00Z", status: "new" as const },
    { id: "rp_2", eventTitle: "Pameran Foto Kampung Kota", organizerName: "Ruang Arsip Kota", reason: "inappropriate" as const, createdAt: "2026-11-16T02:15:00Z", status: "new" as const },
    { id: "rp_3", eventTitle: "Jogja Night Run 5K", organizerName: "Jogja Runners", reason: "wrong_info" as const, createdAt: "2026-11-15T11:02:00Z", status: "new" as const },
  ],
};
