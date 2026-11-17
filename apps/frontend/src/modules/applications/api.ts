import { api, ApiError, upload, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";
import type { UploadedFile } from "@/components/elements/FileUpload";

/**
 * Pengajuan organizer di situs utama. Pita desain 13. Semua pending (issue B29).
 * Dokumen diunggah satu per satu saat dipilih (dengan progres), lalu pengajuan dikirim sebagai JSON
 * berisi id dokumennya. Review oleh admin ada di modules/admin.
 */

export type OrganizerType = "komunitas" | "organisasi_kampus" | "perusahaan" | "individu";
export type LinkType = "instagram" | "tiktok" | "youtube" | "website" | "lainnya";

export const ORGANIZER_TYPES: { value: OrganizerType; label: string }[] = [
  { value: "komunitas", label: "Komunitas" },
  { value: "organisasi_kampus", label: "Organisasi kampus" },
  { value: "perusahaan", label: "Perusahaan" },
  { value: "individu", label: "Perorangan" },
];

export const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "website", label: "Situs web" },
  { value: "lainnya", label: "Lainnya" },
];

export type ApplicationInput = {
  organizerName: string;
  organizerType: OrganizerType;
  description: string;
  address: { province: string; city: string; street: string; postalCode: string };
  links: { type: LinkType; url: string }[];
  pic: { name: string; role: string; email: string; phone: string };
  username: string;
  /** Id dari uploadDocument. KTP wajib (gambar atau PDF, maks 1 MB). */
  ktp: UploadedFile | null;
  /** PDF maks 2 MB. Wajib untuk perusahaan dan organisasi kampus. */
  legalDocument: UploadedFile | null;
};

export type ApplicationStatus = "new" | "needs_fix" | "fix_submitted" | "approved" | "rejected";

/**
 * Bagian yang ditandai admin untuk diperbaiki. field memakai nama di ApplicationInput:
 * organizerName, organizerType, description, address, links, pic, username, ktp, legalDocument.
 */
export type FieldFlag = { field: keyof ApplicationInput; note: string };

export type Application = ApplicationInput & {
  id: string;
  number: string;
  status: ApplicationStatus;
  submittedAt: string;
  fixDeadline?: string | null;
  flags: FieldFlag[];
  rejectionReason?: string | null;
};

const pending = {} as const;

const mockApplication: Application = {
  id: "app_0042",
  number: "PNG-2609-0042",
  status: "needs_fix",
  submittedAt: "2026-09-14T03:12:00Z",
  fixDeadline: "2026-09-28T16:59:00Z",
  organizerName: FIX.organizer.name,
  organizerType: "komunitas",
  description: "Kolektif musik dan seni yang rutin menggelar konser di ruang terbuka di sekitar Yogyakarta sejak 2021.",
  address: {
    province: "Daerah Istimewa Yogyakarta",
    city: "Kabupaten Sleman",
    street: "Jalan Kaliurang KM 5, Gang Sawah Nomor 12, Caturtunggal",
    postalCode: "55281",
  },
  links: [
    { type: "instagram", url: "instagram.com/kolektifsawah" },
    { type: "tiktok", url: "tiktok.com/@kolektifsawah" },
    { type: "website", url: "kolektifsawah.id" },
  ],
  pic: FIX.organizer.pic,
  username: FIX.organizer.username,
  ktp: { id: "doc_ktp", name: "ktp-rafi-pratama.jpg", size: 839680, type: "image/jpeg" },
  legalDocument: null,
  flags: [
    { field: "description", note: "Jelaskan jenis acara yang akan Anda selenggarakan, misalnya konser, lokakarya, atau lari." },
    { field: "ktp", note: "Foto KTP buram sehingga nama dan NIK tidak terbaca. Unggah foto yang lebih jelas." },
  ],
};

export const applicationsApi = {
  checkUsername: (username: string) =>
    api.get<{ data: { available: boolean; suggestions: string[] } }>("/organizer-applications/username", {
      query: { username },
      ...pending,
      mock: () => wrap({ available: !["kolektif", "gatherly", "admin"].includes(username), suggestions: [`${username}sawah`, `${username}.sawah`] }),
    }),

  /** Unggah satu dokumen. Kembalian dipakai sebagai nilai FileUpload dan dikirim lagi di submit. */
  uploadDocument: (file: File, opts: { onProgress: (p: number) => void; signal: AbortSignal }) =>
    upload<{ data: UploadedFile }>("/organizer-applications/documents", file, {
      ...opts,
      ...pending,
      mock: () => wrap({ id: `doc_${Date.now()}`, name: file.name, size: file.size, type: file.type }),
    }).then((r) => r.data),

  /**
   * 409 APPLICATION_EXISTS (details.number): email penanggung jawab sudah punya pengajuan yang ditinjau.
   * 409 USERNAME_TAKEN, 409 ALREADY_ORGANIZER.
   */
  submit: (input: ApplicationInput) =>
    api.post<{ data: { number: string; email: string } }>(
      "/organizer-applications",
      { ...input, ktp: input.ktp?.id ?? null, legalDocument: input.legalDocument?.id ?? null },
      { ...pending, mock: () => wrap({ number: "PNG-2609-0042", email: input.pic.email }) },
    ),

  /**
   * Buka pengajuan untuk diperbaiki dengan nomor + email.
   * 404 NOT_FOUND bila nomor dan email tidak cocok, 409 NOT_NEEDS_FIX bila sedang ditinjau, 410 FIX_EXPIRED bila lewat batas.
   */
  open: (number: string, email: string) =>
    api.post<{ data: Application }>("/organizer-applications/lookup", { number, email }, {
      ...pending,
      mock: () => {
        const n = number.trim().toUpperCase();
        if (n === "PNG-2609-0042") return wrap({ ...mockApplication, pic: { ...mockApplication.pic, email } });
        if (n === "PNG-2609-0041") throw new ApiError(409, "NOT_NEEDS_FIX", "Pengajuan sedang ditinjau.");
        if (n === "PNG-2609-0030") throw new ApiError(410, "FIX_EXPIRED", "Batas perbaikan sudah lewat.");
        throw new ApiError(404, "NOT_FOUND", "Nomor pengajuan dan email tidak cocok.");
      },
    }),

  /** Hanya bagian yang ditandai yang dikirim. */
  submitFix: (number: string, input: Partial<ApplicationInput>) =>
    api.post<void>(
      `/organizer-applications/${number}/fix`,
      {
        ...input,
        ...(input.ktp !== undefined ? { ktp: input.ktp?.id ?? null } : {}),
        ...(input.legalDocument !== undefined ? { legalDocument: input.legalDocument?.id ?? null } : {}),
      },
      { ...pending, mock: () => undefined },
    ),
};
