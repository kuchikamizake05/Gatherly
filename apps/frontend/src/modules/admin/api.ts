import { mockChange, mockRow, mockScenario } from "./mock-state";
import { adminAuthMock } from "./auth-mock";
import {
  ApiError,
  api,
  page,
  setCsrfToken,
  wrap,
  type Paginated,
} from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";
import type { Application, FieldFlag } from "@/modules/applications/api";

/**
 * Konsol admin (admin.<domain>). Pita desain 20, 21, 22, 24. Semua memakai API nyata:
 * login + 2FA (B30), pengajuan (B31), organizer (B32), pencairan (B39), laporan (B40).
 */

const pending = {} as const;
const base = "/admin";

export type AdminMe = {
  id: string;
  name: string;
  email: string;
  csrfToken: string;
};

export type ApplicationRow = Omit<
  (typeof FIX.applications)[number],
  "status"
> & { status: Application["status"] };
export type ApplicationTab = "new" | "needs_fix" | "approved" | "rejected";

export type ApplicationReview = Application & {
  previousValues?: Partial<Record<keyof Application, string>>;
  documents: {
    kind: "ktp" | "legal";
    fileName: string;
    size: number;
    uploadedAt: string;
    url: string;
  }[];
  checks: {
    emailVerified: boolean;
    usernameAvailable: boolean;
    similarOrganizers: number;
  };
  history: { action: string; by: string; at: string }[];
};

export type OrganizerTab = "active" | "never_logged_in" | "frozen";

export type OrganizerRow = {
  id: string;
  name: string;
  username: string;
  activeEvents: number;
  grossSales: number;
  status: "active" | "never_logged_in" | "frozen";
};

export type OrganizerDetail = OrganizerRow & {
  joinedAt: string;
  applicationNumber: string;
  completedEvents: number;
  totalEvents: number;
  pic: { name: string; role: string; email: string; phone: string };
  events: {
    id: string;
    title: string;
    startsAt: string | null;
    sold: number;
    capacity: number;
    status: string;
  }[];
  reportCount: number;
  activity: { action: string; at: string }[];
  frozenReason?: string | null;
};

export type AdminPayout =
  | (typeof FIX.adminPayouts)[number]
  | {
      id: string;
      number: string;
      organizerName: string;
      eventTitle: string;
      amount: number;
      requestedAt: string;
      bank: string;
      status: "transferred";
      transferReference: string;
      transferredAt: string;
    };

export type ReportReason = "fraud" | "wrong_info" | "inappropriate" | "other";
export type ReportRow = Omit<(typeof FIX.reports)[number], "status"> & {
  status: "new" | "done";
};
export type ReportDetail = ReportRow & {
  resolutionNote?: string | null;
  closedAt?: string | null;
  note: string;
  reporter: { email: string; isTicketHolder: boolean };
  event: { slug: string; title: string; startsAt: string; soldLabel: string };
  organizer: {
    id: string;
    name: string;
    username: string;
    recentReports: number;
  };
};

const reviewMock: ApplicationReview = {
  id: "app_0042",
  number: "PNG-2609-0042",
  status: "new",
  submittedAt: "2026-09-14T03:12:00Z",
  organizerName: FIX.organizer.name,
  organizerType: "komunitas",
  description:
    "Kolektif musik dan seni yang rutin menggelar konser di ruang terbuka di sekitar Yogyakarta sejak 2021.",
  address: {
    province: "DI Yogyakarta",
    city: "Kabupaten Sleman",
    street: "Jalan Kaliurang KM 5, Gang Sawah Nomor 12, Caturtunggal",
    postalCode: "55281",
  },
  links: FIX.organizer.links as Application["links"],
  pic: FIX.organizer.pic,
  username: FIX.organizer.username,
  ktp: {
    id: "doc_ktp",
    name: "ktp-rafi-pratama.jpg",
    size: 839_680,
    type: "image/jpeg",
  },
  legalDocument: null,
  flags: [],
  documents: [
    {
      kind: "ktp",
      fileName: "contoh-dokumen.svg",
      size: 839_680,
      uploadedAt: "2026-09-14T03:10:00Z",
      url: "/mock/admin-document.svg",
    },
  ],
  checks: {
    emailVerified: true,
    usernameAvailable: true,
    similarOrganizers: 1,
  },
  history: [
    {
      action: "Pengajuan dikirim",
      by: "Rafi Pratama",
      at: "2026-09-14T03:12:00Z",
    },
  ],
};

