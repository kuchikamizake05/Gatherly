import { expect, type Page } from "@playwright/test";
export async function loginWorkspace(
  page: Page,
  username = "kolektifsawah",
  password = "GatherlyDemo2026!",
) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name:
        username === "kolektifsawah" ? "Dashboard" : "Acara yang ditugaskan",
      exact: true,
    }),
  ).toBeVisible();
}
