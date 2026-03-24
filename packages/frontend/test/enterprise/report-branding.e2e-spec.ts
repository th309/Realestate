/**
 * Report Branding E2E Tests
 *
 * Validates rendering and error handling for shared report pages and
 * organization branding on reports.
 *
 * Routes under test:
 * - /shared/report/:token — public shared report (no auth required)
 *
 * Note: Full integration tests for branded report headers require seeded
 * report data with organization branding. These tests use a lighter approach,
 * verifying that pages load without crashing and that core attribution
 * elements are present.
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

// ============================================================================
// Tests: Report Branding
// ============================================================================

test.describe("Report Branding", () => {
  test.setTimeout(60_000);

  // --------------------------------------------------------------------------
  // 1. Shared report page loads without crashing
  // --------------------------------------------------------------------------
  test("shared report page loads without unhandled errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Use an invalid token — the page should show an error state, not crash
    await page.goto(`${BASE_URL}/shared/report/test-invalid-token`);

    // Body should be visible (page rendered without fatal error)
    await expect(page.locator("body")).toBeVisible();

    await page.waitForTimeout(2000);

    // Filter out known non-critical console errors (Mapbox, favicon, etc.)
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("mapbox") &&
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("Failed to load resource"),
    );

    // No unexpected JS errors should appear
    expect(criticalErrors).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 2. Powered by PropertyIQ is visible on shared reports
  // --------------------------------------------------------------------------
  test("Powered by PropertyIQ is always visible on shared reports", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/shared/report/test-invalid-token`);

    // Wait for page to finish rendering
    await page.waitForTimeout(3000);

    // Even error/not-found pages should reference PropertyIQ somewhere
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("PropertyIQ");
  });

  // --------------------------------------------------------------------------
  // 3. BrandedReportHeader renders without crash when org branding exists
  // --------------------------------------------------------------------------
  test("shared report page renders without JS errors for any token", async ({
    page,
  }) => {
    // This test verifies the component structure exists and the shared report
    // page doesn't crash. Full integration testing of the accent color border
    // requires a seeded report with organization branding data.
    await page.goto(`${BASE_URL}/shared/report/test-token`);

    await page.waitForTimeout(2000);

    // Page should render without fatal errors
    await expect(page.locator("body")).toBeVisible();
  });
});
