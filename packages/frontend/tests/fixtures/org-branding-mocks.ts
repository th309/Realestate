/**
 * Shared mock data and helpers for org-branding E2E tests.
 *
 * Used by:
 *   - tests/e2e/org-branding.spec.ts  (sections 1-9)
 *   - tests/e2e/org-branding-extended.spec.ts  (sections 10-17)
 */

import { expect, type Page } from "@playwright/test";

// ============================================================================
// Constants
// ============================================================================

export const ORG_SLUG = "test-broker2";
export const BASE_PATH = `/org/${ORG_SLUG}/admin/branding`;

// ============================================================================
// Mock Payloads
// ============================================================================

export const MOCK_BRANDING_RESPONSE = {
  accent_color: "#2563eb",
  website_url: "https://testbroker.com",
  phone: "(555) 123-4567",
  address: {
    street: "100 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
  },
  managing_broker: "Jane Doe",
  logo_url: null,
  report_header_text: "",
  report_footer_text: "",
  report_disclaimer: "",
  powered_by_visible: true,
  display_name: "",
  support_email: "",
  tab_title_format: "",
  email_from_name: "",
  email_reply_to: "",
  primary_font: "",
  secondary_font: "",
  welcome_message: "",
  custom_tos_url: "",
  custom_privacy_url: "",
  custom_subdomain: "",
  custom_domain_status: null,
  custom_domain_verified_at: null,
  quinn_bot_name: "",
  quinn_greeting: "",
};

export const MOCK_ORG_RESPONSE = {
  id: "org-test-broker2",
  slug: ORG_SLUG,
  name: "Test Broker 2",
  tier: "enterprise",
};

const MOCK_USER_PROFILE = {
  id: "enterprise-user-001",
  email: "admin@testbroker.com",
  tier: "enterprise",
  role: "org_admin",
  name: "Enterprise Admin",
};

// ============================================================================
// Helpers
// ============================================================================

/** Set up API mocks for the branding page load. */
export async function setupBrandingMocks(page: Page) {
  await page.route(`**/api/orgs/${ORG_SLUG}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: MOCK_ORG_RESPONSE }),
    });
  });

  await page.route(`**/api/orgs/${ORG_SLUG}/branding`, (route) => {
    const method = route.request().method();
    if (method === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_BRANDING_RESPONSE }),
      });
    } else if (method === "PATCH" || method === "PUT") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_BRANDING_RESPONSE }),
      });
    } else {
      route.continue();
    }
  });

  await page.route("**/api/user/profile", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: MOCK_USER_PROFILE }),
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
}

/** Navigate to branding page with mocks and wait for form to load. */
export async function navigateToBranding(page: Page) {
  await setupBrandingMocks(page);
  await page.goto(BASE_PATH, { waitUntil: "load" });
  await expect(
    page.getByRole("heading", { name: /branding/i }).first(),
  ).toBeVisible({ timeout: 15_000 });
}
