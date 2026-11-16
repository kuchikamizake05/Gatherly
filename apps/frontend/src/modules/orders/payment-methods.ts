/**
 * Metode pembayaran di halaman Bayar (pita 05 A2, C). Urutan dan kelompok sesuai desain.
 * code dikirim ke backend lalu diteruskan sebagai enabled_payments Midtrans Snap.
 * Logo Visa, Mastercard, dan JCB dari thesvg.org. Logo lain dari file desain (paylogos), karena thesvg.org belum punya.
 */

export type PaymentMethod = {
  code: string;
  name: string;
  /** Teks tombol: "Bayar dengan {short}". */
  short: string;
  note?: string;
  tag?: string;
  /** Path logo di public/. Kosong bila memakai wordmark. */
  logos: string[];
  /** Wordmark sementara sampai logo resmi tersedia (catatan di desain). */
  wordmark?: { text: string; color: string };
};

export const PAYMENT_GROUPS: { title: string; methods: PaymentMethod[] }[] = [
  {
    title: "Paling praktis",
    methods: [
      {
        code: "qris",
        name: "QRIS",
        short: "QRIS",
        tag: "Instan",
        note: "Scan pakai GoPay, OVO, DANA, ShopeePay, atau m-banking apa pun",
        logos: ["/brands/pay/qris.png"],
      },
    ],
  },
  {
    title: "E-wallet",
    methods: [
      { code: "gopay", name: "GoPay", short: "GoPay", logos: ["/brands/pay/gopay.png"] },
      { code: "shopeepay", name: "ShopeePay", short: "ShopeePay", logos: [], wordmark: { text: "ShopeePay", color: "#EE4D2D" } },
      { code: "dana", name: "DANA", short: "DANA", logos: ["/brands/pay/dana.png"] },
      { code: "ovo", name: "OVO", short: "OVO", logos: ["/brands/pay/ovo.png"] },
    ],
  },
  {
    title: "Virtual Account",
    methods: [
      { code: "bca_va", name: "BCA Virtual Account", short: "BCA VA", logos: ["/brands/pay/bca.png"] },
      { code: "mandiri_va", name: "Mandiri Virtual Account", short: "Mandiri VA", logos: ["/brands/pay/mandiri.png"] },
      { code: "bni_va", name: "BNI Virtual Account", short: "BNI VA", logos: ["/brands/pay/bni.png"] },
      { code: "bri_va", name: "BRI Virtual Account", short: "BRI VA", logos: ["/brands/pay/bri.png"] },
      { code: "bsi_va", name: "BSI Virtual Account", short: "BSI VA", logos: ["/brands/pay/bsi.png"] },
      { code: "permata_va", name: "Permata Virtual Account", short: "Permata VA", logos: ["/brands/pay/permata.png"] },
      { code: "cimb_va", name: "CIMB Niaga Virtual Account", short: "CIMB Niaga VA", logos: ["/brands/pay/cimb.png"] },
    ],
  },
  {
    title: "Lainnya",
    methods: [
      {
        code: "credit_card",
        name: "Kartu kredit / debit",
        short: "kartu",
        note: "Visa, Mastercard, JCB",
        logos: ["/brands/pay/visa.svg", "/brands/pay/mastercard.svg"],
      },
      { code: "indomaret", name: "Indomaret", short: "Indomaret", note: "Bayar tunai di kasir", logos: ["/brands/pay/indomaret.png"] },
      { code: "alfamart", name: "Alfamart", short: "Alfamart", note: "Bayar tunai di kasir", logos: ["/brands/pay/alfamart.png"] },
      {
        code: "paylater",
        name: "PayLater",
        short: "PayLater",
        note: "Akulaku atau Kredivo",
        logos: [],
        wordmark: { text: "Akulaku", color: "#E62129" },
      },
    ],
  },
];

export const PAYMENT_METHODS = PAYMENT_GROUPS.flatMap((g) => g.methods);
export const paymentMethod = (code?: string | null) => PAYMENT_METHODS.find((m) => m.code === code);