const organizerRows: OrganizerRow[] = [
  {
    id: FIX.organizer.id,
    name: FIX.organizer.name,
    username: FIX.organizer.username,
    activeEvents: 3,
    grossSales: 36250000,
    status: "active",
  },
  {
    id: "org_ukm",
    name: "UKM Musik UGM",
    username: "ukmmusikugm",
    activeEvents: 1,
    grossSales: 4800000,
    status: "never_logged_in",
  },
  {
    id: "org_runners",
    name: "Jogja Runners",
    username: "jogjarunners",
    activeEvents: 2,
    grossSales: 58900000,
    status: "active",
  },
  {
    id: "org_frozen",
    name: "Ruang Arsip Kota",
    username: "ruangarsipkota",
    activeEvents: 0,
    grossSales: 0,
    status: "frozen",
  },
];

function rowsFor<T extends { id: string }>(
  scope: string,
  rows: readonly T[],
): T[] {
  return mockScenario(scope) === "empty"
    ? []
    : rows.map((row) => mockRow(scope, row));
}
function findRow<T extends { id: string }>(
  scope: string,
  rows: readonly T[],
  id: string,
): T {
  const row = rowsFor(scope, rows).find((row) => row.id === id);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Data tidak ditemukan.");
  return row;
}
function counts<T extends { status: string }>(
  rows: T[],
  statuses: readonly string[],
) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      rows.filter((row) =>
        status === "new"
          ? ["new", "fix_submitted"].includes(row.status)
          : row.status === status,
      ).length,
    ]),
  );
}
function reviewFor(id: string): ApplicationReview {
  const row = findRow("applications", FIX.applications, id) as ApplicationRow;
  const corrected = row.status === "fix_submitted";
  return mockRow("applications", {
    ...reviewMock,
    ...row,
    organizerType:
      row.type === "Perusahaan"
        ? "perusahaan"
        : row.type === "Organisasi kampus"
          ? "organisasi_kampus"
          : "komunitas",
    username:
      id === "app_0042"
        ? FIX.organizer.username
        : row.organizerName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    legalDocument:
      row.type === "Komunitas"
        ? null
        : {
            id: "doc_legal",
            name: "contoh-legalitas.pdf",
            size: 1000,
            type: "application/pdf",
          },
    documents: [
      ...reviewMock.documents,
      ...(row.type === "Komunitas"
        ? []
        : [
            {
              kind: "legal" as const,
              fileName: "contoh-legalitas.pdf",
              size: 1000,
              uploadedAt: row.submittedAt,
              url: "/mock/legal-document.pdf",
            },
          ]),
    ],
    previousValues: corrected
      ? {
          description: "Komunitas musik kampus.",
          ktp: "Dokumen sebelumnya kurang jelas",
        }
      : undefined,
    checks: {
      ...reviewMock.checks,
      usernameAvailable: mockScenario("applications") !== "username_conflict",
    },
  } as ApplicationReview);
}
function changeApplication(id: string, change: Record<string, unknown>) {
  const data = reviewFor(id);
  if (
    !["new", "fix_submitted"].includes(data.status) ||
    mockScenario("applications") === "review_conflict"
  )
    throw new ApiError(
      409,
      "ALREADY_REVIEWED",
      "Pengajuan sudah ditinjau admin lain.",
    );
  if (change.status === "approved" && !data.checks.usernameAvailable)
    throw new ApiError(409, "USERNAME_TAKEN", "Username sudah dipakai.");
  mockChange("applications", id, change);
}

