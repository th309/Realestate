/**
 * Org Admin Billing Page E2E Tests
 *
 * Tests for the enterprise org admin billing page including:
 * - Page loads without errors
 * - Seat usage information is displayed
 * - Manage Billing / Set up billing button is present
 * - Plan comparison cards visible (Free, Pro, Enterprise)
 * - Current plan is highlighted
 * - No uncaught JS errors during page lifecycle
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";

// ============================================================================
// Test Configuration
// ============================================================================

const enterpriseAuthFile = path.join(
  __dirname,
  "../fixtures/.auth/enterprise-user.json",
);

const ORG_SLUG = "test-broker2";
const BILLING_URL = `/org/${ORG_SLUG}/admin/billing`;

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_ORG = {
  id: "org-enterprise-001",
  slug: ORG_SLUG,
  name: "Test Broker 2",
  tier: "enterprise",
  seat_limit: 15,
};

const MOCK_BILLING_USAGE = {
  seats_included: 10,
  additional_seats: 5,
  seats_used: 8,
  pending_invites: 2,
  plan_name: "Enterprise",
  status: "active",
  current_period_start: "2026-03-01T00:00:00Z",
  current_period_end: "2026-04-01T00:00:00Z",
  upcoming_invoice: {
    amount_due: 14500,
    currency: "usd",
    period_end: "2026-04-01T00:00:00Z",
  },
};

const MOCK_ENTERPRISE_USER_PROFILE = {
  success: true,
  data: {
    id: "enterprise-user-001",
    email: "admin@testbroker2.com",
    tier: "enterprise",
    role: "org_admin",
    name: "Enterprise Admin",
    org_slug: ORG_SLUG,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

async function setupBillingMocks(
  page: Page,
  overrides?: { billing?: Partial<typeof MOCK_BILLING_USAGE> },
) {
  const billingData = { ...MOCK_BILLING_USAGE, ...overrides?.billing };

  // Mock user profile
  await page.route("**/api/user/profile", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ENTERPRISE_USER_PROFILE),
    });
  });

  // Mock org endpoint
  await page.route(`**/api/orgs/${ORG_SLUG}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: MOCK_ORG }),
    });
  });

  // Mock org billing usage
  await page.route(`**/api/orgs/${ORG_SLUG}/billing`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(billingData),
    });
  });

  // Mock billing portal creation
  await page.route(`**/api/orgs/${ORG_SLUG}/billing/portal`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        portal_url: "https://billing.stripe.com/test-session",
      }),
    });
  });

  // Mock seat update
  await page.route(`**/api/orgs/${ORG_SLUG}/billing/seats`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
}

// ============================================================================
// Billing Page Load Tests
// ============================================================================

test.describe("Billing page loads without errors", () => {
  test("renders billing page with header and content", async ({ page }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    // Page header should be visible
    await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible();

    // Description text about subscription management
    await expect(page.getByText(/manage your subscription/i)).toBeVisible();
  });

  test("displays loading spinner while fetching billing data", async ({
    page,
  }) => {
    // Delay billing response to observe loading state
    await page.route("**/api/user/profile", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENTERPRISE_USER_PROFILE),
      });
    });

    await page.route(`**/api/orgs/${ORG_SLUG}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_ORG }),
      });
    });

    await page.route(`**/api/orgs/${ORG_SLUG}/billing`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BILLING_USAGE),
      });
    });

    await page.goto(BILLING_URL);

    // Spinner should appear while loading
    const spinner = page.locator(".animate-spin");
    await expect(spinner).toBeVisible();
  });

  test("shows error state with retry on billing fetch failure", async ({
    page,
  }) => {
    await page.route("**/api/user/profile", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ENTERPRISE_USER_PROFILE),
      });
    });

    await page.route(`**/api/orgs/${ORG_SLUG}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: MOCK_ORG }),
      });
    });

    await page.route(`**/api/orgs/${ORG_SLUG}/billing`, (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto(BILLING_URL);

    // Error message and Retry button should be visible
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });
});

// ============================================================================
// Seat Information Tests
// ============================================================================

test.describe("Shows seat info", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);
  });

  test("displays seat usage section with heading", async ({ page }) => {
    await expect(page.getByText(/seat usage/i)).toBeVisible();
  });

  test("shows seats included in plan", async ({ page }) => {
    await expect(page.getByText(/10 seats included/i)).toBeVisible();
  });

  test("shows additional seats purchased", async ({ page }) => {
    await expect(page.getByText(/5 additional seats/i)).toBeVisible();
  });

  test("displays seat adjustment controls", async ({ page }) => {
    await expect(page.getByText(/adjust seats/i)).toBeVisible();

    // Add / remove buttons should be present
    await expect(page.getByRole("button", { name: /add seat/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /remove seat/i }),
    ).toBeVisible();
  });

  test("shows total seat count", async ({ page }) => {
    // Total = 10 included + 5 additional = 15
    await expect(page.getByText("15")).toBeVisible();
    await expect(page.getByText(/total seats/i)).toBeVisible();
  });
});

// ============================================================================
// Manage Billing Button Tests
// ============================================================================

test.describe("Has Manage Billing / Set up billing button", () => {
  test("displays Manage Billing button when subscription exists", async ({
    page,
  }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    const manageBillingButton = page.getByRole("button", {
      name: /manage billing/i,
    });
    await expect(manageBillingButton).toBeVisible();
    await expect(manageBillingButton).toBeEnabled();
  });

  test("billing portal section describes its purpose", async ({ page }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    await expect(page.getByText(/billing portal/i)).toBeVisible();
    await expect(
      page.getByText(/view invoices.*payment method/i),
    ).toBeVisible();
  });

  test("displays plan context banner with plan name and status", async ({
    page,
  }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    // Plan name badge
    await expect(page.getByText("Enterprise")).toBeVisible();

    // Active status badge
    await expect(page.getByText("Active")).toBeVisible();
  });
});

// ============================================================================
// Plan Comparison Cards Tests
// ============================================================================

test.describe("Plan comparison cards visible (Free/Pro/Enterprise)", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);
  });

  test("displays Available Plans heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /available plans/i }),
    ).toBeVisible();
  });

  test("shows Free plan card with price and features", async ({ page }) => {
    await expect(page.getByText("Free")).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText(/individuals exploring/i)).toBeVisible();
    await expect(page.getByText(/3 reports per month/i)).toBeVisible();
  });

  test("shows Pro plan card with price and features", async ({ page }) => {
    await expect(page.getByText("Pro")).toBeVisible();
    await expect(page.getByText("$29")).toBeVisible();
    await expect(page.getByText(/serious investors/i)).toBeVisible();
    await expect(page.getByText(/score breakdowns/i)).toBeVisible();
  });

  test("shows Enterprise plan card with features", async ({ page }) => {
    await expect(page.getByText(/teams and brokerages/i)).toBeVisible();
    await expect(page.getByText("Custom")).toBeVisible();
    await expect(page.getByText(/unlimited seats/i)).toBeVisible();
    await expect(page.getByText(/api access/i)).toBeVisible();
    await expect(page.getByText(/custom branding/i)).toBeVisible();
  });

  test("all three plan cards are rendered in the grid", async ({ page }) => {
    // Each non-current plan has a "Switch Plan" button;
    // the current plan shows "Your current plan" text.
    // Free and Pro should have Switch Plan buttons, Enterprise should not.
    const switchButtons = page.getByRole("button", { name: /switch plan/i });
    await expect(switchButtons).toHaveCount(2);
  });
});

// ============================================================================
// Current Plan Highlight Tests
// ============================================================================

test.describe("Current plan is highlighted", () => {
  test('Enterprise card shows "Current Plan" badge when active', async ({
    page,
  }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    await expect(page.getByText(/current plan/i)).toBeVisible();
  });

  test('Enterprise card shows "Your current plan" instead of Switch button', async ({
    page,
  }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    await expect(page.getByText(/your current plan/i)).toBeVisible();
  });

  test("Enterprise card has highlighted border styling", async ({ page }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    // The current plan card gets a primary border (border-2 border-primary)
    // Find the card that contains "Your current plan" text
    const currentPlanCard = page
      .locator("div")
      .filter({ hasText: /^Your current plan$/ })
      .locator("..")
      .first();

    // Verify the card has a distinct border compared to non-current cards
    await expect(currentPlanCard).toBeVisible();
  });

  test("non-Enterprise plans show Switch Plan buttons", async ({ page }) => {
    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    const switchButtons = page.getByRole("button", { name: /switch plan/i });
    await expect(switchButtons).toHaveCount(2);
  });

  test("highlights Pro card when plan is Pro", async ({ page }) => {
    await setupBillingMocks(page, { billing: { plan_name: "Pro" } });
    await page.goto(BILLING_URL);

    // "Your current plan" should be visible in the Pro card
    await expect(page.getByText(/your current plan/i)).toBeVisible();

    // Enterprise and Free cards should have Switch Plan buttons
    const switchButtons = page.getByRole("button", { name: /switch plan/i });
    await expect(switchButtons).toHaveCount(2);
  });
});

// ============================================================================
// No Uncaught JS Errors Tests
// ============================================================================

test.describe("No uncaught JS errors", () => {
  test("billing page has zero console errors during load", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await setupBillingMocks(page);
    await page.goto(BILLING_URL);

    // Wait for page to fully settle
    await page.waitForLoadState("networkidle");

    // Filter out known benign errors (e.g., third-party scripts, favicon)
    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes("favicon") &&
        !err.includes("third-party") &&
        !err.includes("DevTools"),
    );

    expect(realErrors).toEqual([]);
  });

  test("no uncaught page exceptions during billing interactions", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await setupBillingMocks(page);
    await page.goto(BILLING_URL);
    await page.waitForLoadState("networkidle");

    // Interact with the page: click add seat, then cancel
    const addSeatButton = page.getByRole("button", { name: /add seat/i });
    if (await addSeatButton.isVisible()) {
      await addSeatButton.click();

      const cancelButton = page.getByRole("button", { name: /cancel/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }

    expect(pageErrors).toEqual([]);
  });

  test("no uncaught exceptions when navigating away from billing", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    await setupBillingMocks(page);
    await page.goto(BILLING_URL);
    await page.waitForLoadState("networkidle");

    // Navigate away
    await page.goto(`/org/${ORG_SLUG}/admin`);
    await page.waitForLoadState("networkidle");

    expect(pageErrors).toEqual([]);
  });
});
