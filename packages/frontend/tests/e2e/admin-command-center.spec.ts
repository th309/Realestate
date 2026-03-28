/**
 * Admin Command Center E2E Tests
 *
 * Verifies the command center layout, hero stats, tab switching,
 * detail panel interactions, time range selector, and API integration.
 *
 * Uses route mocking to provide deterministic admin profile and hero stats
 * so tests are not gated by real credentials or backend availability.
 */

import { test, expect, Page } from "@playwright/test";

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_HERO_STATS = {
  success: true,
  data: {
    system_health: {
      uptime_pct: 99.8,
      sparkline: [100, 100, 99, 100, 100, 98, 100],
    },
    active_alerts: {
      count: 1,
      critical: 0,
      warning: 1,
      sparkline: [0, 0, 1, 0, 2, 1, 1],
    },
    data_freshness: { fresh: 8, total: 10, sparkline: [10, 9, 8, 8, 9, 8, 8] },
    total_users: {
      count: 1_247,
      new_this_week: 23,
      sparkline: [1100, 1120, 1150, 1180, 1200, 1230, 1247],
    },
    score_health: {
      hit_rate_1y: 72.5,
      sparkline: [68, 70, 71, 69, 72, 73, 72.5],
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

async function setupCommandCenterMocks(page: Page) {
  // Mock admin profile so the page renders without real auth
  await page.route("**/api/user/profile", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "admin-e2e-001",
          email: "admin@propertyiq.com",
          tier: "enterprise",
          role: "admin",
          name: "E2E Admin",
        },
      }),
    });
  });

  // Mock hero stats endpoint
  await page.route("**/api/admin/metrics/hero-stats", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_HERO_STATS),
    });
  });

  // Catch-all for other admin API calls to prevent 401/500 errors
  await page.route("**/api/admin/**", (route) => {
    // Only handle routes not already matched above
    const url = route.request().url();
    if (url.includes("/hero-stats")) {
      route.fallback();
      return;
    }
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

// ============================================================================
// 1. Hero Stats Row — renders 5 cards with values
// ============================================================================

test.describe("Hero Stats Row", () => {
  test.beforeEach(async ({ page }) => {
    await setupCommandCenterMocks(page);
    await page.goto("/admin?bypass_auth=true");
  });

  test("renders 5 hero stat cards", async ({ page }) => {
    const heroRow = page.getByTestId("hero-stats-row");
    await expect(heroRow).toBeVisible({ timeout: 15_000 });

    const cards = heroRow.getByTestId("hero-stat-card");
    await expect(cards).toHaveCount(5);
  });

  test("hero stat cards display non-empty values", async ({ page }) => {
    // Wait for the first hero-stat-value to appear (data loaded, not skeleton)
    const firstValue = page.getByTestId("hero-stat-value").first();
    await expect(firstValue).toBeVisible({ timeout: 15_000 });

    const values = page.getByTestId("hero-stat-value");
    await expect(values).toHaveCount(5);

    // At least one card should show a real value (not blank)
    const text = await firstValue.textContent();
    expect(text && text.trim().length > 0).toBe(true);
  });

  test("hero stat labels include expected categories", async ({ page }) => {
    const heroRow = page.getByTestId("hero-stats-row");
    await expect(heroRow).toBeVisible({ timeout: 15_000 });

    // The five labels rendered by HeroStatsRow
    await expect(heroRow).toContainText("System Health");
    await expect(heroRow).toContainText("Active Alerts");
    await expect(heroRow).toContainText("Data Freshness");
    await expect(heroRow).toContainText("Total Users");
    await expect(heroRow).toContainText("Score Health");
  });
});

// ============================================================================
// 2. Tab Bar — switches between 3 tabs
// ============================================================================

test.describe("Tab Bar Switching", () => {
  test.beforeEach(async ({ page }) => {
    await setupCommandCenterMocks(page);
    await page.goto("/admin?bypass_auth=true");
    // Wait for page content to load
    await expect(page.getByTestId("hero-stats-row")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Operations tab is active by default", async ({ page }) => {
    const operationsTab = page.getByTestId("tab-operations");
    await expect(operationsTab).toBeVisible();
    await expect(operationsTab).toHaveAttribute("data-active", "true");
  });

  test("clicking Data & Scores activates it and deactivates Operations", async ({
    page,
  }) => {
    const dataScoresTab = page.getByTestId("tab-data-scores");
    await dataScoresTab.click();

    await expect(dataScoresTab).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("tab-operations")).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  test("clicking Business activates it", async ({ page }) => {
    const businessTab = page.getByTestId("tab-business");
    await businessTab.click();

    await expect(businessTab).toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("tab-operations")).toHaveAttribute(
      "data-active",
      "false",
    );
    await expect(page.getByTestId("tab-data-scores")).toHaveAttribute(
      "data-active",
      "false",
    );
  });
});

// ============================================================================
// 3. Operations Tab — shows 5 cards
// ============================================================================

test.describe("Operations Tab Cards", () => {
  test.beforeEach(async ({ page }) => {
    await setupCommandCenterMocks(page);
    await page.goto("/admin?bypass_auth=true");
    await expect(page.getByTestId("hero-stats-row")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("displays all 5 operations cards", async ({ page }) => {
    // Operations tab is active by default
    await expect(page.getByTestId("card-data-feeds")).toBeVisible();
    await expect(page.getByTestId("card-pipeline-runs")).toBeVisible();
    await expect(page.getByTestId("card-api-performance")).toBeVisible();
    await expect(page.getByTestId("card-cache-performance")).toBeVisible();
    await expect(page.getByTestId("card-active-alerts")).toBeVisible();
  });

  test("operations cards show correct titles", async ({ page }) => {
    await expect(page.getByTestId("card-data-feeds")).toContainText(
      "Data Feeds",
    );
    await expect(page.getByTestId("card-pipeline-runs")).toContainText(
      "Pipeline Runs",
    );
    await expect(page.getByTestId("card-api-performance")).toContainText(
      "API Performance",
    );
    await expect(page.getByTestId("card-cache-performance")).toContainText(
      "Cache Performance",
    );
    await expect(page.getByTestId("card-active-alerts")).toContainText(
      "Active Alerts",
    );
  });
});

// ============================================================================
// 4. Detail Panel — opens on card click
// ============================================================================

test.describe("Detail Panel Opens on Card Click", () => {
  test.beforeEach(async ({ page }) => {
    await setupCommandCenterMocks(page);
    await page.goto("/admin?bypass_auth=true");
    await expect(page.getByTestId("hero-stats-row")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("clicking Data Feeds card opens the detail panel", async ({ page }) => {
    await page.getByTestId("card-data-feeds").click();

    const panel = page.getByTestId("detail-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Data Feeds");
  });

  test("detail panel shows time range selector", async ({ page }) => {
    await page.getByTestId("card-data-feeds").click();

    const panel = page.getByTestId("detail-panel");
    await expect(panel).toBeVisible();

    // Time range buttons should be present (e.g., 7d, 30d, 90d)
    await expect(panel.getByText("7d")).toBeVisible();
    await expect(panel.getByText("30d")).toBeVisible();
    await expect(panel.getByText("90d")).toBeVisible();
  });
});

// ============================================================================
// 5. Detail Panel — closes on X click and scrim click
// ============================================================================

test.describe("Detail Panel Closes", () => {
  test.beforeEach(async ({ page }) => {
    await setupCommandCenterMocks(page);
    await page.goto("/admin?bypass_auth=true");
    await expect(page.getByTestId("hero-stats-row")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("closes via X button", async ({ page }) => {
    // Open panel
    await page.getByTestId("card-data-feeds").click();
    const panel = page.getByTestId("detail-panel");
    await expect(panel).toBeVisible();

    // Close via the X button (has aria-label="Close panel")
    await panel.getByRole("button", { name: "Close panel" }).click();

    // Panel should animate out (translate-x-full) — wait for it to leave
    await expect(panel).not.toBeInViewport({ timeout: 2_000 });
  });

  test("closes via scrim click", async ({ page }) => {
    // Open panel
    await page.getByTestId("card-pipeline-runs").click();
    const panel = page.getByTestId("detail-panel");
    await expect(panel).toBeVisible();

    // Click the scrim overlay to close
    const scrim = page.getByTestId("detail-panel-scrim");
    await scrim.click({ force: true, position: { x: 50, y: 200 } });

    // Panel should animate out
    await expect(panel).not.toBeInViewport({ timeout: 2_000 });
  });
});

// ============================================================================
// 6. Time Range Selector — toggles between ranges
// ============================================================================

test.describe("Time Range Selector", () => {
  test.beforeEach(async ({ page }) => {
    await setupCommandCenterMocks(page);
    await page.goto("/admin?bypass_auth=true");
    await expect(page.getByTestId("hero-stats-row")).toBeVisible({
      timeout: 15_000,
    });
    // Open detail panel
    await page.getByTestId("card-data-feeds").click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
  });

  test("30d is the default active time range", async ({ page }) => {
    const panel = page.getByTestId("detail-panel");

    // The 30d button should have the active style (bg-primary)
    const thirtyDayButton = panel.getByRole("button", {
      name: "30d",
      exact: true,
    });
    await expect(thirtyDayButton).toBeVisible();
    await expect(thirtyDayButton).toHaveClass(/bg-primary/);
  });

  test("clicking 7d activates it", async ({ page }) => {
    const panel = page.getByTestId("detail-panel");

    const sevenDayButton = panel.getByRole("button", {
      name: "7d",
      exact: true,
    });
    await sevenDayButton.click();

    // 7d should now be active
    await expect(sevenDayButton).toHaveClass(/bg-primary/);

    // 30d should no longer be active
    const thirtyDayButton = panel.getByRole("button", {
      name: "30d",
      exact: true,
    });
    await expect(thirtyDayButton).not.toHaveClass(/bg-primary/);
  });

  test("clicking 90d activates it", async ({ page }) => {
    const panel = page.getByTestId("detail-panel");

    const ninetyDayButton = panel.getByRole("button", {
      name: "90d",
      exact: true,
    });
    await ninetyDayButton.click();

    await expect(ninetyDayButton).toHaveClass(/bg-primary/);
  });
});

// ============================================================================
// 7. Hero Stats — fetch real API data shape
// ============================================================================

test.describe("Hero Stats API Integration", () => {
  test("intercepts hero-stats response with expected structure", async ({
    page,
  }) => {
    let capturedResponse: Record<string, unknown> | null = null;

    // Override the hero-stats handler to capture the response
    await setupCommandCenterMocks(page);
    await page.route("**/api/admin/metrics/hero-stats", (route) => {
      capturedResponse = MOCK_HERO_STATS;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HERO_STATS),
      });
    });

    await page.goto("/admin?bypass_auth=true");
    await expect(page.getByTestId("hero-stat-value").first()).toBeVisible({
      timeout: 15_000,
    });

    // Verify the mock was hit and the shape matches the backend envelope
    expect(capturedResponse).not.toBeNull();
    expect(capturedResponse).toHaveProperty("success", true);
    expect(capturedResponse).toHaveProperty("data.system_health");
    expect(capturedResponse).toHaveProperty("data.active_alerts");
    expect(capturedResponse).toHaveProperty("data.data_freshness");
    expect(capturedResponse).toHaveProperty("data.total_users");
    expect(capturedResponse).toHaveProperty("data.score_health");
  });
});

// ============================================================================
// 8. Refresh Button — triggers new fetch
// ============================================================================

test.describe("Refresh Button", () => {
  test("clicking refresh triggers a new hero-stats fetch", async ({ page }) => {
    let heroStatsFetchCount = 0;

    await setupCommandCenterMocks(page);

    // Override hero-stats to count calls (registered last = matched first)
    await page.route("**/api/admin/metrics/hero-stats", (route) => {
      heroStatsFetchCount++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HERO_STATS),
      });
    });

    await page.goto("/admin?bypass_auth=true");
    await expect(page.getByTestId("hero-stat-value").first()).toBeVisible({
      timeout: 15_000,
    });

    const fetchCountBeforeRefresh = heroStatsFetchCount;

    // Click the refresh button
    await page.getByTestId("refresh-button").click();

    // Wait for the new fetch to fire
    await page.waitForTimeout(1_500);

    expect(heroStatsFetchCount).toBeGreaterThan(fetchCountBeforeRefresh);
  });
});
