import { api, page, setCsrfToken, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";
import type { Application, FieldFlag } from "@/modules/applications/api";

/**
 * admin.gatherly.xyz. Pita desain 20, 21, 22, 24. Semua memakai API nyata:
 * login + 2FA (B30), pengajuan (B31), organizer (B32), pencairan (B39), laporan (B40).
 */

const base = "/admin";

export type AdminMe = { id: string; name: string; email: string; csrfToken: string };

export type ApplicationRow = (typeof FIX.applications)[number];
export type ApplicationTab = "new" | "needs_fix" | "approved" | "rejected";

export type ApplicationReview = Application & {
  documents: { kind: "ktp" | "legal"; fileName: string; size: number; uploadedAt: string; url: string }[];
  checks: { emailVerified: boolean; usernameAvailable: boolean; similarOrganizers: number };
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
  events: { id: string; title: string; startsAt: string; sold: number; capacity: number; status: string }[];
  reportCount: number;
  activity: { action: string; at: string }[];
  frozenReason?: string | null;
};

export type AdminPayout = (typeof FIX.adminPayouts)[number] | {
  id: string; number: string; organizerName: string; eventTitle: string; amount: number;
  requestedAt: string; bank: string; status: "transferred"; transferReference: string; transferredAt: string;
};

export type ReportReason = "fraud" | "wrong_info" | "inappropriate" | "other";
export type ReportRow = { id: string; eventTitle: string; organizerName: string; reason: ReportReason; createdAt: string; status: "new" | "done" };
export type ReportDetail = ReportRow & {
  note: string;
  resolutionNote?: string | null;
  closedAt?: string | null;
  reporter: { email: string; isTicketHolder: boolean };
  event: { slug: string; title: string; startsAt: string; soldLabel: string };
  organizer: { id: string; name: string; username: string; recentReports: number };
};

const reviewMock: ApplicationReview = {
  id: "app_0042",
  number: "PNG-2609-0042",
  status: "new",
  submittedAt: "2026-09-14T03:12:00Z",
  organizerName: FIX.organizer.name,
  organizerType: "komunitas",
  description: "Kolektif musik dan seni yang rutin menggelar konser di ruang terbuka di sekitar Yogyakarta sejak 2021.",
  address: { province: "DI Yogyakarta", city: "Kabupaten Sleman", street: "Jalan Kaliurang KM 5, Gang Sawah Nomor 12, Caturtunggal", postalCode: "55281" },
  links: FIX.organizer.links as Application["links"],
  pic: FIX.organizer.pic,
  username: FIX.organizer.username,
  ktp: { id: "doc_ktp", name: "ktp-rafi-pratama.jpg", size: 839_680, type: "image/jpeg" },
  legalDocument: null,
  flags: [],
  documents: [{ kind: "ktp", fileName: "ktp-rafi-pratama.jpg", size: 839_680, uploadedAt: "2026-09-14T03:10:00Z", url: "#" }],
  checks: { emailVerified: true, usernameAvailable: true, similarOrganizers: 1 },
  history: [{ action: "Pengajuan dikirim", by: "Rafi Pratama", at: "2026-09-14T03:12:00Z" }],
};

export const adminApi = {
  // B30
  login: (email: string, password: string) =>
    api.post<{ data: { challengeId: string } }>(`${base}/auth/login`, { email, password }, { pending: false, mock: () => wrap({ challengeId: "adm_ch" }) }),
  verifyTotp: (challengeId: string, code: string, rememberDevice: boolean) =>
    api.post<{ data: AdminMe }>(`${base}/auth/totp`, { challengeId, code, rememberDevice }, {
      pending: false,
      mock: () => wrap({ id: "adm_nadia", name: "Nadia", email: "nadia@gatherly.xyz", csrfToken: "mock-csrf" }),
    }),
  verifyBackupCode: (challengeId: string, code: string) =>
    api.post<{ data: AdminMe }>(`${base}/auth/backup-code`, { challengeId, code }, {
      pending: false,
      mock: () => wrap({ id: "adm_nadia", name: "Nadia", email: "nadia@gatherly.xyz", csrfToken: "mock-csrf" }),
    }),
  async me(cookie?: string) {
    const res = await api.get<{ data: AdminMe }>(`${base}/auth/me`, {
      cookie,
      pending: false,
      mock: () => wrap({ id: "adm_nadia", name: "Nadia", email: "nadia@gatherly.xyz", csrfToken: "mock-csrf" }),
    });
    setCsrfToken(res.data.csrfToken);
    return res.data;
  },
  logout: () => api.post<void>(`${base}/auth/logout`, undefined, { pending: false, mock: () => undefined }),

  // B31
  applications: (params: { tab?: ApplicationTab; q?: string; type?: string; page?: number } = {}) =>
    api.get<Paginated<ApplicationRow> & { counts: Record<ApplicationTab, number> }>(`${base}/applications`, {
      query: params,
      pending: false,
      mock: () => ({ ...page(FIX.applications), counts: { new: 5, needs_fix: 2, approved: 48, rejected: 7 } }),
    }),
  application: (id: string) =>
    api.get<{ data: ApplicationReview }>(`${base}/applications/${id}`, { pending: false, mock: () => wrap({ ...reviewMock, id }) }),
  approve: (id: string) => api.post<void>(`${base}/applications/${id}/approve`, undefined, { pending: false, mock: () => undefined }),
  requestFix: (id: string, flags: FieldFlag[]) =>
    api.post<void>(`${base}/applications/${id}/request-fix`, { flags }, { pending: false, mock: () => undefined }),
  reject: (id: string, reason: string) =>
    api.post<void>(`${base}/applications/${id}/reject`, { reason }, { pending: false, mock: () => undefined }),
  applicationsCsvUrl: () => `/api/v1${base}/applications.csv`,

  // B32
  organizers: (params: { tab?: OrganizerTab; q?: string; page?: number } = {}) =>
    api.get<Paginated<OrganizerRow> & { counts: Record<OrganizerTab, number> }>(`${base}/organizers`, {
      query: params,
      pending: false,
      mock: () => ({
        ...page<OrganizerRow>([
          { id: FIX.organizer.id, name: FIX.organizer.name, username: FIX.organizer.username, activeEvents: 3, grossSales: 36250000, status: "active" },
          { id: "org_ukm", name: "UKM Musik UGM", username: "ukmmusikugm", activeEvents: 1, grossSales: 4800000, status: "active" },
          { id: "org_runners", name: "Jogja Runners", username: "jogjarunners", activeEvents: 2, grossSales: 58900000, status: "active" },
        ]),
        counts: { active: 49, never_logged_in: 4, frozen: 3 },
      }),
    }),
  organizer: (id: string) =>
    api.get<{ data: OrganizerDetail }>(`${base}/organizers/${id}`, {
      pending: false,
      mock: () =>
        wrap({
          id, name: FIX.organizer.name, username: FIX.organizer.username, activeEvents: 3, grossSales: 36250000, status: "active" as const,
          joinedAt: "2026-09-14T07:05:00Z", applicationNumber: "PNG-2609-0042", completedEvents: 2, totalEvents: 5,
          pic: FIX.organizer.pic,
          events: FIX.orgEvents.filter((e) => e.startsAt).map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt!, sold: e.sold, capacity: e.capacity, status: e.status })),
          reportCount: 0,
          activity: [
            { action: "Membuat acara Pameran Zine Jogja", at: "2026-11-15T09:40:00Z" },
            { action: "Menugaskan Dimas Satria", at: "2026-11-12T03:02:00Z" },
            { action: "Menerbitkan Festival Jazz di Sawah", at: "2026-09-28T02:15:00Z" },
            { action: "Masuk pertama kali", at: "2026-09-14T08:30:00Z" },
          ],
        }),
    }),
  freeze: (id: string, reason: string) => api.post<void>(`${base}/organizers/${id}/freeze`, { reason }, { pending: false, mock: () => undefined }),
  unfreeze: (id: string) => api.post<void>(`${base}/organizers/${id}/unfreeze`, undefined, { pending: false, mock: () => undefined }),
  resendAccess: (id: string) => api.post<void>(`${base}/organizers/${id}/resend-access`, undefined, { pending: false, mock: () => undefined }),

  // B39
  payouts: (params: { tab?: "requested" | "transferred"; page?: number } = {}) =>
    api.get<Paginated<AdminPayout> & { counts: { requested: number; transferred: number } }>(`${base}/payouts`, {
      query: params,
      mock: () => ({ ...page<AdminPayout>(FIX.adminPayouts), counts: { requested: 2, transferred: 14 } }),
    }),
  markTransferred: (id: string, reference: string, transferredAt: string) =>
    api.post<void>(`${base}/payouts/${id}/transferred`, { transferReference: reference, transferredAt }, { mock: () => undefined }),

  // B40
  reports: (params: { tab?: "new" | "done"; page?: number } = {}) =>
    api.get<Paginated<ReportRow> & { counts: { new: number; done: number } }>(`${base}/reports`, {
      query: params,
      mock: () => ({ ...page(FIX.reports), counts: { new: 3, done: 21 } }),
    }),
  report: (id: string) =>
    api.get<{ data: ReportDetail }>(`${base}/reports/${id}`, {
      mock: () =>
        wrap({
          ...FIX.reports[0]!,
          id,
          note: "Penyelenggara menghubungi lewat WhatsApp dan meminta transfer tambahan Rp50.000 untuk kursi depan.",
          reporter: { email: "bima.s@gmail.com", isTicketHolder: true },
          event: { slug: FIX.festival.slug, title: FIX.festival.title, startsAt: FIX.festival.startsAt, soldLabel: "Dijual, 168 dari 250" },
          organizer: { id: FIX.organizer.id, name: FIX.organizer.name, username: FIX.organizer.username, recentReports: 2 },
        }),
    }),
  closeReport: (id: string, note: string) =>
    api.post<void>(`${base}/reports/${id}/close`, { note }, { mock: () => undefined }),
};
