/**
 * Embed Widgets — Live Production E2E Tests
 * NO MOCKS. Hits the real production site with live data.
 * Tests all 5 widget types + demo site + configurator.
 */
import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

test.describe("Embed Widgets — Live Data E2E", () => {
  test.use({ storageState: authFile });
  test.setTimeout(60000); // Embeds with maps and charts need extra time

  // ─── TEST HARNESS ──────────────────────────────

  test("test harness page loads", async ({ page }) => {
    await page.goto("/embed/test-harness");
    await expect(page.getByText(/embed test harness/i)).toBeVisible({
      timeout: 20000,
    });
  });

  // ─── SCORE EMBED ───────────────────────────────

  test("score embed loads with live data", async ({ page }) => {
    await page.goto("/embed/score/metro/31080?scoreType=homeready");
    await page.waitForLoadState("networkidle");
    // Should show a score number (1-100)
    await expect(page.locator("text=/\\d{1,3}/")).toBeVisible({
      timeout: 20000,
    });
  });

  // ─── METRIC CARD EMBED ────────────────────────

  test("metric card embed loads with live data", async ({ page }) => {
    await page.goto("/embed/metric-card/home_value/metro/31080");
    await page.waitForLoadState("networkidle");
    // Should show a dollar value
    await expect(page.locator("text=/\\$/")).toBeVisible({ timeout: 20000 });
  });

  // ─── CHART EMBED ──────────────────────────────

  test("chart embed loads with live data", async ({ page }) => {
    await page.goto(
      "/embed/chart?metric=home_value&geo=metro&ids=31080&range=3y&chart_type=line",
    );
    await page.waitForLoadState("networkidle");
    // Recharts renders SVG — check for SVG path elements
    await expect(page.locator("svg path").first()).toBeVisible({
      timeout: 20000,
    });
  });

  // ─── MAP EMBED ────────────────────────────────

  test("full map embed loads", async ({ page }) => {
    await page.goto(
      "/embed/map-full?metric=home_value&geo=state&search=1&legend=1",
    );
    await page.waitForLoadState("networkidle");
    // Mapbox renders a canvas element
    await expect(page.locator("canvas").first()).toBeVisible({
      timeout: 30000,
    });
  });

  // ─── DEMO SITE ────────────────────────────────

  test("demo brokerage homepage loads", async ({ page }) => {
    await page.goto("/embed/demo-site");
    await expect(page.getByText(/acme real estate/i)).toBeVisible({
      timeout: 20000,
    });
  });

  test("demo market data page loads with map", async ({ page }) => {
    await page.goto("/embed/demo-site/market-data");
    await expect(page.getByText(/market/i).first()).toBeVisible({
      timeout: 20000,
    });
    // Should have iframes
    await expect(page.locator("iframe").first()).toBeVisible({
      timeout: 20000,
    });
  });

  // ─── CONFIGURATOR ─────────────────────────────

  test("embed configurator loads in org admin", async ({ page }) => {
    await page.goto("/org/testbroker1/admin/embeds");
    await page.waitForLoadState("networkidle");
    // Should show widget type selector or "create token" message
    await expect(
      page.getByText(/score widget/i).or(page.getByText(/create.*token/i)),
    ).toBeVisible({ timeout: 20000 });
  });
});
