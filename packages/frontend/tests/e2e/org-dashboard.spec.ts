/**
 * Org Admin Dashboard & Settings E2E Tests
 *
 * Tests for the enterprise org admin dashboard at /org/[slug]/admin:
 * - Dashboard loads without errors
 * - Member count, reports, and recent activity cards render
 * - Organization settings section with name + slug inputs
 * - Name change saves and restores original
 * - Slug auto-derives from name changes
 * - No uncaught JS errors during navigation
 *
 * Auth: enterprise-user.json (pre-authenticated enterprise tier user)
 * Org:  test-broker2
 */

import { test, expect } from "@playwright/test";
import path from "path";

// ============================================================================
// Test Configuration
// ============================================================================

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");
const ORG_SLUG = "test-broker2";
const DASHBOARD_URL = `/org/${ORG_SLUG}/admin`;

test.use({ storageState: authFile });

// ============================================================================
// Helpers
// ============================================================================

/** Navigate to the org dashboard and wait for network to settle. */
async function goToDashboard(page: import("@playwright/test").Page) {
  await page.goto(DASHBOARD_URL);
  await page.waitForLoadState("networkidle");
}

/** Assert no "something went wrong" error banner is visible. */
async function assertNoErrorBanner(page: import("@playwright/test").Page) {
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
}

// ============================================================================
// Dashboard Load & Error-Free Rendering
// ============================================================================

test.describe("Org Admin Dashboard — Page Load", () => {
  test("dashboard loads without errors", async ({ page }) => {
    await goToDashboard(page);

    // Page title / heading should be visible
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 15_000,
    });

    await assertNoErrorBanner(page);
  });

  test("no uncaught JS errors on dashboard", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (error) => jsErrors.push(error.message));

    await goToDashboard(page);

    // Let the page settle
    await page.waitForTimeout(2_000);

    expect(jsErrors).toEqual([]);
  });
});

// ============================================================================
// Dashboard Cards
// ============================================================================

test.describe("Org Admin Dashboard — Cards", () => {
  test.beforeEach(async ({ page }) => {
    await goToDashboard(page);
  });

  test("shows member count card with a number", async ({ page }) => {
    // The MEMBERS card should be visible with a numeric value
    const membersHeading = page.getByText("MEMBERS");
    await expect(membersHeading.first()).toBeVisible({ timeout: 15_000 });

    // The card should contain a number (the member count) — look for a large
    // numeral rendered as the stat value (e.g. "3", "12", etc.)
    const membersCard = page
      .locator("div")
      .filter({ hasText: /^MEMBERS/ })
      .first()
      .locator("..");
    await expect(membersCard.locator("p.text-3xl").first()).toBeVisible();
    const countText = await membersCard
      .locator("p.text-3xl")
      .first()
      .textContent();
    expect(countText).toMatch(/^\d+$/);

    await assertNoErrorBanner(page);
  });

  test("shows reports card", async ({ page }) => {
    const reportsHeading = page.getByText("REPORTS THIS MONTH");
    await expect(reportsHeading.first()).toBeVisible({ timeout: 15_000 });

    await assertNoErrorBanner(page);
  });

  test("shows recent activity card", async ({ page }) => {
    const activityHeading = page.getByText("RECENT ACTIVITY");
    await expect(activityHeading.first()).toBeVisible({ timeout: 15_000 });

    await assertNoErrorBanner(page);
  });
});

// ============================================================================
// Organization Settings Section
// ============================================================================

test.describe("Org Admin Dashboard — Settings", () => {
  test.beforeEach(async ({ page }) => {
    await goToDashboard(page);
  });

  test("organization settings section visible with name and slug inputs", async ({
    page,
  }) => {
    // Settings heading
    await expect(page.getByText("ORGANIZATION SETTINGS").first()).toBeVisible({
      timeout: 15_000,
    });

    // Name input
    const nameLabel = page.getByText("Organization Name");
    await expect(nameLabel.first()).toBeVisible();
    const nameInput = page
      .locator("label")
      .filter({ hasText: /organization name/i })
      .locator("..")
      .locator("input")
      .first();
    await expect(nameInput).toBeVisible();

    // Slug input
    const slugLabel = page.getByText("URL Slug");
    await expect(slugLabel.first()).toBeVisible();
    const slugInput = page
      .locator("label")
      .filter({ hasText: /url slug/i })
      .locator("..")
      .locator("input")
      .first();
    await expect(slugInput).toBeVisible();

    await assertNoErrorBanner(page);
  });

  test("org name change saves and shows success message, then restores original", async ({
    page,
  }) => {
    // Grab the current org name from the input
    const nameInput = page
      .locator("label")
      .filter({ hasText: /organization name/i })
      .locator("..")
      .locator("input")
      .first();
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    const originalName = await nameInput.inputValue();

    // Change the name to something temporary
    const tempName = `${originalName} E2E`;
    await nameInput.clear();
    await nameInput.fill(tempName);

    // Click Save Changes
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for success message
    await expect(page.getByText(/settings saved/i).first()).toBeVisible({
      timeout: 10_000,
    });

    await assertNoErrorBanner(page);

    // Restore the original name
    await page.waitForLoadState("networkidle");
    const nameInputAfter = page
      .locator("label")
      .filter({ hasText: /organization name/i })
      .locator("..")
      .locator("input")
      .first();
    await nameInputAfter.clear();
    await nameInputAfter.fill(originalName);

    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/settings saved/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("slug auto-updates when name changes", async ({ page }) => {
    const nameInput = page
      .locator("label")
      .filter({ hasText: /organization name/i })
      .locator("..")
      .locator("input")
      .first();
    const slugInput = page
      .locator("label")
      .filter({ hasText: /url slug/i })
      .locator("..")
      .locator("input")
      .first();

    await expect(nameInput).toBeVisible({ timeout: 15_000 });

    // Clear the name and type a new one — slug should auto-derive
    await nameInput.clear();
    await nameInput.fill("Acme Brokerage Test");

    const slugValue = await slugInput.inputValue();
    expect(slugValue).toBe("acme-brokerage-test");

    await assertNoErrorBanner(page);
  });
});
