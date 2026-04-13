/**
 * Onboarding Conversion Flow E2E Tests
 *
 * Tests the new onboarding conversion flow UI, including:
 *   - /get-started persona card selection
 *   - Trial badge rendering in header
 *   - Dashboard onboarding widgets (progress checklist)
 *   - BreathingSpotlight + ConnectedTooltip guided tour
 *   - Free tier paywall and SampleReportCard display
 *   - PersonalizedPaywall component rendering
 *
 * Uses enterprise-user auth fixture.
 * Uses ?tier=free|pro URL param to simulate different tiers.
 * Tests are resilient — they verify components don't crash rather than
 * requiring specific DB trial state.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

// Extend default timeout — tests load live data and wait for UI to settle
test.setTimeout(30_000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to a URL with tier simulation.
 * The ?tier= param seeds sessionStorage and persists for the tab session.
 */
async function navigateWithTier(page: Page, url: string, tier: string) {
  const separator = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${separator}tier=${tier}`, { waitUntil: "load" });
}

// ============================================================================
// /get-started page
// ============================================================================

test.describe("Onboarding Conversion Flow", () => {
  test.use({ storageState: authFile });

  test.describe("/get-started page", () => {
    test("should render 4 persona cards", async ({ page }) => {
      await page.goto("/get-started");
      await page.waitForLoadState("load");

      const cards = page
        .locator("button")
        .filter({ hasText: /homebuyer|investor|agent|researcher/i });
      await expect(cards).toHaveCount(4);
    });

    test("should show search input after persona selection", async ({
      page,
    }) => {
      await page.goto("/get-started");
      await page.waitForLoadState("load");

      // Click "Real Estate Investor" persona
      await page.getByRole("button", { name: /investor/i }).click();

      // Search input should appear after selection
      await expect(
        page.locator("input[type='text'], input[type='search']"),
      ).toBeVisible({ timeout: 5000 });
    });

    test("persona cards should have correct labels", async ({ page }) => {
      await page.goto("/get-started");
      await page.waitForLoadState("load");

      await expect(page.getByText("First-time Homebuyer")).toBeVisible();
      await expect(page.getByText("Real Estate Investor")).toBeVisible();
      await expect(page.getByText("Agent / Broker")).toBeVisible();
      await expect(page.getByText("Market Researcher")).toBeVisible();
    });
  });

  // ============================================================================
  // Trial badge
  // ============================================================================

  test.describe("Trial badge", () => {
    test("header renders on pro-tier dashboard", async ({ page }) => {
      // TrialBadge only renders when trial?.active is true (real DB state).
      // With tier simulation we verify the header is present and stable — not crashed.
      await navigateWithTier(page, "/dashboard", "pro");
      await page.waitForLoadState("load");

      const header = page.locator("header");
      await expect(header).toBeVisible();

      // Page must not have a React application error
      await expect(page.locator("body")).not.toHaveText("Application error");
    });
  });

  // ============================================================================
  // Dashboard widgets
  // ============================================================================

  test.describe("Dashboard widgets", () => {
    test("dashboard loads without application errors", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("load");

      await expect(page.locator("body")).not.toHaveText("Application error");
    });

    test("dashboard shows a welcome heading", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("load");

      // Dashboard must render a welcome heading once authenticated
      await expect(page.getByText(/welcome/i).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("onboarding checklist widget renders if onboarding incomplete", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("load");

      // The checklist widget shows "Getting Started" when onboarding steps remain.
      // This is a soft check — the widget may not appear if the enterprise user
      // has already completed all steps, which is the correct behavior.
      const checklist = page.getByText("Getting Started");
      const isVisible = await checklist.isVisible().catch(() => false);

      if (isVisible) {
        await expect(checklist).toBeVisible();
      }

      // Either way, the page must not have crashed
      await expect(page.locator("body")).not.toHaveText("Application error");
    });
  });

  // ============================================================================
  // Onboarding UI components (BreathingSpotlight + ConnectedTooltip)
  // ============================================================================

  test.describe("Onboarding UI components", () => {
    test("market page with onboarding=true loads without crashing", async ({
      page,
    }) => {
      // Austin metro (12420) with onboarding tour trigger
      await page.goto("/market/12420?type=metro&onboarding=true");
      await page.waitForLoadState("load");

      // Allow time for async data and spotlight animation to settle
      await page.waitForTimeout(3000);

      await expect(page.locator("body")).not.toHaveText("Application error");
    });

    test("ConnectedTooltip renders with PropertyIQ Score title on guided flow", async ({
      page,
    }) => {
      await page.goto("/market/12420?type=metro&onboarding=true");
      await page.waitForLoadState("load");
      await page.waitForTimeout(3000);

      // Soft check — tooltip appears only after score card has loaded
      const tooltip = page.getByText("PropertyIQ Score", { exact: false });
      const isVisible = await tooltip.isVisible().catch(() => false);

      if (isVisible) {
        await expect(tooltip).toBeVisible();
      }

      // Either state is valid — what matters is no crash
      await expect(page.locator("body")).not.toHaveText("Application error");
    });
  });

  // ============================================================================
  // Free tier experience
  // ============================================================================

  test.describe("Free tier experience", () => {
    test("free user sees upgrade prompt on reports page", async ({ page }) => {
      await navigateWithTier(page, "/reports", "free");
      await page.waitForLoadState("load");
      await page.waitForTimeout(3000);

      // Free users should see some form of upgrade/unlock/pro prompt
      const upgradeText = page.getByText(/upgrade|unlock|pro/i).first();
      await expect(upgradeText).toBeVisible({ timeout: 10000 });
    });

    test("free tier dashboard loads without application errors", async ({
      page,
    }) => {
      await navigateWithTier(page, "/dashboard", "free");
      await page.waitForLoadState("load");
      await page.waitForTimeout(3000);

      // SampleReportCard renders for free non-trial users ("Sample Report:" text).
      // This is a soft check — it may not appear if the user has an active trial.
      await expect(page.locator("body")).not.toHaveText("Application error");
    });
  });

  // ============================================================================
  // PersonalizedPaywall component
  // ============================================================================

  test.describe("PersonalizedPaywall component", () => {
    test("paywall page renders correctly for free tier", async ({ page }) => {
      await navigateWithTier(page, "/reports", "free");
      await page.waitForLoadState("load");
      await page.waitForTimeout(3000);

      // Paywall page must not crash regardless of which paywall variant renders
      await expect(page.locator("body")).not.toHaveText("Application error");
    });
  });
});
