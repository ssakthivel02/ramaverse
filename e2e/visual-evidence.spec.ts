import { expect, test } from "@playwright/test";

const surfaces = [
  { path: "/", slug: "home", heading: /Walk the epic/i },
  { path: "/knowledge", slug: "knowledge", heading: "Knowledge" },
  { path: "/ask", slug: "ask", heading: "Ask RamaVerse" },
  { path: "/sources", slug: "sources", heading: "Sources" },
] as const;

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  for (const surface of surfaces) {
    test(`visual evidence ${viewport.name}: ${surface.path}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(surface.path, { waitUntil: "networkidle" });
      await expect(page.locator("main#main")).toBeVisible();
      await expect(page.locator("h1")).toContainText(surface.heading);

      await page.screenshot({
        path: `artifacts/visual/${viewport.name}-${surface.slug}.png`,
        fullPage: true,
        animations: "disabled",
        caret: "hide",
      });
    });
  }
}
