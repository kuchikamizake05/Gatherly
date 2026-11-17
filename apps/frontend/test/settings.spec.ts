import { test, expect } from "@playwright/test";
import { loginWorkspace } from "./workspace-login";

test("saves profile with existing social and email links and restores it", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/profile");
  await page
    .getByLabel("Nama organizer", { exact: true })
    .fill("Kolektif Uji Nasta");
  await page
    .getByRole("button", { name: "Simpan profil", exact: true })
    .click();
  await expect(
    page.getByText("Profil organizer disimpan", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nama organizer", { exact: true })).toHaveValue(
    "Kolektif Uji Nasta",
  );
  await expect(page.getByLabel("Username", { exact: true })).not.toBeEditable();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("changes password only after checking current password and confirmation", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/settings/security");
  await page.getByLabel("Password saat ini", { exact: true }).fill("incorrect");
  await page
    .getByLabel("Password baru", { exact: true })
    .fill("NewOrganizerPassword2026!");
  await page
    .getByLabel("Konfirmasi password baru", { exact: true })
    .fill("NewOrganizerPassword2026!");
  await page
    .getByRole("button", { name: "Simpan password", exact: true })
    .click();
  await expect(
    page.getByText("Password saat ini tidak cocok.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Password saat ini", { exact: true })
    .fill("GatherlyDemo2026!");
  await page
    .getByRole("button", { name: "Simpan password", exact: true })
    .click();
  await expect(
    page.getByText("Password berhasil diubah", { exact: true }),
  ).toBeVisible();
  await loginWorkspace(page, "kolektifsawah", "NewOrganizerPassword2026!");
});
test("deactivation revokes assignments while preserving the member for reactivation", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/settings/team");
  await page
    .getByRole("button", { name: "Tindakan Dimas Satria", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Nonaktifkan", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lanjutkan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Tindakan Dimas Satria", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Aktifkan", exact: true }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Aktifkan", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lanjutkan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/events/ev_festival_jazz/committee");
  await expect(
    page.getByText("Dimas Satria", { exact: true }).filter({ visible: true }),
  ).toHaveCount(0);
});
test("locks repeated incorrect logins and rejects inactive accounts", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("laras.sawah");
  await page.getByLabel("Password", { exact: true }).fill("GatherlyDemo2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByText("Akun Anda dinonaktifkan. Hubungi organizer.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Username", { exact: true }).fill("kolektifsawah");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Masuk", exact: true }),
    ).toBeEnabled();
  }
  await expect(
    page.getByText("Terlalu banyak percobaan. Coba lagi dalam 10 menit.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("GatherlyDemo2026!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByText("Terlalu banyak percobaan. Coba lagi dalam 10 menit.", {
      exact: true,
    }),
  ).toBeVisible();
});
