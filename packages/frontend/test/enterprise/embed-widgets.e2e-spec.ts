/**
 * Embeddable Widgets E2E Tests
 *
 * Validates rendering and error handling for the embeddable widget pages:
 * - /embed/score/:geoLevel/:geoId   — score ring widget
 * - /embed/metric-card/:metric/:geoLevel/:geoId — metric card widget
 * - /embed/map/:geoLevel?metric=...  — interactive map widget
 *
 * All embed routes support an optional `?token=emb_...` query param for
 * branded embeds tied to an organization.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 */

import { test, expect } from "@playwright/test";

// ============================================================================
// Test Configuration
// ============================================================================

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

/** Default timeout for waiting on element visibility. */
const DEFAULT_TIMEOUT = 15_000;

/** Extended timeout for map canvas rendering (Mapbox GL init is slower). */
const MAP_TIMEOUT = 20_000;

// ============================================================================
// Tests: Embeddable Widgets
// ============================================================================

test.describe("Embeddable Widgets", () => {
  test.setTimeout(60_000);

  // --------------------------------------------------------------------------
  // 1. Score widget loads and renders score ring
  // --------------------------------------------------------------------------
  test("score widget loads and renders score ring", async ({ page }) => {
    await page.goto(`${BASE_URL}/embed/score/metro/31080?scoreType=homeready`);

    // Wait for the score ring to appear (a 1–3 digit score number)
    await expect(page.locator("text=/\\d{1,3}/")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Check that the score type label is visible
    await expect(page.locator("text=/HomeReady|Score/i")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 2. Metric card loads and shows formatted value
  // --------------------------------------------------------------------------
  test("metric card loads and shows value", async ({ page }) => {
    await page.goto(`${BASE_URL}/embed/metric-card/home_value/metro/31080`);

    // Should show a formatted currency value ($xxx,xxx) or plain number
    await expect(page.locator("text=/\\$[\\d,]+|[\\d,]+/").first()).toBeVisible(
      { timeout: DEFAULT_TIMEOUT },
    );
  });

  // --------------------------------------------------------------------------
  // 3. Map widget loads and renders Mapbox canvas
  // --------------------------------------------------------------------------
  test("map widget loads and renders Mapbox canvas", async ({ page }) => {
    await page.goto(`${BASE_URL}/embed/map/metro?metric=home_value`);

    // Mapbox GL creates a <canvas> element for the WebGL map surface
    await expect(page.locator("canvas").first()).toBeVisible({
      timeout: MAP_TIMEOUT,
    });
  });

  // --------------------------------------------------------------------------
  // 4. Invalid token shows error state
  // --------------------------------------------------------------------------
  test("invalid token shows error state", async ({ page }) => {
    await page.goto(
      `${BASE_URL}/embed/score/metro/31080?token=emb_invalid_token_abc123`,
    );

    // Should display an error message about the invalid token
    await expect(
      page.locator("text=/error|unable|invalid/i").first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  // --------------------------------------------------------------------------
  // 5. Powered by PropertyIQ attribution link is present
  // --------------------------------------------------------------------------
  test("Powered by PropertyIQ link is present", async ({ page }) => {
    await page.goto(`${BASE_URL}/embed/score/metro/31080`);

    // Wait for the widget to finish loading
    await page.waitForTimeout(3000);

    // Check for the "Powered by PropertyIQ" attribution text or link
    const poweredBy = page.locator("text=/Powered by PropertyIQ/i");
    await expect(poweredBy).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 6. Widget renders without token (backwards compatibility)
  // --------------------------------------------------------------------------
  test("widget renders without token (backwards compat)", async ({ page }) => {
    await page.goto(`${BASE_URL}/embed/score/metro/31080`);

    // Should load normally — score number visible
    await expect(page.locator("text=/\\d{1,3}/")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Branding bar should NOT be present when no token is supplied
    const brandingBar = page.locator('[data-testid="embed-branding-bar"]');
    await expect(brandingBar).not.toBeVisible();
  });
});
