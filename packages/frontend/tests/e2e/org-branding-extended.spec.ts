/**
 * Org Admin Branding Page E2E Tests — Extended Sections
 *
 * Tests 10-17: email branding, typography, client experience,
 * custom domain, Quinn (Coming Soon), save flow, and JS error check.
 *
 * Core sections (page load, business info, logo, accent color,
 * website URL, report branding, white-label) are in org-branding.spec.ts.
 */

import { test, expect } from "@playwright/test";
import {
  navigateToBranding,
  setupBrandingMocks,
  MOCK_BRANDING_RESPONSE,
  MOCK_ORG_RESPONSE,
  ORG_SLUG,
  BASE_PATH,
} from "../fixtures/org-branding-mocks";

// ============================================================================
// Tests
// ============================================================================

test.describe("Org Branding — Extended Sections", () => {
  test.setTimeout(60_000);

  // 10. Email branding section has from-name and reply-to fields
  test("email branding section has from-name and reply-to fields", async ({
    page,
  }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Email Branding").first()).toBeVisible();

    await expect(page.getByText("From Name").first()).toBeVisible();
    await expect(
      page.locator('input[placeholder="Acme Realty Analytics"]'),
    ).toBeVisible();

    await expect(page.getByText("Reply-To Email").first()).toBeVisible();
    await expect(
      page.locator('input[placeholder="replies@yourbrokerage.com"]'),
    ).toBeVisible();
  });

  // 11. Typography section has 2 font dropdowns
  test("typography section has 2 font dropdowns", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Typography").first()).toBeVisible();
    await expect(page.getByText("Primary Font").first()).toBeVisible();
    await expect(page.getByText("Secondary Font").first()).toBeVisible();

    const fontSelects = page.locator("select").filter({
      has: page.locator("option", { hasText: "Default (Roboto)" }),
    });
    const selectCount = await fontSelects.count();
    expect(selectCount).toBe(2);

    const firstSelect = fontSelects.first();
    await expect(
      firstSelect.locator("option", { hasText: "Inter" }),
    ).toBeAttached();
    await expect(
      firstSelect.locator("option", { hasText: "Montserrat" }),
    ).toBeAttached();
    await expect(
      firstSelect.locator("option", { hasText: "Poppins" }),
    ).toBeAttached();
  });

  // 12. Client experience section has welcome message textarea
  test("client experience section has welcome message textarea", async ({
    page,
  }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Client Experience").first()).toBeVisible();
    await expect(page.getByText("Welcome Message").first()).toBeVisible();

    const welcomeTextarea = page.locator(
      'textarea[placeholder*="Welcome to our analytics platform"]',
    );
    await expect(welcomeTextarea).toBeVisible();
  });

  // 13. Client experience has ToS and privacy URL inputs
  test("client experience has ToS and privacy URL inputs", async ({ page }) => {
    await navigateToBranding(page);

    await expect(
      page.getByText("Custom Terms of Service URL").first(),
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="https://yourbrokerage.com/terms"]'),
    ).toBeVisible();

    await expect(
      page.getByText("Custom Privacy Policy URL").first(),
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="https://yourbrokerage.com/privacy"]'),
    ).toBeVisible();
  });

  // 14. Custom domain section is visible and interactive
  test("custom domain section is visible and interactive", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("Custom Domain").first()).toBeVisible();

    const domainInput = page.locator(
      'input[placeholder="analytics.yourbrokerage.com"]',
    );
    await expect(domainInput).toBeVisible();

    const addDomainButton = page.getByRole("button", { name: /add domain/i });
    await expect(addDomainButton).toBeVisible();
    await expect(addDomainButton).toBeDisabled();

    await domainInput.fill("analytics.testbroker.com");
    await expect(addDomainButton).toBeEnabled();
  });

  // 15. Quinn section shows as "Coming Soon"
  test("Quinn section shows as Coming Soon", async ({ page }) => {
    await navigateToBranding(page);

    await expect(page.getByText("QUINN AI ASSISTANT").first()).toBeVisible();
    await expect(page.getByText("Coming Soon").first()).toBeVisible();

    const botNameInput = page.locator('input[placeholder="Quinn"]');
    await expect(botNameInput).toBeVisible();
    await expect(botNameInput).toBeDisabled();

    const greetingTextarea = page.locator(
      'textarea[placeholder*="real estate market assistant"]',
    );
    await expect(greetingTextarea).toBeVisible();
    await expect(greetingTextarea).toBeDisabled();
  });

  // 16. Save button works — fill required fields, save, expect success
  test("save button works with required fields filled", async ({ page }) => {
    const emptyBranding = {
      ...MOCK_BRANDING_RESPONSE,
      phone: "",
      address: { street: "", city: "", state: "", zip: "" },
    };

    await page.route(`**/api/orgs/${ORG_SLUG}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_ORG_RESPONSE }),
      });
    });

    await page.route(`**/api/orgs/${ORG_SLUG}/branding`, (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: emptyBranding }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: MOCK_BRANDING_RESPONSE }),
        });
      }
    });

    await page.route("**/api/user/profile", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "enterprise-user-001",
            email: "admin@testbroker.com",
            tier: "enterprise",
            role: "org_admin",
            name: "Enterprise Admin",
          },
        }),
      });
    });

    await page.route(`**/api/orgs/${ORG_SLUG}/custom-domain`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { cname_target: "propertyiq.up.railway.app" },
        }),
      });
    });

    await page.goto(BASE_PATH, { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: /branding/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeVisible();

    // Fill required fields
    await page.locator('input[type="tel"]').fill("(555) 999-0000");
    await page
      .locator('input[placeholder="Street address"]')
      .fill("200 Test Ave");
    await page.locator('input[placeholder="City"]').fill("Dallas");

    const stateSelect = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "State" }) })
      .first();
    await stateSelect.selectOption("TX");

    await page.locator('input[placeholder="ZIP"]').fill("75201");

    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByText("Changes saved").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  // 17. No uncaught JS errors during full page interaction
  test("no uncaught JS errors during page interaction", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await navigateToBranding(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const toggle = page.locator('button[role="switch"]');
    if (await toggle.isVisible()) {
      await toggle.click();
    }

    const hexInput = page.locator('input[aria-label="Custom hex color"]');
    if (await hexInput.isVisible()) {
      await hexInput.fill("#ff5500");
    }

    expect(pageErrors).toHaveLength(0);
  });
});
