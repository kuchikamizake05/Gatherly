import { loginWorkspace } from "./workspace-login";
import { test, expect, type Page } from "@playwright/test";
import QRCode from "qrcode";

test.beforeEach(async ({ page }) => { await loginWorkspace(page); });

async function cameraWithQr(page: Page, payload: string) {
  const image = await QRCode.toDataURL(payload, { width: 320, margin: 3 });
  await page.addInitScript(
    ({ image }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 640;
      const context = canvas.getContext("2d")!;
      const qr = new Image();
      qr.src = image;
      const draw = () => {
        context.fillStyle = "white";
        context.fillRect(0, 0, 640, 640);
        if (qr.complete) context.drawImage(qr, 160, 160, 320, 320);
      };
      setInterval(draw, 100);
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            draw();
            return canvas.captureStream(10);
          },
          enumerateDevices: async () => [],
        },
      });
    },
    { image },
  );
}

test("decodes a camera QR and admits the matching mock ticket", async ({
  page,
}) => {
  await cameraWithQr(page, "gatherly:v1:mock-GTH-4A7N-29XM");
  await page.goto("/events/ev_festival_jazz/scan");
  await expect(
    page.getByRole("heading", { name: "Tiket valid", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Aulia Nur Fajri", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});

test("treats a QR URL as data and never navigates to it", async ({ page }) => {
  await cameraWithQr(page, "https://example.com/untrusted-qr");
  await page.goto("/events/ev_festival_jazz/scan");
  await expect(
    page.getByRole("heading", {
      name: "Kode tiket tidak dikenali",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/events\/ev_festival_jazz\/scan$/);
});
