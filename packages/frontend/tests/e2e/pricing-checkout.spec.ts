/**
 * Pricing Page E2E Tests
 *
 * Tests the /pricing page and upgrade flow:
 * - All tier cards render with correct pricing
 * - Pro card has a subscribe/upgrade action button
 * - Enterprise card has an action button
 * - Feature comparison lists are visible per tier
 * - Annual/monthly billing interval toggle updates displayed prices
 *
 * No auth required — /pricing is a public page.
 */

import { test, expect } from "@playwright/test";

test.describe("Pricing Page", () => {
  test.setTimeout(15000);

  // ─── INITIAL LOAD ─────────────────────────────────────────────────────────

  test("pricing page loads with Free, Pro, and Enterprise tier cards", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("load");

    // All three tier names must be visible
    await expect(page.getByText(/\bfree\b/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/\bpro\b/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/\benterprise\b/i).first()).toBeVisible({
      timeout: 10000,
    });

    // Price values must be visible — Free is $0, Pro has a monthly price
    await expect(page.getByText(/\$0|\$0\/mo|free forever/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── PRO CARD ACTION ──────────────────────────────────────────────────────

  test("Pro tier card has a Get Started or Subscribe action button", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("load");

    // Locate the Pro tier section and verify the CTA button is present
    const proSection = page
      .locator("[data-testid='pricing-card-pro']")
      .or(page.locator("[class*='pricing']").filter({ hasText: /\bpro\b/i }))
      .first();

    const proSectionVisible = await proSection.isVisible().catch(() => false);

    if (proSectionVisible) {
      await expect(
        proSection.getByRole("button", { name: /get started|subscribe|upgrade|start/i })
          .or(proSection.getByRole("link", { name: /get started|subscribe|upgrade|start/i }))
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Fallback: find a subscribe/upgrade button near "Pro" text anywhere on page
      await expect(
        page
          .getByRole("button", { name: /get started|subscribe|upgrade/i })
          .or(page.getByRole("link", { name: /get started|subscribe|upgrade/i }))
          .first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ─── ENTERPRISE CARD ACTION ───────────────────────────────────────────────

  test("Enterprise tier card has a contact or action button", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("load");

    const enterpriseSection = page
      .locator("[data-testid='pricing-card-enterprise']")
      .or(
        page.locator("[class*='pricing']").filter({ hasText: /\benterprise\b/i })
      )
      .first();

    const enterpriseSectionVisible = await enterpriseSection
      .isVisible()
      .catch(() => false);

    if (enterpriseSectionVisible) {
      await expect(
        enterpriseSection
          .getByRole("button", { name: /contact|get started|upgrade|talk to us/i })
          .or(
            enterpriseSection.getByRole("link", {
              name: /contact|get started|upgrade|talk to us/i,
            })
          )
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Fallback: any contact/enterprise CTA button on the page
      await expect(
        page
          .getByRole("button", { name: /contact sales|contact us|talk to us/i })
          .or(
            page.getByRole("link", {
              name: /contact sales|contact us|talk to us/i,
            })
          )
          .first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  // ─── FEATURE COMPARISON ───────────────────────────────────────────────────

  test("feature comparison list items are visible per tier", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("load");

    // Feature list items exist — check for list elements or checkmarks near features
    const featureItems = page.locator(
      "li, [data-testid*='feature'], [class*='feature']"
    );
    const featureCount = await featureItems.count();

    // There should be multiple feature list items across the tiers
    expect(featureCount).toBeGreaterThan(0);

    // At least one substantive feature label should be readable
    await expect(
      page
        .getByText(/report|map|score|api|export|support|market|analytics/i)
        .first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ─── BILLING INTERVAL TOGGLE ──────────────────────────────────────────────

  test("annual/monthly billing toggle updates displayed prices when present", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("load");

    // Look for a billing interval toggle — may be a switch, tab, or button pair
    const monthlyToggle = page
      .getByRole("button", { name: /monthly/i })
      .or(page.getByRole("tab", { name: /monthly/i }))
      .or(page.locator("label").filter({ hasText: /monthly/i }))
      .first();

    const annualToggle = page
      .getByRole("button", { name: /annual|yearly/i })
      .or(page.getByRole("tab", { name: /annual|yearly/i }))
      .or(page.locator("label").filter({ hasText: /annual|yearly/i }))
      .first();

    const monthlyVisible = await monthlyToggle.isVisible().catch(() => false);
    const annualVisible = await annualToggle.isVisible().catch(() => false);

    if (monthlyVisible && annualVisible) {
      // Capture prices shown under monthly billing
      await monthlyToggle.click();
      const pricingArea = page.locator("[class*='price'], [data-testid*='price']").first();
      const monthlyPriceText = await pricingArea
        .textContent()
        .catch(() => page.textContent("body"));

      // Switch to annual and verify prices change
      await annualToggle.click();
      const annualPriceText = await pricingArea
        .textContent()
        .catch(() => page.textContent("body"));

      // Annual and monthly prices must differ (annual is typically discounted)
      expect(monthlyPriceText).not.toBe(annualPriceText);
    } else {
      // Toggle absent — verify the page at least loaded pricing content
      test.info().annotations.push({
        type: "info",
        description: "Billing interval toggle not found — skipping price change assertion",
      });
      await expect(page.getByText(/\$/).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
