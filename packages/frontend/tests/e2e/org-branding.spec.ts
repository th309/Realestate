/**
 * Org Admin Branding Page E2E Tests — Core Sections
 *
 * Tests 1-9: page load, business info, logo uploader, accent color,
 * website URL, report branding, and white-label settings.
 *
 * Extended sections (email, typography, client experience, domain,
 * Quinn, save flow) are in org-branding-extended.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { navigateToBranding } from "../fixtures/org-branding-mocks";

// ============================================================================
// Tests
// ============================================================================

test.describe("Org Branding — Core Sections", () => {
  test.setTimeout(60_000);

  // 1. Page loads without errors
  test("branding page loads without errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await navigateToBranding(page);

    await expect(
      page.getByRole("heading", { name: /branding/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/customize how your organization appears/i).first(),
    ).toBeVisible();

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("hydration"),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // 2. Business Info section has phone, street, city, state, zip
  test("Business Info section has phone, street, city, state, zip fields", async ({
    page,
  }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Business Information").first()).toBeVisible();

    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toHaveAttribute("placeholder", "(555) 123-4567");

    const streetInput = page.locator('input[placeholder="Street address"]');
    await expect(streetInput).toBeVisible();

    const cityInput = page.locator('input[placeholder="City"]');
    await expect(cityInput).toBeVisible();

    const stateSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "State" }) });
    await expect(stateSelect.first()).toBeVisible();

    const zipInput = page.locator('input[placeholder="ZIP"]');
    await expect(zipInput).toBeVisible();
  });

  // 3. Managing broker field is visible
  test("managing broker field is visible", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Managing Broker").first()).toBeVisible();
    const brokerInput = page.locator(
      'input[placeholder="Broker name (optional)"]',
    );
    await expect(brokerInput).toBeVisible();
  });

  // 4. Logo uploader section exists
  test("logo uploader section exists", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Logo").first()).toBeVisible();
    await expect(
      page.getByText(/drag and drop an image/i).first(),
    ).toBeVisible();

    const fileInput = page.locator('input[type="file"][accept*="image"]');
    await expect(fileInput).toBeAttached();
  });

  // 5. Accent color picker exists
  test("accent color picker exists", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Accent Color").first()).toBeVisible();

    const colorButtons = page.locator('button[aria-label*="accent color"]');
    await expect(colorButtons.first()).toBeVisible();
    const count = await colorButtons.count();
    expect(count).toBe(8);

    const hexInput = page.locator('input[aria-label="Custom hex color"]');
    await expect(hexInput).toBeVisible();
  });

  // 6. Website URL input exists
  test("website URL input exists", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Website URL").first()).toBeVisible();
    const urlInput = page.locator(
      'input[type="url"][placeholder="https://yourcompany.com"]',
    );
    await expect(urlInput).toBeVisible();
  });

  // 7. Report branding section has header, footer, disclaimer textareas
  test("report branding section has header, footer, disclaimer textareas", async ({
    page,
  }) => {
    await navigateToBranding(page);

    await expect(
      page.getByText("Report & Document Branding").first(),
    ).toBeVisible();

    await expect(page.getByText("Report Header Text").first()).toBeVisible();
    await expect(
      page.locator('textarea[placeholder*="Prepared by"]'),
    ).toBeVisible();

    await expect(page.getByText("Report Footer Text").first()).toBeVisible();
    await expect(
      page.locator('textarea[placeholder*="All rights reserved"]'),
    ).toBeVisible();

    await expect(page.getByText("Report Disclaimer").first()).toBeVisible();
    await expect(
      page.locator('textarea[placeholder*="Legal disclaimer"]'),
    ).toBeVisible();
  });

  // 8. White label section has powered-by toggle
  test("white label section has powered-by toggle", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("White Label Settings").first()).toBeVisible();
    await expect(
      page.getByText(/Powered by PropertyIQ/i).first(),
    ).toBeVisible();

    const toggle = page.locator('button[role="switch"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  // 9. White label section has display name and support email
  test("white label section has display name and support email", async ({
    page,
  }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Display Name").first()).toBeVisible();
    await expect(
      page.locator('input[placeholder="Your Brokerage Name"]'),
    ).toBeVisible();

    await expect(page.getByText("Support Email").first()).toBeVisible();
    await expect(
      page.locator('input[placeholder="support@yourbrokerage.com"]'),
    ).toBeVisible();
  });
});
