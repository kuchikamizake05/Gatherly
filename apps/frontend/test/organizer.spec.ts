import { loginWorkspace } from "./workspace-login";
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  editorSchema,
  emptyEditor,
  ticketErrors,
} from "../src/modules/organizer-events/editor-schema";
import {
  fromLocalInput,
  toLocalInput,
} from "../src/modules/organizer-events/date-input";
import { scanError } from "../src/modules/check-in/result";
import { resolveOffline } from "../src/modules/check-in/offline";

test.beforeEach(async ({ page }) => { await loginWorkspace(page); });

const base = "/events/ev_festival_jazz";
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await page.locator("body").innerText()).not.toContain("RouteStub");
}
test("validates inventory, timezone and offline boundaries", async () => {
  expect(fromLocalInput("2027-11-21T15:00", "Asia/Jakarta")).toBe(
    "2027-11-21T08:00:00.000Z",
  );
  expect(toLocalInput("2027-11-21T08:00:00Z", "Asia/Makassar")).toBe(
    "2027-11-21T16:00",
  );
  expect(editorSchema.safeParse(emptyEditor).success).toBe(false);
  expect(
    ticketErrors(
      {
        name: "Reguler",
        price: 100000,
        capacity: 117,
        salesStartsAt: "2027-11-01T10:00",
        salesEndsAt: "2027-11-20T10:00",
      },
      "2027-11-21T15:00",
      118,
    ),
  ).toContain("118");
  expect(scanError({ code: "NETWORK_ERROR" }).kind).toBe("network");
  expect(scanError({ code: "TICKET_ALREADY_USED" }).kind).toBe("used");
  await expect(
    resolveOffline(undefined, { ticketCode: "GTH-X" }, [], Date.now()),
  ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  await expect(
    resolveOffline(
      { tickets: [], qrHashes: [], generatedAt: new Date().toISOString() },
      { ticketCode: "GTH-X" },
      [],
      Date.now(),
    ),
  ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
});
test("validates the wizard and restores an autosaved draft", async ({
  page,
}, info) => {
  await page.goto("/events/new");
  await page.getByLabel("Nama acara", { exact: true }).fill("Acara uji Nasta");
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await expect(
    page.getByText("Poster wajib diunggah", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Draf tersimpan otomatis" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nama acara", { exact: true })).toHaveValue(
    "Acara uji Nasta",
  );
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("editor.png"),
    fullPage: true,
  });
});
test("creates a ticket and publishes through all five steps", async ({
  page,
}, info) => {
  await page.goto("/events/new");
  await page
    .getByLabel("Nama acara", { exact: true })
    .fill("Konser komunitas Nasta");
  await page.getByRole("button", { name: "Musik", exact: true }).click();
  await page
    .getByLabel("Deskripsi", { exact: true })
    .fill("Konser komunitas di Yogyakarta.");
  await page
    .getByLabel("Poster acara", { exact: true })
    .setInputFiles(path.resolve("public/icon-192.png"));
  await page
    .getByRole("button", { name: "Hapus berkas", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Simpan draf", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draf tersimpan otomatis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await page
    .getByLabel("Tanggal dan jam mulai", { exact: true })
    .fill("2027-12-01T15:00");
  await page
    .getByLabel("Tanggal dan jam selesai", { exact: true })
    .fill("2027-12-01T21:00");
  await page.getByLabel("Nama tempat", { exact: true }).fill("Ruang komunitas");
  await page.getByLabel("Provinsi", { exact: true }).click();
  await page.getByRole("option", { name: "DI Yogyakarta", exact: true }).click();
  await page.getByLabel("Kota atau kabupaten", { exact: true }).click();
  await page.getByRole("option", { name: "Kota Yogyakarta", exact: true }).click();
  await page
    .getByLabel("Alamat lengkap", { exact: true })
    .fill("Jalan Komunitas 12");
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await page
    .getByRole("button", { name: "Tambah jenis tiket", exact: true })
    .click();
  await page.getByLabel("Nama tiket", { exact: true }).fill("Reguler");
  await page.getByLabel("Harga", { exact: true }).fill("100000");
  await page.getByLabel("Kuota", { exact: true }).fill("20");
  await page
    .getByLabel("Mulai dijual", { exact: true })
    .fill("2027-11-01T10:00");
  await page
    .getByLabel("Akhir dijual", { exact: true })
    .fill("2027-11-30T23:00");
  await page.getByRole("button", { name: "Simpan tiket", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ubah Reguler", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await page
    .getByRole("button", { name: "Tambah ketentuan", exact: true })
    .click();
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await expect(
    page.getByText("Ketentuan tidak boleh kosong", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Ketentuan 1", { exact: true })
    .fill("Satu tiket untuk satu peserta.");
  await page.getByRole("button", { name: "Lanjut", exact: true }).click();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("review.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Terbitkan acara", exact: true })
    .click();
  await page.getByRole("button", { name: "Terbitkan", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Acara berhasil diterbitkan",
      exact: true,
    }),
  ).toBeVisible();
});
test("assigns and revokes a committee member without changing their account", async ({
  page,
}, info) => {
  await page.goto(`${base}/committee`);
  await page
    .getByRole("button", { name: "Tugaskan panitia", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox").nth(0)).toBeDisabled();
  await expect(dialog.getByRole("checkbox").nth(3)).toBeDisabled();
  await dialog.getByRole("checkbox").nth(2).check();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("assignment.png"),
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Tugaskan 1 panitia", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row").filter({ hasText: "Yoga Pradana" });
  if (await row.count())
    await row
      .getByRole("button", { name: "Cabut penugasan", exact: true })
      .click();
  else
    await page
      .getByText("Yoga Pradana", { exact: true })
      .locator("../..")
      .getByRole("button", { name: "Cabut penugasan", exact: true })
      .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cabut penugasan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Yoga Pradana", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Dimas Satria", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("Yoga Pradana", { exact: true })).toHaveCount(0);
});
test("manual check-in updates attendance and prevents a second admission", async ({
  page,
}, info) => {
  await page.goto(`${base}/scan`);
  await page.getByRole("button", { name: "Cari manual", exact: true }).click();
  await page
    .getByLabel("Nama atau kode tiket", { exact: true })
    .fill("Rafi Pratama");
  await page.getByRole("button", { name: "Tandai masuk", exact: true }).click();
  await page.getByRole("button", { name: "Tandai masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tiket valid", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("scanner-success.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cari manual", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Sudah masuk", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Tandai masuk", exact: true }),
  ).toHaveCount(0);
});
test("network failure never reports successful or invalid admission", async ({
  page,
  context,
}) => {
  await page.goto(`${base}/scan`);
  await page.getByRole("button", { name: "Cari manual", exact: true }).click();
  await page
    .getByLabel("Nama atau kode tiket", { exact: true })
    .fill("Rafi Pratama");
  await page.getByRole("button", { name: "Tandai masuk", exact: true }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Tandai masuk", exact: true }).click();
  await expect(
    page.getByText("Status tiket belum diketahui", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tiket valid", exact: true }),
  ).toHaveCount(0);
  await context.setOffline(false);
});
test("history shows scans from all members and filters rejected attempts", async ({
  page,
}, info) => {
  await page.goto(`${base}/scan/history`);
  await page.getByRole("tab", { name: "Ditolak", exact: true }).click();
  await expect(
    page
      .getByText("Kode tidak dikenali", { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("Bima Saputra", { exact: true })).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("history.png"),
    fullPage: true,
  });
});
