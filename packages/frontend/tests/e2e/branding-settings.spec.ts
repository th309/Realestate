/**
 * Branding Settings E2E Tests
 *
 * Tests the org branding admin page at /org/test-broker2/admin/branding.
 * Covers page load, all form sections, and basic field interaction.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Enterprise user auth fixture at tests/fixtures/.auth/enterprise-user.json
 */

import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

const ORG_SLUG = "test-broker2";
const BRANDING_URL = `/org/${ORG_SLUG}/admin/branding`;

test.describe("Branding Settings — Enterprise Org", () => {
  test.use({ storageState: authFile });
  test.setTimeout(20000);

  // ─── PAGE LOAD ──────────────────────────────────────────────────────────────

  test("branding page loads with heading and form sections", async ({
    page,
  }) => {
    await page.goto(BRANDING_URL);

    // The page heading is an h1 with text "Branding"
    await expect(
      page.getByRole("heading", { name: "Branding", exact: true }),
    ).toBeVisible({ timeout: 15000 });

    // Subtitle confirming this is the right page
    await expect(
      page.getByText(/customize how your organization appears/i),
    ).toBeVisible();
  });

  // ─── BUSINESS INFORMATION SECTION ───────────────────────────────────────────

  test("business info section is visible with phone, address, and managing broker fields", async ({
    page,
  }) => {
    await page.goto(BRANDING_URL);

    // Section heading
    await expect(
      page.getByRole("heading", { name: /business information/i }),
    ).toBeVisible({ timeout: 15000 });

    // Phone number input (type="tel")
    await expect(page.locator('input[type="tel"]')).toBeVisible();

    // Street address field (placeholder "Street address")
    await expect(page.getByPlaceholder("Street address")).toBeVisible();

    // Managing broker field
    await expect(page.getByPlaceholder(/broker name/i)).toBeVisible();
  });

  // ─── LOGO SECTION ───────────────────────────────────────────────────────────

  test("logo upload section is visible", async ({ page }) => {
    await page.goto(BRANDING_URL);
    await page.waitForLoadState("networkidle");

    // The LogoUploader component renders inside a card — look for any upload cue
    // (text like "Upload", "Logo", or a file input)
    const logoArea = page
      .getByText(/logo/i)
      .or(page.locator('input[type="file"]'));
    await expect(logoArea.first()).toBeVisible({ timeout: 15000 });
  });

  // ─── ACCENT COLOR PICKER ─────────────────────────────────────────────────────

  test("accent color picker is visible", async ({ page }) => {
    await page.goto(BRANDING_URL);
    await page.waitForLoadState("networkidle");

    // AccentColorPicker renders a color input or a hex text input
    const colorInput = page
      .locator('input[type="color"]')
      .or(page.getByText(/accent color/i));
    await expect(colorInput.first()).toBeVisible({ timeout: 15000 });
  });

  // ─── WHITE-LABEL SECTIONS ────────────────────────────────────────────────────

  test("report branding section is visible", async ({ page }) => {
    await page.goto(BRANDING_URL);
    await page.waitForLoadState("networkidle");

    // ReportBrandingSection has heading with "Report" text
    await expect(
      page.getByText(/report.*branding|report.*document/i).first(),
    ).toBeVisible({
      timeout: 15000,
    });
  });

  test("email branding section is visible", async ({ page }) => {
    await page.goto(BRANDING_URL);
    await page.waitForLoadState("networkidle");

    // EmailBrandingSection heading
    await expect(page.getByText(/email branding/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("typography section is visible", async ({ page }) => {
    await page.goto(BRANDING_URL);
    await page.waitForLoadState("networkidle");

    // TypographySection renders font selects — look for "Typography" heading
    await expect(page.getByText(/typography/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("custom domain section is visible", async ({ page }) => {
    await page.goto(BRANDING_URL);
    await page.waitForLoadState("networkidle");

    // CustomDomainSection heading
    await expect(page.getByText(/custom domain/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  // ─── FIELD INTERACTION ───────────────────────────────────────────────────────

  test("can type into the phone number field", async ({ page }) => {
    await page.goto(BRANDING_URL);

    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.waitFor({ timeout: 15000 });

    // Clear existing value and type a test number
    await phoneInput.fill("(555) 987-6543");
    await expect(phoneInput).toHaveValue("(555) 987-6543");
  });
});
