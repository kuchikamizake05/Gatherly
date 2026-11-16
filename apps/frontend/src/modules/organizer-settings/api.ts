import { api, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Profil organizer dan Pengaturan (Rekening pencairan, Keamanan). Pita desain 23.
 * Semua pending: profil dan password (B38), rekening dan pencairan (B39).
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
  /** Pendapatan bersih setelah biaya layanan 5%. */
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

const pending = { pending: true } as const;

const mockOverview: PayoutOverview = {
  available: 14962500,
  processing: 0,
  transferred: 0,
  rows: FIX.payouts.map((p) => ({ ...p })),
};

export const organizerSettingsApi = {
  profile: () =>
    api.get<{ data: OrganizerProfileSettings }>("/organizer/profile", {
      ...pending,
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
    api.patch<void>("/organizer/profile", form, { ...pending, mock: () => undefined }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>("/workspace/auth/password", { currentPassword, newPassword }, { ...pending, mock: () => undefined }),

  bankAccount: () =>
    api.get<{ data: BankAccount | null }>("/organizer/bank-account", { ...pending, mock: () => wrap(FIX.bank) }),
  saveBankAccount: (input: BankAccount) =>
    api.put<{ data: BankAccount }>("/organizer/bank-account", input, { ...pending, mock: () => wrap(input) }),

  payouts: () => api.get<{ data: PayoutOverview }>("/organizer/payouts", { ...pending, mock: () => wrap(mockOverview) }),
  requestPayout: (eventId: string) =>
    api.post<void>("/organizer/payouts", { eventId }, { ...pending, mock: () => undefined }),
};
