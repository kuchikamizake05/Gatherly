import { test, expect, type Page } from "@playwright/test";
import { loginWorkspace } from "./workspace-login";
import { csvCell } from "../src/modules/organizer-events/csv";
import { workspaceReturnTo } from "../src/modules/organizer-auth/components/LoginForm";

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("rejects invalid credentials, unsafe destinations and expired reset links", async ({
  page,
}) => {
  for (const value of ["//evil.test", "/\\evil.test", "/login?returnTo=/"])
    expect(workspaceReturnTo(value)).toBe("/");
  expect(csvCell(' =HYPERLINK("https://evil.test")')).toContain("' =HYPERLINK");
  await page.goto("/events");
  await expect(
    page.getByRole("heading", { name: "Masuk ke ruang organizer" }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("kolektifsawah");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByText("Username atau password tidak cocok.", { exact: true }),
  ).toBeVisible();
  await page.goto("/reset-password?token=expired");
  await page
    .getByLabel("Password baru", { exact: true })
    .fill("AnotherPassword2026!");
  await page
    .getByLabel("Konfirmasi password baru", { exact: true })
    .fill("AnotherPassword2026!");
  await page
    .getByRole("button", { name: "Simpan password", exact: true })
    .click();
  await expect(
    page.getByText("Tautan tidak valid atau kedaluwarsa. Minta tautan baru.", {
      exact: true,
    }),
  ).toBeVisible();
  await noOverflow(page);
});
test("creates a committee account and requires its first password change", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/settings/team");
  await page
    .getByRole("button", { name: "Tambah anggota", exact: true })
    .click();
  await page.getByLabel("Nama lengkap", { exact: true }).fill("Panitia Uji");
  await page.getByLabel("Username", { exact: true }).fill("panitia.uji");
  await page.getByLabel("Festival Jazz di Sawah", { exact: true }).check();
  await page
    .getByRole("button", { name: "Buat akun panitia", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Simpan kredensial anggota" }),
  ).toBeVisible();
  const password = await dialog.locator("dd.font-mono").innerText();
  await dialog.getByRole("button", { name: "Saya sudah menyimpannya" }).click();
  await expect(
    page.getByText("Panitia Uji", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain(password);
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("panitia.uji");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Buat password Anda" }),
  ).toBeVisible();
  await page
    .getByLabel("Password baru", { exact: true })
    .fill("PanitiaNewPassword2026!");
  await page
    .getByLabel("Konfirmasi password baru", { exact: true })
    .fill("different");
  await page
    .getByRole("button", { name: "Simpan password", exact: true })
    .click();
  await expect(
    page.getByText("Konfirmasi password tidak cocok", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Konfirmasi password baru", { exact: true })
    .fill("PanitiaNewPassword2026!");
  await page
    .getByRole("button", { name: "Simpan password", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Acara yang ditugaskan" }),
  ).toBeVisible();
  await page.goto("/settings/team");
  await expect(
    page.getByRole("heading", { name: "Acara yang ditugaskan" }),
  ).toBeVisible();
  await noOverflow(page);
});
test("saves a bank account, masks it and requests an available payout once", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/settings/payout");
  await page.getByRole("button", { name: "Ubah rekening" }).click();
  await page.getByLabel("Nomor rekening", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Simpan rekening" }).click();
  await expect(
    page.getByText("Nomor rekening harus terdiri dari 10–16 angka", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Nomor rekening", { exact: true }).fill("123456789012");
  await page.getByRole("button", { name: "Simpan rekening" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("BCA •••• 9012", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("123456789012");
  await page
    .getByRole("button", { name: "Ajukan pencairan", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ajukan pencairan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText("Diproses", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ajukan pencairan", exact: true }),
  ).toHaveCount(0);
  await noOverflow(page);
});
test("refunds one ticket and exports the filtered attendees", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/events/ev_festival_jazz/orders");
  await page
    .getByRole("button", { name: /GTH-7Q4K/ })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Kembalikan dana", exact: true })
    .click();
  const refund = page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", { name: "Kembalikan dana pesanan?" }),
    });
  await refund.getByLabel("Jenis pengembalian").click();
  await page.getByRole("option", { name: "Sebagian tiket" }).click();
  await refund.getByRole("checkbox").first().check();
  await refund
    .getByLabel("Alasan pengembalian")
    .fill("Peserta berhalangan hadir");
  await refund
    .getByRole("button", { name: "Kembalikan Rp100.000", exact: true })
    .click();
  await expect(refund).toBeHidden();
  await page.keyboard.press("Escape");
  await page.goto("/events/ev_festival_jazz/attendees");
  await page.getByLabel("Status check-in", { exact: true }).click();
  await page.getByRole("option", { name: "Dibatalkan" }).click();
  await expect(
    page.getByText("Galih Prasetyo", { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sekar Ayu", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "peserta-ev_festival_jazz.csv",
  );
  await noOverflow(page);
});
test("stops ticket sales and requires an exact event name before cancellation", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/events/ev_festival_jazz/tickets");
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
  await page
    .getByRole("button", { name: "Tindakan acara", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Batalkan acara", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Alasan pembatalan").fill("Cuaca tidak mendukung");
  const confirm = dialog.getByRole("button", {
    name: "Batalkan acara",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByPlaceholder("Festival Jazz di Sawah", { exact: true })
    .fill("Festival Jazz di Sawah");
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Acara dibatalkan", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "Lanjutkan penjualan", exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeDisabled();
  await noOverflow(page);
});
