import { api, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Profil organizer dan Pengaturan (Rekening pencairan, Keamanan). Pita desain 23.
 * Profil dan password (B38), rekening dan pencairan (B39) memakai API nyata.
 */

export type OrganizerProfileSettings = {
  logoUrl: string | null;
  name: string;
  username: string;
  city: string;
  description: string;
  links: { type: string; url: string }[];
};

export type BankAccount = { bank: string; accountNumber: string; holderName: string };

export type PayoutStatus = "waiting_event" | "available" | "requested" | "transferred";

export type PayoutRow = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  /** Nilai dasar tiket setelah pengembalian dana, tanpa potongan biaya layanan tambahan pembeli. */
  net: number;
  status: PayoutStatus;
  requestedAt?: string | null;
  transferredAt?: string | null;
  transferReference?: string | null;
};

export type PayoutOverview = {
  available: number;
  processing: number;
  transferred: number;
  rows: PayoutRow[];
};

const mockOverview: PayoutOverview = {
  available: 14962500,
  processing: 0,
  transferred: 0,
  rows: FIX.payouts.map((p) => ({ ...p })),
};

function normalizeLogo(form: FormData) {
  const logo = form.get("logo");
  if (logo instanceof File) { form.delete("logo"); form.set("file", logo); }
  return form;
}

export const organizerSettingsApi = {
  profile: () =>
    api.get<{ data: OrganizerProfileSettings }>("/organizer/profile", {
      pending: false,
      mock: () =>
        wrap({
          logoUrl: null,
          name: FIX.organizer.name,
          username: FIX.organizer.username,
          city: FIX.organizer.city,
          description: FIX.organizer.description,
          links: FIX.organizer.links,
        }),
    }),
  /** FormData: name, city, description, links (JSON), logo (gambar maks 1 MB, opsional). */
  updateProfile: (form: FormData) =>
    api.patch<void>("/organizer/profile", normalizeLogo(form), { pending: false, mock: () => undefined }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>("/workspace/auth/password", { currentPassword, newPassword }, { pending: false, mock: () => undefined }),

  bankAccount: () =>
    api.get<{ data: BankAccount | null }>("/organizer/bank-account", { mock: () => wrap(FIX.bank) }),
  saveBankAccount: (input: BankAccount) =>
    api.put<{ data: BankAccount }>("/organizer/bank-account", input, { mock: () => wrap(input) }),

  payouts: () => api.get<{ data: PayoutOverview }>("/organizer/payouts", { mock: () => wrap(mockOverview) }),
  requestPayout: (eventId: string) =>
    api.post<void>("/organizer/payouts", { eventId }, { mock: () => undefined }),
};
