import { expect, test } from "@playwright/test";

const primaryDestinations = [
  "Knowledge",
  "Kandas",
  "Characters",
  "Journey",
  "Ask RamaVerse",
  "Sources",
];

test("mobile primary navigation exposes all destinations without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });

  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(nav).toBeVisible();

  for (const label of primaryDestinations) {
    await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
  }

  const overflow = await nav.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
