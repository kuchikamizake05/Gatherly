import { env } from "../../config/env.js";
import type { EmailInput } from "./email.service.js";

/**
 * Template email Gatherlyy. Setiap email punya versi HTML (tabel dan gaya inline supaya aman di
 * Gmail, Outlook, dan aplikasi email ponsel) serta versi teks polos sebagai cadangan.
 */

const BRAND = "Gatherlyy";
const YELLOW = "#FFDD33";
const INK = "#111113";
const MUTED = "#52525B";
const LINE = "#E4E4E8";
const CANVAS = "#F4F4F5";
const FONT = "'Manrope','Segoe UI',Helvetica,Arial,sans-serif";

const web = () => env.PUBLIC_WEB_URL.replace(/\/$/, "");
const organizerWeb = () =>
  (process.env.ORGANIZER_ORIGIN ?? web().replace("://", "://organizer.")).replace(/\/$/, "");

export const rupiah = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;

export function formatWib(date: Date, timeZone = "Asia/Jakarta") {
  const text = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
  return `${text} WIB`;
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Layout = {
  preheader: string;
  title: string;
  intro: string[];
  rows?: [string, string][];
  code?: string;
  button?: { label: string; url: string };
  after?: string[];
  list?: string[];
  tone?: "default" | "success" | "warning";
};

function html(l: Layout) {
  const accent = l.tone === "success" ? "#16A34A" : l.tone === "warning" ? "#D97706" : YELLOW;
  const p = (t: string) =>
    `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${MUTED};">${esc(t)}</p>`;
  const rows = l.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${LINE};border-radius:12px;border-collapse:separate;">
${l.rows
  .map(
    ([k, v], i) => `<tr><td style="padding:12px 16px;font-family:${FONT};font-size:13px;color:${MUTED};${i ? `border-top:1px solid ${LINE};` : ""}width:42%;vertical-align:top;">${esc(k)}</td><td style="padding:12px 16px;font-family:${FONT};font-size:14px;font-weight:700;color:${INK};${i ? `border-top:1px solid ${LINE};` : ""}text-align:right;vertical-align:top;">${esc(v)}</td></tr>`,
  )
  .join("\n")}
</table>`
    : "";
  const code = l.code
    ? `<div style="margin:6px 0 20px;padding:18px;background:#FFFBE6;border:1px dashed ${YELLOW};border-radius:12px;text-align:center;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${INK};">${esc(l.code)}</div>`
    : "";
  const list = l.list?.length
    ? `<ul style="margin:0 0 18px;padding-left:20px;">${l.list
        .map((t) => `<li style="margin:0 0 8px;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK};">${esc(t)}</li>`)
        .join("")}</ul>`
    : "";
  const button = l.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td style="border-radius:999px;background:${YELLOW};">
<a href="${esc(l.button.url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:800;color:${INK};text-decoration:none;border-radius:999px;">${esc(l.button.label)}</a>
</td></tr></table>
<p style="margin:0 0 18px;font-family:${FONT};font-size:12px;line-height:1.5;color:#71717A;">Tombol tidak berfungsi? Salin tautan ini ke browser:<br><a href="${esc(l.button.url)}" style="color:${INK};word-break:break-all;">${esc(l.button.url)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:${CANVAS};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 18px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${web()}/icon-192.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-family:${FONT};font-size:20px;font-weight:800;color:${INK};letter-spacing:-0.3px;">gatherlyy</td>
</tr></table>
</td></tr>
<tr><td style="background:#FFFFFF;border-radius:20px;padding:32px 28px 18px;">
<div style="width:40px;height:6px;margin:0 0 18px;background:${accent};border-radius:999px;font-size:0;line-height:0;">&nbsp;</div>
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:800;color:${INK};">${esc(l.title)}</h1>
${l.intro.map(p).join("\n")}
${code}${rows}${list}${button}
${(l.after ?? []).map(p).join("\n")}
</td></tr>
<tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#71717A;text-align:center;">
Email ini dikirim otomatis oleh ${BRAND}, platform tiket acara komunitas.<br>
<a href="${web()}" style="color:#71717A;">gatherlyy.fun</a> · Mohon tidak membalas email ini.
</td></tr>
</table></td></tr></table>
</body></html>`;
}

function text(l: Layout) {
  const lines = [l.title, "", ...l.intro];
  if (l.code) lines.push("", l.code);
  if (l.rows?.length) lines.push("", ...l.rows.map(([k, v]) => `${k}: ${v}`));
  if (l.list?.length) lines.push("", ...l.list.map((t) => `- ${t}`));
  if (l.button) lines.push("", `${l.button.label}: ${l.button.url}`);
  if (l.after?.length) lines.push("", ...l.after);
  lines.push("", `${BRAND} · gatherlyy.fun`);
  return lines.join("\n");
}

function build(key: string, to: string, subject: string, l: Layout, extra: Partial<EmailInput> = {}): EmailInput {
  return { key, to, subject, text: text(l), html: html(l), ...extra };
}

/** Untuk email yang dikirim langsung (bukan lewat antrean), misalnya kode OTP. */
export function renderEmail(l: Layout) {
  return { text: text(l), html: html(l) };
}

// ---------------------------------------------------------------- akun

export function otpEmail(code: string, purpose: "register" | "login") {
  const action = purpose === "register" ? "memverifikasi akun Gatherlyy Anda" : "masuk ke Gatherlyy";
  return {
    subject: `${code} adalah kode verifikasi Gatherlyy Anda`,
    ...renderEmail({
      preheader: `Kode verifikasi Anda ${code}. Berlaku 10 menit.`,
      title: "Kode verifikasi Anda",
      intro: [`Masukkan kode berikut untuk ${action}.`],
      code,
      after: [
        "Kode berlaku 10 menit dan hanya bisa dipakai sekali.",
        "Bila Anda tidak merasa meminta kode ini, abaikan email ini.",
      ],
    }),
  };
}

export function passwordResetEmail(key: string, to: string, url: string, workspace = false) {
  return build(key, to, "Atur ulang password Gatherlyy", {
    preheader: "Tautan untuk mengatur ulang password berlaku 30 menit.",
    title: "Atur ulang password",
    intro: [
      workspace
        ? "Kami menerima permintaan untuk mengatur ulang password akun workspace organizer Anda."
        : "Kami menerima permintaan untuk mengatur ulang password akun Gatherlyy Anda.",
    ],
    button: { label: "Atur ulang password", url },
    after: [
      "Tautan berlaku 30 menit dan hanya bisa dipakai sekali.",
      "Bila Anda tidak meminta ini, abaikan email ini. Password Anda tidak berubah.",
    ],
  });
}

export function adminBackupUsedEmail(key: string, to: string, adminEmail: string) {
  return build(key, to, "Kode cadangan admin Gatherlyy digunakan", {
    preheader: `${adminEmail} masuk memakai kode cadangan.`,
    title: "Kode cadangan admin digunakan",
    tone: "warning",
    intro: [`Akun ${adminEmail} baru saja masuk ke konsol admin memakai kode cadangan.`],
    after: ["Bila ini bukan tindakan yang diketahui, segera nonaktifkan akun tersebut dan ganti kredensialnya."],
  });
}

// ---------------------------------------------------------------- pengajuan organizer

const FIELD_LABEL: Record<string, string> = {
  organizerName: "Nama organizer",
  organizerType: "Jenis organizer",
  description: "Deskripsi",
  address: "Alamat",
  links: "Tautan",
  pic: "Penanggung jawab",
  username: "Username",
  ktp: "Identitas penanggung jawab",
  legalDocument: "Dokumen legal",
};

export function applicationReceivedEmail(key: string, to: string, number: string, token: string) {
  return build(key, to, `Verifikasi email pengajuan organizer ${number}`, {
    preheader: "Verifikasi email penanggung jawab agar pengajuan Anda bisa ditinjau.",
    title: "Verifikasi email penanggung jawab",
    intro: [
      "Terima kasih telah mengajukan diri sebagai organizer di Gatherlyy.",
      "Satu langkah lagi: verifikasi email penanggung jawab supaya tim kami bisa mulai meninjau pengajuan Anda.",
    ],
    rows: [["Nomor pengajuan", number]],
    button: {
      label: "Verifikasi email",
      url: `${web()}/become-organizer/verify-email?token=${encodeURIComponent(token)}`,
    },
    after: ["Tautan berlaku 24 jam. Simpan nomor pengajuan untuk memeriksa atau memperbaiki pengajuan nanti."],
  });
}

export function applicationEmailChangedEmail(key: string, to: string, number: string, token: string) {
  return build(key, to, `Verifikasi email baru pengajuan ${number}`, {
    preheader: "Email penanggung jawab berubah. Verifikasi email baru ini.",
    title: "Verifikasi email baru",
    intro: ["Email penanggung jawab pada pengajuan Anda diganti ke alamat ini. Verifikasi untuk melanjutkan peninjauan."],
    rows: [["Nomor pengajuan", number]],
    button: {
      label: "Verifikasi email",
      url: `${web()}/become-organizer/verify-email?token=${encodeURIComponent(token)}`,
    },
    after: ["Tautan berlaku 24 jam."],
  });
}

export function applicationFixEmail(
  key: string,
  to: string,
  number: string,
  deadline: Date,
  flags: { field: string; note: string }[],
) {
  return build(key, to, `Pengajuan ${number} perlu diperbaiki`, {
    preheader: `Perbaiki pengajuan paling lambat ${formatWib(deadline)}.`,
    title: "Pengajuan perlu diperbaiki",
    tone: "warning",
    intro: ["Tim Gatherlyy sudah meninjau pengajuan Anda. Ada beberapa bagian yang perlu diperbaiki."],
    rows: [
      ["Nomor pengajuan", number],
      ["Batas perbaikan", formatWib(deadline)],
    ],
    list: flags.map((f) => `${FIELD_LABEL[f.field] ?? f.field}: ${f.note}`),
    button: {
      label: "Perbaiki pengajuan",
      url: `${web()}/become-organizer/fix?number=${encodeURIComponent(number)}`,
    },
    after: ["Masuk dengan nomor pengajuan dan email penanggung jawab, lalu kirim ulang pengajuan sebelum batas waktu."],
  });
}

export function applicationRejectedEmail(key: string, to: string, number: string, reason: string) {
  return build(key, to, `Hasil pengajuan organizer ${number}`, {
    preheader: "Pengajuan Anda belum dapat disetujui.",
    title: "Pengajuan belum dapat disetujui",
    intro: ["Terima kasih atas minat Anda menjadi organizer di Gatherlyy. Setelah ditinjau, pengajuan ini belum dapat kami setujui."],
    rows: [
      ["Nomor pengajuan", number],
      ["Alasan", reason],
    ],
    after: ["Anda dapat mengajukan kembali setelah 30 hari."],
  });
}

export function organizerAccessEmail(
  key: string,
  to: string,
  opts: { number?: string; username: string; password: string; expiresAt: Date },
) {
  return build(key, to, opts.number ? `Pengajuan organizer ${opts.number} disetujui` : "Akses workspace organizer Gatherlyy", {
    preheader: "Akun workspace organizer Anda siap dipakai.",
    title: opts.number ? "Selamat, pengajuan Anda disetujui" : "Akses workspace organizer",
    tone: "success",
    intro: [
      opts.number
        ? "Pengajuan organizer Anda telah disetujui. Berikut akses masuk ke workspace organizer."
        : "Berikut akses masuk baru ke workspace organizer Anda.",
    ],
    rows: [
      ...(opts.number ? ([["Nomor pengajuan", opts.number]] as [string, string][]) : []),
      ["Username", opts.username],
      ["Password sementara", opts.password],
      ["Berlaku sampai", formatWib(opts.expiresAt)],
    ],
    button: { label: "Masuk ke workspace", url: `${organizerWeb()}/login` },
    after: ["Ganti password saat login pertama. Jangan bagikan password ini kepada siapa pun."],
  });
}

// ---------------------------------------------------------------- acara dan tiket

export function eventReportReviewedEmail(key: string, to: string, eventTitle: string, note: string) {
  return build(key, to, "Laporan acara Anda telah ditinjau", {
    preheader: `Tim Gatherlyy telah meninjau laporan tentang ${eventTitle}.`,
    title: "Laporan Anda telah ditinjau",
    intro: [`Terima kasih telah melaporkan acara ${eventTitle}. Berikut catatan dari tim Gatherlyy.`],
    rows: [["Catatan", note]],
  });
}

export function scheduleChangedEmail(key: string, to: string, eventTitle: string, url: string) {
  return build(key, to, `Informasi ${eventTitle} diperbarui`, {
    preheader: "Jadwal atau lokasi acara berubah.",
    title: "Informasi acara diperbarui",
    tone: "warning",
    intro: [`Penyelenggara memperbarui jadwal atau lokasi ${eventTitle}. Periksa informasi terbaru sebelum datang.`],
    button: { label: "Lihat tiket saya", url },
  });
}

export function ticketEmail(
  key: string,
  to: string,
  opts: {
    attendeeName: string;
    eventTitle: string;
    startsAt: Date;
    timezone: string;
    venueName: string;
    ticketTypeName: string;
    ticketCode: string;
    link: string;
  },
  attachments: EmailInput["attachments"],
) {
  return build(
    key,
    to,
    `E-tiket ${opts.eventTitle}`,
    {
      preheader: `E-tiket untuk ${opts.attendeeName} sudah terbit.`,
      title: "E-tiket Anda sudah terbit",
      tone: "success",
      intro: [`Halo ${opts.attendeeName}, berikut e-tiket Anda. PDF e-tiket juga terlampir di email ini.`],
      rows: [
        ["Acara", opts.eventTitle],
        ["Waktu", formatWib(opts.startsAt, opts.timezone)],
        ["Lokasi", opts.venueName],
        ["Jenis tiket", opts.ticketTypeName],
        ["Kode tiket", opts.ticketCode],
      ],
      button: { label: "Buka e-tiket", url: opts.link },
      after: [
        "Tunjukkan kode QR saat datang. Satu tiket hanya berlaku untuk satu kali masuk.",
        "Jangan bagikan QR atau tautan e-tiket kepada orang lain.",
      ],
    },
    { attachments },
  );
}

export function reminderEmail(
  key: string,
  to: string,
  opts: {
    attendeeName: string;
    eventTitle: string;
    startsAt: Date;
    timezone: string;
    venueName: string;
    ticketCode: string;
  },
) {
  return build(key, to, `Besok: ${opts.eventTitle}`, {
    preheader: `${opts.eventTitle} dimulai ${formatWib(opts.startsAt, opts.timezone)}.`,
    title: "Acara Anda segera dimulai",
    intro: [`Halo ${opts.attendeeName}, ini pengingat untuk acara yang akan Anda hadiri.`],
    rows: [
      ["Acara", opts.eventTitle],
      ["Waktu", formatWib(opts.startsAt, opts.timezone)],
      ["Lokasi", opts.venueName],
      ["Kode tiket", opts.ticketCode],
    ],
    button: { label: "Buka Tiketku", url: `${web()}/tickets` },
    after: ["Siapkan kode QR e-tiket di ponsel Anda saat datang. Tidak perlu dicetak."],
  });
}

export function orderSummaryEmail(
  key: string,
  to: string,
  opts: { orderCode: string; eventTitle: string; quantity: number; total: number; url: string },
) {
  return build(key, to, `Pembayaran berhasil · ${opts.orderCode}`, {
    preheader: `Pembayaran ${opts.orderCode} sebesar ${rupiah(opts.total)} berhasil.`,
    title: "Pembayaran berhasil",
    tone: "success",
    intro: ["Terima kasih, pembayaran Anda sudah kami terima. E-tiket dikirim ke email setiap peserta."],
    rows: [
      ["Nomor pesanan", opts.orderCode],
      ["Acara", opts.eventTitle],
      ["Jumlah tiket", `${opts.quantity} tiket`],
      ["Total dibayar", rupiah(opts.total)],
    ],
    button: { label: "Lihat pesanan", url: opts.url },
  });
}

// ---------------------------------------------------------------- dana

export function payoutDoneEmail(key: string, to: string, amount: number, reference: string) {
  return build(key, to, "Pencairan dana Gatherlyy selesai", {
    preheader: `${rupiah(amount)} telah ditransfer ke rekening Anda.`,
    title: "Pencairan dana selesai",
    tone: "success",
    intro: ["Dana penjualan tiket Anda telah ditransfer ke rekening yang terdaftar."],
    rows: [
      ["Jumlah", rupiah(amount)],
      ["Referensi transfer", reference],
    ],
    button: { label: "Lihat pencairan", url: `${organizerWeb()}/settings/payout` },
  });
}

export function refundReviewEmail(key: string, to: string, orderCode: string, approve: boolean, note: string) {
  return build(key, to, approve ? `Pengembalian dana ${orderCode} disetujui` : `Pengembalian dana ${orderCode} ditolak`, {
    preheader: approve ? "Pengembalian dana Anda sedang diproses." : "Pengajuan pengembalian dana belum disetujui.",
    title: approve ? "Pengembalian dana disetujui" : "Pengembalian dana ditolak",
    tone: approve ? "success" : "warning",
    intro: [
      approve
        ? "Pengajuan pengembalian dana Anda disetujui dan sedang diproses. Biaya layanan tidak dikembalikan."
        : "Pengajuan pengembalian dana Anda belum dapat disetujui.",
    ],
    rows: [
      ["Nomor pesanan", orderCode],
      ["Catatan", note],
    ],
    button: { label: "Lihat Tiketku", url: `${web()}/tickets` },
  });
}

export function refundCompletedEmail(key: string, to: string, orderCode: string, amount: number, reference?: string) {
  return build(key, to, `Pengembalian dana ${orderCode} selesai`, {
    preheader: `${rupiah(amount)} telah dikembalikan.`,
    title: "Pengembalian dana selesai",
    tone: "success",
    intro: ["Dana Anda telah dikembalikan ke metode pembayaran yang dipakai atau ke rekening Anda."],
    rows: [
      ["Nomor pesanan", orderCode],
      ["Jumlah", rupiah(amount)],
      ...(reference ? ([["Referensi", reference]] as [string, string][]) : []),
    ],
  });
}

export function refundEmail(opts: {
  key: string;
  to: string;
  orderCode: string;
  eventTitle: string;
  amount: number;
  tickets: number;
  reason: string;
}) {
  return build(opts.key, opts.to, `Pengembalian dana ${opts.orderCode} dari penyelenggara`, {
    preheader: `${rupiah(opts.amount)} akan dikembalikan oleh penyelenggara.`,
    title: "Penyelenggara mengembalikan dana Anda",
    intro: [
      `Penyelenggara ${opts.eventTitle} membatalkan ${opts.tickets} tiket pada pesanan Anda dan mengembalikan dananya.`,
      "Tiket yang dibatalkan tidak dapat dipakai untuk check-in. Biaya layanan tidak dikembalikan.",
    ],
    rows: [
      ["Nomor pesanan", opts.orderCode],
      ["Tiket dibatalkan", `${opts.tickets} tiket`],
      ["Jumlah pengembalian", rupiah(opts.amount)],
      ["Alasan", opts.reason],
    ],
    button: { label: "Lihat Tiketku", url: `${web()}/tickets` },
  });
}
