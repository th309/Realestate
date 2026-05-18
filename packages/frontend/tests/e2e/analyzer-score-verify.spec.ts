/**
 * VISIBLE end-to-end: confirms B&H AND F&F both render their grading panels
 * AND their strategy-appropriate upgrade-path panels.
 */
import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function fillCore(page: Page) {
  await page.locator("input[placeholder='350,000']").first().fill("350000");
  await page.waitForTimeout(300);
  await page
    .getByLabel(/Monthly Rent/i)
    .first()
    .fill("2800");
  await page.waitForTimeout(300);
  await page
    .getByLabel(/Tax \(annual\)/i)
    .first()
    .fill("6000");
  await page.waitForTimeout(300);
  await page
    .getByLabel(/Insurance \(annual\)/i)
    .first()
    .fill("1800");
  await page.waitForTimeout(800);
}

test("VISIBLE: B&H grading + upgrade-path", async ({ page }) => {
  await page.goto("/analyzer");
  await page.locator("[data-input-panel]").first().waitFor({ timeout: 30_000 });
  await fillCore(page);

  await page
    .locator("[data-grading-result-panel]")
    .waitFor({ timeout: 30_000 });

  const grade = await page
    .locator("[data-grading-result-panel] [data-grade]")
    .first()
    .getAttribute("data-grade");
  console.log(`\n>>> B&H GRADE: ${grade} <<<\n`);

  // B&H upgrade-path panel should render (not F&F variant)
  if (grade !== "A") {
    await expect(page.locator("[data-upgrade-path-panel]")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-flip-upgrade-path-panel]")).toHaveCount(0);
  }
  await page.screenshot({
    path: "test-results/visible-bh-score.png",
    fullPage: true,
  });
  await page.waitForTimeout(1500);
  expect(grade).toMatch(/^[A-F]$/);
});

test("VISIBLE: F&F grading + F&F-native upgrade-path", async ({ page }) => {
  const flipResponses: Array<{ url: string; status: number }> = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/analyzer/")) {
      flipResponses.push({ url: r.url(), status: r.status() });
    }
  });

  await page.goto("/analyzer");
  await page.locator("[data-input-panel]").first().waitFor({ timeout: 30_000 });
  await fillCore(page);

  // Switch to Fix & Flip strategy
  const flipChip = page
    .locator("[data-input-panel] button")
    .filter({ hasText: /^Fix\s*&\s*Flip$/ })
    .first();
  await flipChip.click();
  await page.waitForTimeout(500);

  // Fill F&F-only inputs that become visible in flip mode
  // Rehab Budget defaults to 45000 in useAnalyzerState; no need to refill.
  await page.locator("input[placeholder='395,000']").first().fill("520000");
  await page.waitForTimeout(4000); // longer wait for grade-flip API + render

  console.log("---- responses so far ----");
  for (const r of flipResponses) console.log(`[${r.status}] ${r.url}`);

  const panelVisible = await page
    .locator("[data-grading-result-panel]")
    .isVisible()
    .catch(() => false);
  console.log("grading panel visible:", panelVisible);

  if (!panelVisible) {
    const arvVal = await page
      .locator("input[placeholder='395,000']")
      .first()
      .inputValue()
      .catch(() => "?");
    console.log("ARV input value after fill:", arvVal);
    await page.screenshot({
      path: "test-results/ff-no-panel.png",
      fullPage: true,
    });
  }

  await page
    .locator("[data-grading-result-panel]")
    .waitFor({ timeout: 10_000 });

  const grade = await page
    .locator("[data-grading-result-panel] [data-grade]")
    .first()
    .getAttribute("data-grade");
  console.log(`\n>>> F&F GRADE: ${grade} <<<\n`);

  // F&F-specific metric keys should be in the breakdown
  await expect(
    page.locator('[data-metric-key="purchase_margin"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-metric-key="net_profit_margin"]').first(),
  ).toBeVisible();

  // F&F-native upgrade-path panel must render (NOT the B&H variant)
  if (grade !== "A") {
    await expect(page.locator("[data-flip-upgrade-path-panel]")).toBeVisible({
      timeout: 20_000,
    });
    // B&H upgrade-path panel must NOT render for F&F
    await expect(page.locator("[data-upgrade-path-panel]")).toHaveCount(0);
  }

  // Print all analyzer API responses for visibility
  console.log("\n---- F&F /api/analyzer responses ----");
  for (const r of flipResponses) {
    console.log(`[${r.status}] ${r.url}`);
  }

  await page.screenshot({
    path: "test-results/visible-ff-score.png",
    fullPage: true,
  });
  await page.waitForTimeout(2000);
  expect(grade).toMatch(/^[A-F]$/);
});
