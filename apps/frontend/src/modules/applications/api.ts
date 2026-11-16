import { api, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Pengajuan organizer di gatherly.xyz. Pita desain 13. Semua pending (issue B29).
 * Review oleh admin ada di modules/admin.
 */

export type OrganizerType = "individu" | "komunitas" | "organisasi_kampus" | "perusahaan";
export type LinkType = "instagram" | "tiktok" | "youtube" | "website" | "lainnya";

export type ApplicationInput = {
  organizerName: string;
  organizerType: OrganizerType;
  description: string;
  address: { province: string; city: string; street: string; postalCode: string };
  links: { type: LinkType; url: string }[];
  pic: { name: string; role: string; email: string; phone: string };
  username: string;
  /** Diunggah lewat FormData: ktp (gambar/PDF maks 1 MB), legalDocument (PDF maks 2 MB, opsional). */
};

export type ApplicationStatus = "new" | "needs_fix" | "fix_submitted" | "approved" | "rejected";

export type FieldFlag = { field: string; note: string };

export type Application = ApplicationInput & {
  id: string;
  number: string;
  status: ApplicationStatus;
  submittedAt: string;
  fixDeadline?: string | null;
  flags: FieldFlag[];
  rejectionReason?: string | null;
};

const pending = { pending: true } as const;

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
    province: "DI Yogyakarta",
    city: "Kabupaten Sleman",
    street: "Jalan Kaliurang KM 5, Gang Sawah Nomor 12, Caturtunggal",
    postalCode: "55281",
  },
  links: FIX.organizer.links as Application["links"],
  pic: FIX.organizer.pic,
  username: FIX.organizer.username,
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
      mock: () => wrap({ available: username !== "kolektif", suggestions: ["kolektifsawah", "kolektif.sawah"] }),
    }),
  submit: (form: FormData) =>
    api.post<{ data: { number: string } }>("/organizer-applications", form, {
      ...pending,
      mock: () => wrap({ number: "PNG-2609-0042" }),
    }),
  /** Buka pengajuan untuk diperbaiki dengan nomor + email. */
  open: (number: string, email: string) =>
    api.post<{ data: Application }>("/organizer-applications/lookup", { number, email }, {
      ...pending,
      mock: () => wrap(mockApplication),
    }),
  submitFix: (number: string, form: FormData) =>
    api.post<void>(`/organizer-applications/${number}/fix`, form, { ...pending, mock: () => undefined }),
};
