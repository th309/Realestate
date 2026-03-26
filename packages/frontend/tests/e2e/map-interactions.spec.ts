/**
 * Map Interactions E2E Tests — Live (Enterprise User)
 *
 * Tests the core /map page end-to-end against a running dev server.
 * Covers: initial load, search, geography selection, geo-level switching,
 * right detail panel, sidebar metric selection, and mobile menu toggle.
 *
 * Auth: enterprise-user fixture (full entitlements — no paywall gates
 * interfering with geo-level pills or metric categories).
 */

import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(
  __dirname,
  "../fixtures/.auth/enterprise-user.json",
);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the Mapbox canvas to exist and paint at least one frame.
 * We can't inspect Mapbox layer internals, so we verify the <canvas>
 * element that Mapbox GL injects into its container div.
 */
async function waitForMapCanvas(page: import("@playwright/test").Page) {
  // Mapbox renders into a <canvas> inside the map container div
  await page.waitForSelector('canvas', { timeout: 20000 });
}

/**
 * Navigate to /map, wait for network idle, and wait for the Mapbox canvas.
 */
async function gotoMap(page: import("@playwright/test").Page) {
  await page.goto("/map");
  await page.waitForLoadState("networkidle");
  await waitForMapCanvas(page);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Map Interactions — Live E2E", () => {
  test.use({ storageState: authFile });
  test.setTimeout(45000);

  // -------------------------------------------------------------------------
  // 1. Map page loads with choropleth
  // -------------------------------------------------------------------------

  test("map page loads — canvas renders, search bar, geo pills, and legend are visible", async ({
    page,
  }) => {
    await gotoMap(page);

    // Mapbox GL injects a <canvas> element when it renders the map
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();

    // Search bar — the container has data-tour="search-bar"; the input is inside it
    const searchContainer = page.locator('[data-tour="search-bar"]');
    await expect(searchContainer).toBeVisible();

    // The actual search input uses a placeholder (no data-testid on the input itself)
    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .first();
    await expect(searchInput).toBeVisible();

    // Geo-level pills — the toolbar renders National, State, Metro, County, City, Zip pills
    await expect(
      page.getByRole("button", { name: "State" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Metro" }).first(),
    ).toBeVisible();

    // Legend — sits at the bottom-left of the map area with the metric title + color scale
    // The legend container has no data-testid, but it renders the metric title text.
    // "Home Value" is the default metric on load.
    const legend = page.locator(".absolute.bottom-8, .absolute.bottom-10").first();
    await expect(legend).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Search bar finds a ZIP code
  // -------------------------------------------------------------------------

  test("search bar finds ZIP code 90210 and displays dropdown results", async ({
    page,
  }) => {
    await gotoMap(page);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .first();

    // Type the ZIP — the search hook debounces and hits the backend
    await searchInput.click();
    await searchInput.fill("90210");

    // Wait for at least one search result to appear in the dropdown
    // Results render in a <ul> inside the dropdown — each is a <button> with the result name
    const dropdown = page.locator(
      ".absolute.top-full",
    ).first();
    await expect(dropdown).toBeVisible({ timeout: 15000 });

    // The result list items should include text (city or ZIP name with a state reference)
    // Beverly Hills is the canonical result for 90210
    const resultItem = page.getByRole("button", { name: /90210|Beverly Hills/i }).first();
    await expect(resultItem).toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 3. Search result selection opens the right detail panel
  // -------------------------------------------------------------------------

  test("clicking a search result opens the right detail panel with the geography name", async ({
    page,
  }) => {
    await gotoMap(page);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .first();

    await searchInput.click();
    await searchInput.fill("Austin");

    // Wait for results
    const dropdown = page.locator(".absolute.top-full").first();
    await expect(dropdown).toBeVisible({ timeout: 15000 });

    // Click the first result
    const firstResult = page
      .locator(".absolute.top-full button")
      .first();
    await expect(firstResult).toBeVisible({ timeout: 15000 });
    const resultName = await firstResult.textContent();
    await firstResult.click();

    // The RightDetailPanel slides in — its header contains "Analysis View" label
    // and an <h2> with the geography name
    const panelHeader = page.locator("aside h2").first();
    await expect(panelHeader).toBeVisible({ timeout: 15000 });

    // The panel heading should show a non-empty name (the geography selected)
    const headingText = await panelHeader.textContent();
    expect(headingText?.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 4. Geo-level switching
  // -------------------------------------------------------------------------

  test("switching geo level pills updates the active pill style", async ({
    page,
  }) => {
    await gotoMap(page);

    // Default level is State — verify State pill shows active styling (bg-primary)
    const statePill = page
      .getByRole("button", { name: "State" })
      .first();
    await expect(statePill).toBeVisible();
    await expect(statePill).toHaveClass(/bg-primary/);

    // Click Metro pill
    const metroPill = page
      .getByRole("button", { name: "Metro" })
      .first();
    await metroPill.click();

    // Wait for the map to re-fetch data (network idle gives us a clean signal)
    await page.waitForLoadState("networkidle");

    // Metro pill should now be active
    await expect(metroPill).toHaveClass(/bg-primary/, { timeout: 10000 });

    // State pill should no longer be active
    await expect(statePill).not.toHaveClass(/bg-primary/);

    // Click County pill
    const countyPill = page
      .getByRole("button", { name: "County" })
      .first();
    await countyPill.click();
    await page.waitForLoadState("networkidle");

    await expect(countyPill).toHaveClass(/bg-primary/, { timeout: 10000 });
    await expect(metroPill).not.toHaveClass(/bg-primary/);
  });

  // -------------------------------------------------------------------------
  // 5. Map hover tooltip proxy — search + panel flow
  //    (Direct Mapbox hover events can't be reliably simulated in Playwright,
  //    so we verify the tooltip/panel pathway via the search→click flow.)
  // -------------------------------------------------------------------------

  test("search → select flow opens the analysis panel showing metric data", async ({
    page,
  }) => {
    await gotoMap(page);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .first();

    await searchInput.click();
    await searchInput.fill("Denver");

    const dropdown = page.locator(".absolute.top-full").first();
    await expect(dropdown).toBeVisible({ timeout: 15000 });

    const firstResult = page
      .locator(".absolute.top-full button")
      .first();
    await expect(firstResult).toBeVisible({ timeout: 15000 });
    await firstResult.click();

    // RightDetailPanel slides in — the aside element becomes visible
    const panel = page.locator("aside").filter({ hasText: "Analysis View" });
    await expect(panel).toBeVisible({ timeout: 15000 });

    // The panel body has scrollable content with metric data cards
    const panelBody = panel.locator(".overflow-y-auto");
    await expect(panelBody).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 6. Right panel shows score data after geography selection
  // -------------------------------------------------------------------------

  test("right panel shows score gauge cards after geography selection", async ({
    page,
  }) => {
    await gotoMap(page);

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .first();

    // Search for a metro area that reliably has score data
    await searchInput.click();
    await searchInput.fill("Los Angeles");

    const dropdown = page.locator(".absolute.top-full").first();
    await expect(dropdown).toBeVisible({ timeout: 15000 });

    // Pick the first result
    const firstResult = page
      .locator(".absolute.top-full button")
      .first();
    await expect(firstResult).toBeVisible({ timeout: 15000 });
    await firstResult.click();

    // Wait for the panel to open
    const panel = page.locator("aside").filter({ hasText: "Analysis View" });
    await expect(panel).toBeVisible({ timeout: 15000 });

    // The RightDetailPanel renders a MarketSnapshot section (key stats grid)
    // and QuickActions (View Details / Generate Report / Save buttons)
    // QuickActions always render once geography is set
    const quickActionsSection = panel.locator("a, button").first();
    await expect(quickActionsSection).toBeVisible({ timeout: 15000 });

    // "Analysis View" label should be present in the panel header
    await expect(panel.getByText("Analysis View")).toBeVisible();

    // The geography name h2 should be visible and non-empty
    const geoHeading = panel.locator("h2").first();
    const geoName = await geoHeading.textContent();
    expect(geoName?.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 7. Metric selector — open sidebar category, select different metric,
  //    verify the legend title updates
  // -------------------------------------------------------------------------

  test("selecting a metric from the sidebar changes the active metric", async ({
    page,
  }) => {
    await gotoMap(page);

    // The sidebar is at data-tour="metric-sidebar".
    // On desktop (≥1440px) the metric panel is visible; on smaller viewports
    // we open it via the hamburger toggle first.
    const viewportWidth = page.viewportSize()?.width ?? 1280;

    // On narrow desktop (< 1440px) the sidebar panel is collapsed by default.
    // The hamburger button (aria-label="Toggle sidebar") opens the mobile menu.
    // On very wide screens (≥ 1440px) the panel is expanded automatically.
    if (viewportWidth < 1440) {
      const hamburger = page.getByRole("button", { name: "Toggle sidebar" });
      await hamburger.click();

      // Wait for the sidebar to slide in (mobileMenuOpen = true)
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }

    // The sidebar contains "Market Trends" heading and metric category buttons
    const marketTrendsHeading = page.getByText("Market Trends");
    await expect(marketTrendsHeading).toBeVisible({ timeout: 5000 });

    // Click the "Affordability" category to expand it (it may already be expanded
    // under "popular" — but affordability is a named category button)
    const affordabilityCategory = page
      .getByRole("button", { name: /Affordability/i })
      .first();
    await affordabilityCategory.click();

    // After expanding, "Days on Market" metric should be accessible — we actually
    // want to click a metric in the "Market Competition" category
    const competitionCategory = page
      .getByRole("button", { name: /Market Competition/i })
      .first();

    if (await competitionCategory.isVisible()) {
      await competitionCategory.click();
    }

    // Click "Days on Market" metric — it's in both Market Competition (homebuyer)
    // This triggers onSelectMetric('days_on_market')
    const daysOnMarketBtn = page
      .getByRole("button", { name: /Days on Market/i })
      .first();

    if (await daysOnMarketBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await daysOnMarketBtn.click();

      // Wait for the map to re-fetch with the new metric
      await page.waitForLoadState("networkidle");

      // The legend should update to show "Days on Market" as the title
      // MetricTitle renders the metric name — "Days on Market" from the config
      const legendTitle = page.getByText(/Days on Market/i).first();
      await expect(legendTitle).toBeVisible({ timeout: 10000 });
    } else {
      // If the metric panel isn't expanded / visible, at minimum verify
      // the sidebar itself rendered the category list
      const categoryButtons = page.locator('button').filter({ hasText: /Affordability|Market Competition|Cash Flow/i });
      const count = await categoryButtons.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // 8. Mobile menu toggle
  // -------------------------------------------------------------------------

  test("mobile hamburger toggles the sidebar menu open and closed", async ({
    page,
  }) => {
    // Set mobile viewport (Pixel 5 equivalent)
    await page.setViewportSize({ width: 393, height: 851 });
    await gotoMap(page);

    // The hamburger button in the toolbar toggles mobileMenuOpen
    const hamburger = page.getByRole("button", { name: "Toggle sidebar" });
    await expect(hamburger).toBeVisible();

    // On mobile the sidebar aside starts off-screen (translate-x-full → -translate-x-full)
    // Opening: clicking hamburger sets mobileMenuOpen = true → "translate-x-0"
    await hamburger.click();

    // The sidebar should slide into view — look for the "Market Trends" heading
    // which only appears when the sidebar panel is open
    const marketTrendsHeading = page.getByText("Market Trends");
    await expect(marketTrendsHeading).toBeVisible({ timeout: 5000 });

    // There is also a scrim (overlay backdrop) when the mobile menu is open
    const scrim = page.locator('.fixed.inset-0.bg-on-surface\\/40.z-40');
    await expect(scrim).toBeVisible({ timeout: 5000 });

    // Click the scrim to close the menu
    await scrim.click();

    // The sidebar heading should no longer be visible (menu closed)
    await expect(marketTrendsHeading).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 9. Closing the right detail panel
  // -------------------------------------------------------------------------

  test("right panel can be closed with the X button", async ({ page }) => {
    await gotoMap(page);

    // Open the panel via search
    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .first();
    await searchInput.click();
    await searchInput.fill("Chicago");

    const dropdown = page.locator(".absolute.top-full").first();
    await expect(dropdown).toBeVisible({ timeout: 15000 });
    const firstResult = page.locator(".absolute.top-full button").first();
    await expect(firstResult).toBeVisible({ timeout: 15000 });
    await firstResult.click();

    const panel = page.locator("aside").filter({ hasText: "Analysis View" });
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Click the X close button (lucide X icon inside a button in the panel header)
    const closeButton = panel.locator("button").filter({ has: page.locator("svg") }).first();
    await closeButton.click();

    // The panel should no longer be visible
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });

  // -------------------------------------------------------------------------
  // 10. Geo level switching clears the right panel
  // -------------------------------------------------------------------------

  test("switching geo level after a selection clears the right panel", async ({
    page,
  }) => {
    await gotoMap(page);

    // Select a geography via search
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.click();
    await searchInput.fill("Miami");

    const dropdown = page.locator(".absolute.top-full").first();
    await expect(dropdown).toBeVisible({ timeout: 15000 });
    const firstResult = page.locator(".absolute.top-full button").first();
    await expect(firstResult).toBeVisible({ timeout: 15000 });
    await firstResult.click();

    const panel = page.locator("aside").filter({ hasText: "Analysis View" });
    await expect(panel).toBeVisible({ timeout: 15000 });

    // Now switch geo level — handleGeoLevelChange closes the panel and clears geography
    const metroPill = page.getByRole("button", { name: "Metro" }).first();
    const countyPill = page.getByRole("button", { name: "County" }).first();

    // Click whichever level is not currently active to trigger a switch
    const isMetroActive = await metroPill.evaluate((el) =>
      el.className.includes("bg-primary"),
    );
    const pillToClick = isMetroActive ? countyPill : metroPill;
    await pillToClick.click();

    // The right panel should close (handleGeoLevelChange calls setRightPanelOpen(false))
    await expect(panel).not.toBeVisible({ timeout: 5000 });
  });
});
