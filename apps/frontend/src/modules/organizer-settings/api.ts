import { api, ApiError, wrap } from "@/lib/api/client";
import { readMock, writeMock } from "@/modules/_mock/store";
import { mockChangePassword } from "@/modules/organizer-auth/mock-session";
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

export type BankAccount = {
  bank: string;
  accountNumber: string;
  holderName: string;
};

export type PayoutStatus =
  "waiting_event" | "available" | "requested" | "transferred";

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
        wrap(
          readMock("organizer-profile", {
            logoUrl: null,
            name: FIX.organizer.name,
            username: FIX.organizer.username,
            city: FIX.organizer.city,
            description: FIX.organizer.description,
            links: FIX.organizer.links,
          }),
        ),
    }),
  /** FormData: name, city, description, links (JSON), logo (gambar maks 1 MB, opsional). */
  updateProfile: (form: FormData) =>
    api.patch<void>("/organizer/profile", form, {
      ...pending,
      mock: async () => {
        const previous = (await organizerSettingsApi.profile()).data;
        const file = form.get("logo");
        let logoUrl =
          form.get("removeLogo") === "true" ? null : previous.logoUrl;
        if (file instanceof Blob && file.size) {
          if (!file.type.startsWith("image/") || file.size > 1024 * 1024)
            throw new ApiError(
              422,
              "VALIDATION_ERROR",
              "Logo harus berupa gambar maksimal 1 MB.",
            );
          logoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        writeMock("organizer-profile", {
          ...previous,
          name: String(form.get("name")),
          city: String(form.get("city")),
          description: String(form.get("description")),
          links: JSON.parse(String(form.get("links") ?? "[]")),
          logoUrl,
        });
      },
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<void>(
      "/workspace/auth/password",
      { currentPassword, newPassword },
      {
        ...pending,
        mock: () => mockChangePassword(newPassword, currentPassword),
      },
    ),

  bankAccount: () =>
    api.get<{ data: BankAccount | null }>("/organizer/bank-account", {
      ...pending,
      mock: () => wrap(readMock<BankAccount | null>("bank", FIX.bank)),
    }),
  saveBankAccount: (input: BankAccount) =>
    api.put<{ data: BankAccount }>("/organizer/bank-account", input, {
      ...pending,
      mock: () => {
        if (
          !/^\d{10,16}$/.test(input.accountNumber) ||
          !input.bank ||
          !input.holderName.trim()
        )
          throw new ApiError(
            422,
            "VALIDATION_ERROR",
            "Periksa kembali data rekening.",
          );
        return wrap(writeMock("bank", input));
      },
    }),

  payouts: () =>
    api.get<{ data: PayoutOverview }>("/organizer/payouts", {
      ...pending,
      mock: () => {
        const rows = readMock("payouts", mockOverview.rows);
        return wrap({
          rows,
          available: rows
            .filter((r) => r.status === "available")
            .reduce((n, r) => n + r.net, 0),
          processing: rows
            .filter((r) => r.status === "requested")
            .reduce((n, r) => n + r.net, 0),
          transferred: rows
            .filter((r) => r.status === "transferred")
            .reduce((n, r) => n + r.net, 0),
        });
      },
    }),
  requestPayout: (eventId: string, idempotencyKey?: string) =>
    api.post<void>(
      "/organizer/payouts",
      { eventId },
      {
        ...pending,
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
        mock: () => {
          if (!readMock<BankAccount | null>("bank", FIX.bank))
            throw new ApiError(
              422,
              "BANK_REQUIRED",
              "Tambahkan rekening pencairan terlebih dahulu.",
            );
          const rows = readMock("payouts", mockOverview.rows);
          const row = rows.find((r) => r.eventId === eventId);
          if (!row || row.status !== "available" || row.net <= 0)
            throw new ApiError(
              409,
              "PAYOUT_UNAVAILABLE",
              "Pendapatan acara belum dapat dicairkan.",
            );
          writeMock(
            "payouts",
            rows.map((r) =>
              r.eventId === eventId
                ? {
                    ...r,
                    status: "requested",
                    requestedAt: new Date().toISOString(),
                  }
                : r,
            ),
          );
        },
      },
    ),
};