export const adminApi = {
  // B30
  login: (email: string, password: string) =>
    api.post<{ data: { challengeId: string } }>(
      `${base}/auth/login`,
      { email, password },
      { ...pending, mock: () => adminAuthMock.login(email, password) },
    ),
  verifyTotp: (challengeId: string, code: string, rememberDevice: boolean) =>
    api.post<{ data: AdminMe }>(
      `${base}/auth/totp`,
      { challengeId, code, rememberDevice },
      {
        ...pending,
        mock: () =>
          adminAuthMock.verify(challengeId, code, false, rememberDevice),
      },
    ),
  verifyBackupCode: (challengeId: string, code: string) =>
    api.post<{ data: AdminMe }>(
      `${base}/auth/backup-code`,
      { challengeId, code },
      {
        ...pending,
        mock: () => adminAuthMock.verify(challengeId, code, true),
      },
    ),
  async me(cookie?: string) {
    const res = await api.get<{ data: AdminMe }>(`${base}/auth/me`, {
      cookie,
      ...pending,
      mock: () => adminAuthMock.me(),
    });
    setCsrfToken(res.data.csrfToken);
    return res.data;
  },
  logout: () =>
    api.post<void>(`${base}/auth/logout`, undefined, {
      ...pending,
      mock: () => adminAuthMock.logout(),
    }),

  // B31
  applications: (
    params: {
      tab?: ApplicationTab;
      q?: string;
      type?: string;
      page?: number;
    } = {},
  ) =>
    api.get<
      Paginated<ApplicationRow> & { counts: Record<ApplicationTab, number> }
    >(`${base}/applications`, {
      query: params,
      ...pending,
      mock: () => {
        const rows = rowsFor<ApplicationRow>("applications", FIX.applications);
        return {
          ...page(rows),
          counts: counts(rows, [
            "new",
            "needs_fix",
            "approved",
            "rejected",
          ]) as Record<ApplicationTab, number>,
        };
      },
    }),
  application: (id: string) =>
    api.get<{ data: ApplicationReview }>(`${base}/applications/${id}`, {
      ...pending,
      mock: () => wrap(reviewFor(id)),
    }),
  approve: (id: string) =>
    api.post<void>(`${base}/applications/${id}/approve`, undefined, {
      ...pending,
      mock: () => changeApplication(id, { status: "approved" }),
    }),
  requestFix: (id: string, flags: FieldFlag[]) =>
    api.post<void>(
      `${base}/applications/${id}/request-fix`,
      { flags },
      {
        ...pending,
        mock: () => changeApplication(id, { status: "needs_fix", flags }),
      },
    ),
  reject: (id: string, reason: string) =>
    api.post<void>(
      `${base}/applications/${id}/reject`,
      { reason },
      {
        ...pending,
        mock: () =>
          changeApplication(id, {
            status: "rejected",
            rejectionReason: reason,
          }),
      },
    ),
  applicationsCsvUrl: () => `/api/v1${base}/applications.csv`,

  // B32
  organizers: (
    params: { tab?: OrganizerTab; q?: string; page?: number } = {},
  ) =>
    api.get<Paginated<OrganizerRow> & { counts: Record<OrganizerTab, number> }>(
      `${base}/organizers`,
      {
        query: params,
        ...pending,
        mock: () => {
          const rows = rowsFor("organizers", organizerRows);
          return {
            ...page(rows),
            counts: counts(rows, [
              "active",
              "never_logged_in",
              "frozen",
            ]) as Record<OrganizerTab, number>,
          };
        },
      },
    ),
  organizer: (id: string) =>
    api.get<{ data: OrganizerDetail }>(`${base}/organizers/${id}`, {
      ...pending,
      mock: () =>
        wrap(
          mockRow("organizers", {
            ...findRow("organizers", organizerRows, id),
            joinedAt: "2026-09-14T07:05:00Z",
            applicationNumber: "PNG-2609-0042",
            completedEvents: 2,
            totalEvents: 5,
            pic: FIX.organizer.pic,
            events: FIX.orgEvents.map((e) => ({
              id: e.id,
              title: e.title,
              startsAt: e.startsAt,
              sold: e.sold,
              capacity: e.capacity,
              status: e.status,
            })),
            reportCount: 0,
            activity: [
              {
                action: "Membuat acara Pameran Zine Jogja",
                at: "2026-11-15T09:40:00Z",
              },
              { action: "Menugaskan Dimas Satria", at: "2026-11-12T03:02:00Z" },
              {
                action: "Menerbitkan Festival Jazz di Sawah",
                at: "2026-09-28T02:15:00Z",
              },
              { action: "Masuk pertama kali", at: "2026-09-14T08:30:00Z" },
            ],
          }),
        ),
    }),
  freeze: (id: string, reason: string) =>
    api.post<void>(
      `${base}/organizers/${id}/freeze`,
      { reason },
      {
        ...pending,
        mock: () =>
          mockChange("organizers", id, {
            status: "frozen",
            frozenReason: reason,
          }),
      },
    ),
  unfreeze: (id: string) =>
    api.post<void>(`${base}/organizers/${id}/unfreeze`, undefined, {
      ...pending,
      mock: () =>
        mockChange("organizers", id, { status: "active", frozenReason: null }),
    }),
  resendAccess: (id: string) =>
    api.post<void>(`${base}/organizers/${id}/resend-access`, undefined, {
      ...pending,
      mock: () => undefined,
    }),

  // B39
  payouts: (
    params: { tab?: "requested" | "transferred"; page?: number } = {},
  ) =>
    api.get<
      Paginated<AdminPayout> & {
        counts: { requested: number; transferred: number };
      }
    >(`${base}/payouts`, {
      query: params,
      ...pending,
      mock: () => {
        const rows = rowsFor<AdminPayout>("payouts", FIX.adminPayouts);
        return {
          ...page(rows),
          counts: counts(rows, ["requested", "transferred"]) as {
            requested: number;
            transferred: number;
          },
        };
      },
    }),
  markTransferred: (id: string, reference: string, transferredAt: string) =>
    api.post<void>(
      `${base}/payouts/${id}/transferred`,
      { transferReference: reference, transferredAt },
      {
        ...pending,
        mock: () => {
          const row = findRow<AdminPayout>("payouts", FIX.adminPayouts, id);
          if (row.status !== "requested")
            throw new ApiError(
              409,
              "ALREADY_TRANSFERRED",
              "Pencairan sudah selesai.",
            );
          mockChange("payouts", id, {
            status: "transferred",
            transferReference: reference,
            transferredAt,
          });
        },
      },
    ),

  // B40
  reports: (params: { tab?: "new" | "done"; page?: number } = {}) =>
    api.get<Paginated<ReportRow> & { counts: { new: number; done: number } }>(
      `${base}/reports`,
      {
        query: params,
        ...pending,
        mock: () => {
          const rows = rowsFor<ReportRow>("reports", FIX.reports);
          return {
            ...page(rows),
            counts: counts(rows, ["new", "done"]) as {
              new: number;
              done: number;
            },
          };
        },
      },
    ),
  report: (id: string) =>
    api.get<{ data: ReportDetail }>(`${base}/reports/${id}`, {
      ...pending,
      mock: () =>
        wrap(
          mockRow("reports", {
            ...findRow("reports", FIX.reports, id),
            id,
            note: "Penyelenggara menghubungi lewat WhatsApp dan meminta transfer tambahan Rp50.000 untuk kursi depan.",
            reporter: { email: "bima.s@gmail.com", isTicketHolder: true },
            event: {
              slug:
                FIX.catalog.find(
                  (event) =>
                    event.title ===
                    findRow("reports", FIX.reports, id).eventTitle,
                )?.slug ?? FIX.festival.slug,
              title: findRow("reports", FIX.reports, id).eventTitle,
              startsAt:
                FIX.catalog.find(
                  (event) =>
                    event.title ===
                    findRow("reports", FIX.reports, id).eventTitle,
                )?.startsAt ?? FIX.festival.startsAt,
              soldLabel: "Dijual",
            },
            organizer: {
              id:
                id === "rp_3"
                  ? "org_runners"
                  : id === "rp_2"
                    ? "org_frozen"
                    : FIX.organizer.id,
              name: findRow("reports", FIX.reports, id).organizerName,
              username:
                id === "rp_3"
                  ? "jogjarunners"
                  : id === "rp_2"
                    ? "ruangarsipkota"
                    : FIX.organizer.username,
              recentReports: 2,
            },
          }),
        ),
    }),
  closeReport: (id: string, note: string) =>
    api.post<void>(
      `${base}/reports/${id}/close`,
      { note },
      {
        ...pending,
        mock: () => {
          const row = findRow<ReportRow>("reports", FIX.reports, id);
          if (row.status === "done")
            throw new ApiError(409, "ALREADY_CLOSED", "Laporan sudah ditutup.");
          mockChange("reports", id, { status: "done", resolutionNote: note });
        },
      },
    ),
};
