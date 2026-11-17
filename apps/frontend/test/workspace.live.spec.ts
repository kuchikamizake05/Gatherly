import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { FIX } from "../src/modules/_mock/fixtures";

// Intercept HTTP at the server boundary. The app is a production build with mock disabled.
async function backend(
  page: Page,
  scenario:
    "ready" | "missing" | "expired" | "malformed" | "html" | "refund" = "ready",
) {
  const requests: {
    path: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  }[] = [];
  let stopped = false;
  let refunded = false;
  let refunds = 0;
  const event = {
    ...FIX.festival,
    id: FIX.festival.id,
    slug: FIX.festival.slug,
    posterUrl: FIX.festival.poster,
    posterAssetId: "asset_festival",
    publicationStatus: "published",
    status: "on_sale",
    salesClosed: false,
    locationType: "offline",
    updatedAt: "2026-11-17T00:00:00Z",
    ticketTypes: FIX.festival.ticketTypes.map((ticket) => ({
      ...ticket,
      reserved: 0,
      salesStopped: false,
    })),
  };
  const me = {
    role: "organizer",
    name: "Rafi Pratama",
    username: "kolektifsawah",
    mustChangePassword: false,
    organizer: {
      id: FIX.organizer.id,
      name: FIX.organizer.name,
      username: FIX.organizer.username,
      frozen: false,
    },
    csrfToken: "server-issued-csrf",
  };
  const order = {
    id: "o1",
    orderCode: "GTH-7Q4K",
    buyer: { name: "Galih Prasetyo", email: "galih@example.test" },
    ticketType: { name: "Reguler", unitPrice: 100000 },
    quantity: 2,
    totalAmount: 200000,
    paymentStatus: "paid",
    createdAt: "2026-11-14T03:12:00Z",
    paidAt: "2026-11-14T03:12:00Z",
    unitPrice: 100000,
    attendees: [{ name: "Galih Prasetyo" }],
    timeline: [{ status: "paid", at: "2026-11-14T03:12:00Z" }],
    tickets: [
      {
        id: "t1",
        ticketCode: "GTH-7Q4K-29XM",
        attendeeName: "Galih Prasetyo",
        checkInStatus: "unused",
        checkedInAt: null,
      },
      {
        id: "t2",
        ticketCode: "GTH-7Q4K-31PL",
        attendeeName: "Sekar Ayu",
        checkInStatus: "unused",
        checkedInAt: null,
      },
    ],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const headers = await request.allHeaders();
    const method = request.method();
    requests.push({
      path,
      method,
      headers,
      body:
        headers["content-type"]?.includes("application/json") &&
        request.postData()
          ? request.postDataJSON()
          : undefined,
    });
    const json = (
      body: unknown,
      status = 200,
      extra: Record<string, string> = {},
    ) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: extra,
        body: JSON.stringify(body),
      });
    if (path === "/workspace/auth/login") {
      if (scenario === "missing")
        return json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Layanan login belum tersedia.",
            },
          },
          404,
        );
      if (scenario === "html")
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html>upstream error</html>",
        });
      return json({ data: me }, 200, {
        "set-cookie":
          "gatherly_workspace=server-session; Path=/; HttpOnly; SameSite=Lax",
      });
    }
    if (!headers.cookie?.includes("gatherly_workspace=server-session"))
      return json(
        { error: { code: "UNAUTHENTICATED", message: "Sesi berakhir." } },
        401,
      );
    if (path === "/workspace/auth/me") return json({ data: me });
    if (path === "/organizer/posters")
      return json({
        data: { assetId: "server_asset", url: FIX.festival.poster },
      });
    if (path === "/committee/events")
      return json({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    if (path.startsWith("/committee/events/") && path.endsWith("/tickets"))
      return json({
        data: [
          {
            ticketId: "t1",
            ticketCode: "GTH-LIVE-TEST",
            attendeeName: "Peserta Uji",
            ticketTypeName: "Reguler",
            checkInStatus: "unused",
            checkedInAt: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      });
    if (path.startsWith("/committee/events/") && path.endsWith("/check-ins"))
      return method === "POST"
        ? json({ data: {} })
        : json({
            data: [],
            meta: {
              page: 1,
              limit: 20,
              total: 0,
              paidTickets: 1,
              generatedAt: "2026-11-17T00:00:00Z",
            },
          });
    if (path === "/organizer/summary")
      return json({
        data: {
          publishedEvents: 1,
          paidTickets: 168,
          grossPaidSales: 16800000,
          generatedAt: "2026-11-17T00:00:00Z",
          period: { from: null, to: null, basis: "paidAt" },
        },
      });
    if (path === "/organizer/events")
      return json(
        scenario === "malformed"
          ? { data: [{ id: "broken", title: "Broken event" }] }
          : {
              data: [FIX.orgEvents[0]],
              meta: { page: 1, limit: 20, total: 1 },
            },
      );
    if (path === `/organizer/events/${event.id}`)
      return json({
        data: {
          ...event,
          ticketTypes: event.ticketTypes.map((ticket, index) => ({
            ...ticket,
            salesStopped: index === 0 && stopped,
          })),
        },
      });
    if (path.endsWith("/stop")) {
      if (scenario === "expired")
        return json(
          { error: { code: "UNAUTHENTICATED", message: "Sesi berakhir." } },
          401,
        );
      if (headers["x-csrf-token"] !== me.csrfToken)
        return json(
          { error: { code: "CSRF_INVALID", message: "CSRF invalid" } },
          403,
        );
      stopped = true;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/refunds")) {
      refunds++;
      if (refunds === 1)
        return json(
          {
            error: {
              code: "PROVIDER_UNAVAILABLE",
              message: "internal provider stack must not be shown",
            },
          },
          503,
        );
      refunded = true;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/orders/o1"))
      return json({
        data: {
          ...order,
          paymentStatus: refunded ? "partially_refunded" : "paid",
          tickets: order.tickets.map((ticket, index) =>
            refunded && index === 0
              ? { ...ticket, checkInStatus: "cancelled" }
              : ticket,
          ),
        },
      });
    if (path.endsWith("/orders"))
      return json({
        data: [
          { ...order, paymentStatus: refunded ? "partially_refunded" : "paid" },
        ],
        meta: { page: 1, limit: 20, total: 1 },
      });
    return json(
      { error: { code: "NOT_FOUND", message: "Endpoint unavailable" } },
      404,
    );
  });
  return requests;
}
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("kolektifsawah");
  await page
    .getByLabel("Password", { exact: true })
    .fill("ServerPassword2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test("never authenticates with a pending mock when the real login endpoint is missing", async ({
  page,
}) => {
  const requests = await backend(page, "missing");
  await signIn(page);
  await expect(
    page.getByText("Layanan login belum tersedia.", { exact: true }),
  ).toBeVisible();
  expect(
    requests.some((request) => request.path === "/workspace/auth/login"),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("gatherly.mock.workspace-session"),
    ),
  ).toBeNull();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
});
test("uses an HttpOnly server session and CSRF token for a real mutation", async ({
  page,
  context,
}) => {
  const requests = await backend(page);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Mode contoh/)).toHaveCount(0);
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "gatherly_workspace",
    )?.httpOnly,
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "server-session",
  );
  await page.goto(`/events/${FIX.festival.id}/tickets`);
  await page
    .getByRole("button", { name: "Hentikan penjualan", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hentikan penjualan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page
      .getByRole("button", { name: "Lanjutkan penjualan", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  expect(
    requests.find((request) => request.path.endsWith("/stop"))?.headers[
      "x-csrf-token"
    ],
  ).toBe("server-issued-csrf");
});
test("redirects on session expiry instead of leaving private workspace data visible", async ({
  page,
}) => {
  await backend(page, "expired");
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto(`/events/${FIX.festival.id}/tickets`);
  await page
    .getByRole("button", { name: "Hentikan penjualan", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hentikan penjualan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Masuk ke ruang organizer",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: FIX.festival.title, exact: true }),
  ).toHaveCount(0);
});
test("rejects incomplete API data before it reaches workspace rendering", async ({
  page,
}) => {
  await backend(page, "malformed");
  await signIn(page);
  await expect(
    page.getByText(
      "Data dari layanan belum lengkap atau belum dapat ditampilkan. Silakan coba lagi beberapa saat lagi.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText("Broken event", { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("rejects a proxy HTML success response and applies document protections", async ({
  page,
}) => {
  await backend(page, "html");
  const response = await page.goto("/login");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["permissions-policy"]).toContain("camera=(self)");
  await page.getByLabel("Username", { exact: true }).fill("kolektifsawah");
  await page
    .getByLabel("Password", { exact: true })
    .fill("ServerPassword2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByText(
      "Respons layanan belum dapat dibaca. Silakan coba lagi atau hubungi bantuan.",
      { exact: true },
    ),
  ).toBeVisible();
});
test("normalizes backend order snapshots and preserves the refund idempotency key on retry", async ({
  page,
}) => {
  const requests = await backend(page, "refund");
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto(`/events/${FIX.festival.id}/orders`);
  await expect(
    page.getByText(/2 × Reguler/).filter({ visible: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /GTH-7Q4K/ })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Kembalikan dana", exact: true })
    .click();
  const dialog = page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", { name: "Kembalikan dana pesanan?" }),
    });
  await dialog.getByLabel("Jenis pengembalian").click();
  await page.getByRole("option", { name: "Sebagian tiket" }).click();
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByLabel("Alasan pengembalian").fill("Peserta berhalangan");
  const confirm = dialog.getByRole("button", {
    name: "Kembalikan Rp100.000",
    exact: true,
  });
  await confirm.click();
  await expect(
    dialog.getByText(
      "Layanan sedang bermasalah. Silakan coba lagi beberapa saat lagi.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/internal provider stack/)).toHaveCount(0);
  await confirm.click();
  await expect(dialog).toBeHidden();
  const attempts = requests.filter((request) =>
    request.path.endsWith("/refunds"),
  );
  expect(attempts).toHaveLength(2);
  expect(attempts[0].headers["idempotency-key"]).toBeTruthy();
  expect(attempts[1].headers["idempotency-key"]).toBe(
    attempts[0].headers["idempotency-key"],
  );
  expect(attempts[1].headers["x-csrf-token"]).toBe("server-issued-csrf");
});

test("uploads a poster over multipart HTTP with the session CSRF token", async ({
  page,
}) => {
  const requests = await backend(page);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto("/events/new");
  await page
    .getByLabel("Poster acara", { exact: true })
    .setInputFiles(path.resolve("public/icon-192.png"));
  await expect(
    page.getByRole("button", { name: "Hapus berkas", exact: true }),
  ).toBeVisible();
  const request = requests.find((item) => item.path === "/organizer/posters");
  expect(request?.headers["content-type"]).toContain(
    "multipart/form-data; boundary=",
  );
  expect(request?.headers["x-csrf-token"]).toBe("server-issued-csrf");
});

test("never admits a ticket when a successful HTTP response lacks check-in confirmation", async ({
  page,
}) => {
  await backend(page);
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await page.goto(`/events/${FIX.festival.id}/scan`);
  await page.getByRole("button", { name: "Cari manual", exact: true }).click();
  await page
    .getByLabel("Nama atau kode tiket", { exact: true })
    .fill("Peserta Uji");
  await page.getByRole("button", { name: "Tandai masuk", exact: true }).click();
  await page.getByRole("button", { name: "Tandai masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Status tiket belum diketahui",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tiket valid", exact: true }),
  ).toHaveCount(0);
});
