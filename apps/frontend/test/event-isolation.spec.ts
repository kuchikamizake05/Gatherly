import { test, expect } from "@playwright/test";
import { loginWorkspace } from "./workspace-login";

test("keeps event identity, duplicate inventory and order history separate", async ({
  page,
}) => {
  await loginWorkspace(page);
  await page.goto("/events/ev_keroncong");
  await expect(
    page.getByRole("heading", { name: "Keroncong di Pendopo", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tindakan acara", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Duplikat acara", exact: true })
    .click();
  await expect(page.getByLabel("Nama acara", { exact: true })).toHaveValue(
    "Keroncong di Pendopo (salinan)",
  );
  const id = new URL(page.url()).pathname.split("/")[2];
  expect(id).not.toBe("ev_keroncong");
  await page.goto(`/events/${id}`);
  await expect(
    page.getByRole("heading", {
      name: "Keroncong di Pendopo (salinan)",
      exact: true,
    }),
  ).toBeVisible();
  const sold = page
    .locator("div")
    .filter({ has: page.locator("p").filter({ hasText: /^Tiket terjual$/ }) })
    .filter({ has: page.locator("p").filter({ hasText: /^Dari 120 tiket$/ }) })
    .last();
  await expect(sold.locator("p").nth(1)).toHaveText("0");
  await page.goto(`/events/${id}/orders`);
  await expect(
    page.getByRole("heading", {
      name: "Tidak ada pesanan yang cocok",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /GTH-7Q4K/ })).toHaveCount(0);
});
