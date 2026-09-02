import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const routes = JSON.parse(
  readFileSync(new URL("../src/data/routes.json", import.meta.url), "utf8"),
) as Array<{ path: string; label: string }>;

test.describe("RamaVerse deep-link and interaction contract", () => {
  for (const route of routes) {
    test(`direct route renders: ${route.path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(route.path, { waitUntil: "networkidle" });
      await expect(page.locator("main#main")).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page).toHaveTitle(new RegExp(`${route.label}.*RamaVerse`, "i"));
      expect(errors).toEqual([]);
    });
  }

  test("primary knowledge navigation changes route without reload", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Enter Knowledge" }).click();
    await expect(page).toHaveURL(/\/knowledge$/);
    await expect(page.getByRole("heading", { level: 1, name: "Knowledge" })).toBeVisible();
  });

  test("safe search filters experience routes and navigates", async ({ page }) => {
    await page.goto("/search");
    const input = page.getByPlaceholder(/Try: graph, audio, stories, sources/i);
    await input.fill("audio");
    const audio = page.getByRole("button", { name: /Audio/i }).first();
    await expect(audio).toBeVisible();
    await audio.click();
    await expect(page).toHaveURL(/\/audio$/);
  });

  test("Ask RamaVerse refuses fabrication while canonical data is gated", async ({ page }) => {
    await page.goto("/ask");
    await page.getByLabel("Your question").fill("What does this episode mean?");
    await page.getByRole("button", { name: "Check source-backed availability" }).click();
    const status = page.getByRole("status").filter({ hasText: "RamaVerse response boundary" });
    await expect(status).toContainText("not sent to an external model");
  });

  test("reduced-motion preference disables transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page.locator(".route-card").first().evaluate((node) =>
      getComputedStyle(node).transitionDuration,
    );
    expect(duration).toBe("0s");
  });

  test("mobile layouts do not create document-level horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/knowledge", "/ask", "/sources"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    }
  });
});
