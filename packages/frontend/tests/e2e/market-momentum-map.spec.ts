import { expect, test } from "@playwright/test";

// Live-data E2E: requires the real backend on :3001 (no mocks — the widget
// must paint 900+ dots from the production-schema database).
test.describe("Market Momentum Map widget", () => {
  test("renders live data, scrubs months, shows tooltip, both sizes", async ({
    page,
  }) => {
    await page.goto("/dev/market-momentum-map");

    const hero = page.getByTestId("momentum-map-hero");
    await expect(hero).toBeVisible({ timeout: 30_000 });

    // 900+ metro dots painted from live data
    await expect
      .poll(async () => hero.locator("circle").count(), { timeout: 30_000 })
      .toBeGreaterThan(900);

    // Month readout starts on the latest month and changes when scrubbing
    const readout = hero.getByTestId("momentum-month-readout");
    const latestLabel = await readout.textContent();
    expect(latestLabel).toBeTruthy();

    const slider = hero.getByRole("slider", { name: "Month" });
    await slider.focus();
    await page.keyboard.press("Home"); // jump to Jan 2001
    await expect(readout).not.toHaveText(latestLabel!);
    await expect(readout).toHaveText(/2001/);

    // Summary strip shows sane percentages
    const strip = hero.getByTestId("momentum-summary-strip");
    await expect(strip).toContainText("%");

    // Tooltip appears when hovering a dot
    await hero.locator("circle").first().hover({ force: true });
    await expect(hero.getByTestId("momentum-tooltip")).toBeVisible();

    // Card size renders dots too, without the summary strip
    const card = page.getByTestId("momentum-map-card");
    await expect
      .poll(async () => card.locator("circle").count(), { timeout: 30_000 })
      .toBeGreaterThan(900);
    await expect(card.getByTestId("momentum-summary-strip")).toHaveCount(0);
  });
});
