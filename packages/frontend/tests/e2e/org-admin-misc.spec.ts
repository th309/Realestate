/**
 * Org Admin Miscellaneous E2E Tests
 *
 * Tests for enterprise org admin pages that don't warrant their own spec:
 * - API Keys page (load + create/disabled states)
 * - Embed Tokens page (load + create/disabled states)
 * - Audit Log page (table, filters, date inputs)
 * - Sidebar navigation (all 7 links resolve correctly)
 * - User dropdown (enterprise "Organization" link on /map)
 * - Cross-page error sweep (no "Something went wrong" on any admin page)
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";

// ============================================================================
// Test Configuration
// ============================================================================

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");
const ORG_SLUG = "test-broker2";
const BASE = `/org/${ORG_SLUG}/admin`;

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_ORG = {
  id: "org-001",
  name: "Test Broker 2",
  slug: ORG_SLUG,
  owner_id: "user-001",
  seat_limit: 25,
  website_url: "https://testbroker2.com",
  billing_status: "active",
  role: "admin",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
};

const MOCK_AUDIT_ENTRIES = {
  entries: [
    {
      id: "audit-001",
      organization_id: MOCK_ORG.id,
      action: "member_invited",
      actor_id: "admin@testbroker2.com",
      target_type: "member",
      target_id: "user-002",
      details: { target_email: "agent@testbroker2.com" },
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "audit-002",
      organization_id: MOCK_ORG.id,
      action: "billing_updated",
      actor_id: "admin@testbroker2.com",
      target_type: "billing",
      target_id: null,
      details: { plan: "enterprise" },
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "audit-003",
      organization_id: MOCK_ORG.id,
      action: "role_changed",
      actor_id: "admin@testbroker2.com",
      target_type: "member",
      target_id: "user-003",
      details: {
        target_email: "manager@testbroker2.com",
        from: "member",
        to: "admin",
      },
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
  ],
  nextCursor: null,
};

const MOCK_API_KEYS: never[] = [];
const MOCK_EMBED_TOKENS: never[] = [];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Set up route mocks for the org admin pages.
 * Mocks the org fetch, slug resolver, and page-specific API endpoints.
 */
async function setupOrgAdminMocks(page: Page) {
  // Org slug resolver (layout calls this server-side, but also mock for safety)
  await page.route(`**/api/org/resolve-slug/${ORG_SLUG}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ slug: ORG_SLUG }),
    });
  });

  // Org data (OrgContextProvider)
  await page.route(`**/api/org/${ORG_SLUG}`, (route) => {
    // Only match the exact org fetch, not sub-paths
    const url = route.request().url();
    const orgPathRegex = new RegExp(`/api/org/${ORG_SLUG}$`);
    if (orgPathRegex.test(url)) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ORG),
      });
    } else {
      route.continue();
    }
  });

  // API keys
  await page.route(`**/api/org/${ORG_SLUG}/api-keys`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_API_KEYS),
    });
  });

  // Embed tokens
  await page.route(`**/api/org/${ORG_SLUG}/embed-tokens`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_EMBED_TOKENS),
    });
  });

  // Audit log
  await page.route(`**/api/org/${ORG_SLUG}/audit*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUDIT_ENTRIES),
    });
  });

  // Members
  await page.route(`**/api/org/${ORG_SLUG}/members*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ members: [], total: 0 }),
    });
  });

  // Billing usage
  await page.route(`**/api/org/${ORG_SLUG}/billing/usage`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        seats_used: 3,
        seat_limit: 25,
        reports_this_month: 12,
        report_limit: 100,
      }),
    });
  });

  // Branding
  await page.route(`**/api/org/${ORG_SLUG}/branding`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        primary_color: "#1a73e8",
        logo_url: null,
        org_id: MOCK_ORG.id,
      }),
    });
  });

  // Report stats (dashboard page)
  await page.route(`**/api/org/${ORG_SLUG}/reports/stats`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        current_month: 12,
        previous_month: 8,
        limit: 100,
        by_member: [],
      }),
    });
  });
}

// ============================================================================
// API Keys Page Tests
// ============================================================================

test.describe("API Keys Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupOrgAdminMocks(page);
  });

  test("page loads without errors", async ({ page }) => {
    await page.goto(`${BASE}/api-keys`);

    // Page heading renders
    await expect(page.getByRole("heading", { name: "API Keys" })).toBeVisible();

    // No error boundary
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  });

  test('shows create button OR "not enabled" message', async ({ page }) => {
    await page.goto(`${BASE}/api-keys`);

    // Either the "Create Key" button is visible (API enabled, empty list)
    // or the "not enabled" message is shown (API disabled on org)
    const createButton = page.getByRole("button", { name: /Create Key/i });
    const notEnabledMessage = page.getByText(/not enabled/i);

    await expect(createButton.or(notEnabledMessage)).toBeVisible();
  });
});

// ============================================================================
// Embed Tokens Page Tests
// ============================================================================

test.describe("Embed Tokens Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupOrgAdminMocks(page);
  });

  test("page loads without errors", async ({ page }) => {
    await page.goto(`${BASE}/embeds`);

    // Page heading renders
    await expect(
      page.getByRole("heading", { name: "Embed Tokens" }),
    ).toBeVisible();

    // No error boundary
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  });

  test('shows create button OR "not enabled" message', async ({ page }) => {
    await page.goto(`${BASE}/embeds`);

    // Either the "Create Token" button is visible (embeds enabled, empty list)
    // or the "not enabled" message is shown (embeds disabled on org)
    const createButton = page.getByRole("button", { name: /Create Token/i });
    const notEnabledMessage = page.getByText(/not enabled/i);

    await expect(createButton.or(notEnabledMessage)).toBeVisible();
  });
});

// ============================================================================
// Audit Log Page Tests
// ============================================================================

test.describe("Audit Log Page", () => {
  test.beforeEach(async ({ page }) => {
    await setupOrgAdminMocks(page);
    await page.goto(`${BASE}/audit`);
  });

  test("page loads with table showing Action and Actor columns", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Audit Log" }),
    ).toBeVisible();

    // Table header columns
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("Action")).toBeVisible();
    await expect(table.getByText("Actor")).toBeVisible();
  });

  test("filter dropdown exists", async ({ page }) => {
    // The action filter is a <select> with "All Actions" as default option
    const filterSelect = page.locator("select");
    await expect(filterSelect).toBeVisible();
    await expect(filterSelect).toContainText("All Actions");
  });

  test("date range inputs exist", async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
  });

  test("selecting a filter does not crash the page", async ({ page }) => {
    const filterSelect = page.locator("select");
    await filterSelect.selectOption({ label: "Member Events" });

    // Page should still be functional — heading still visible, no error boundary
    await expect(
      page.getByRole("heading", { name: "Audit Log" }),
    ).toBeVisible();
    await expect(page.getByText("Something went wrong")).not.toBeVisible();
  });

  test("clear filters button works when filters are active", async ({
    page,
  }) => {
    // Apply a filter first
    const filterSelect = page.locator("select");
    await filterSelect.selectOption({ label: "Billing" });

    // "Clear filters" button should appear
    const clearButton = page.getByText("Clear filters");
    await expect(clearButton).toBeVisible();

    // Click it
    await clearButton.click();

    // Filter should reset to default "All Actions"
    await expect(filterSelect).toHaveValue("");

    // "Clear filters" should no longer be visible
    await expect(clearButton).not.toBeVisible();
  });
});

// ============================================================================
// Sidebar Navigation Tests
// ============================================================================

test.describe("Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await setupOrgAdminMocks(page);
  });

  const sidebarLinks = [
    { label: "Dashboard", path: `${BASE}` },
    { label: "Members", path: `${BASE}/members` },
    { label: "Billing", path: `${BASE}/billing` },
    { label: "Branding", path: `${BASE}/branding` },
    { label: "API Keys", path: `${BASE}/api-keys` },
    { label: "Embeds", path: `${BASE}/embeds` },
    { label: "Audit Log", path: `${BASE}/audit` },
  ];

  for (const link of sidebarLinks) {
    test(`sidebar link "${link.label}" navigates to correct page`, async ({
      page,
    }) => {
      // Start from the dashboard to ensure sidebar is rendered
      await page.goto(BASE);

      // Find the sidebar link and click it
      const sidebarLink = page.locator("nav a", { hasText: link.label });
      await expect(sidebarLink).toBeVisible();
      await sidebarLink.click();

      // Verify navigation landed on the correct URL
      await page.waitForURL(`**${link.path}`);

      // Verify no error boundary rendered
      await expect(page.getByText("Something went wrong")).not.toBeVisible();
    });
  }
});

// ============================================================================
// User Dropdown Tests
// ============================================================================

test.describe("User Dropdown", () => {
  test('user menu on /map shows "Organization" link for enterprise users', async ({
    page,
  }) => {
    // Mock user profile as enterprise tier with org
    await page.route("**/api/user/profile", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: "user-001",
            email: "admin@testbroker2.com",
            tier: "enterprise",
            role: "user",
            name: "Enterprise Admin",
          },
        }),
      });
    });

    // Mock the org membership lookup so Header knows the org slug
    await page.route("**/api/user/org", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          slug: ORG_SLUG,
          name: MOCK_ORG.name,
          role: "admin",
        }),
      });
    });

    // Mock entitlements/tier endpoint
    await page.route("**/api/entitlements**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tier: "enterprise" }),
      });
    });

    await page.goto("/map");

    // Open user menu
    const userMenu = page.getByTestId("user-menu");
    await expect(userMenu).toBeVisible();
    await userMenu.click();

    // "Organization" link should be visible in the dropdown
    const orgLink = page.getByRole("link", { name: "Organization" });
    await expect(orgLink).toBeVisible();

    // It should point to the org admin page
    await expect(orgLink).toHaveAttribute("href", `/org/${ORG_SLUG}/admin`);
  });
});

// ============================================================================
// Cross-Page Error Sweep
// ============================================================================

test.describe("Cross-Page Error Sweep", () => {
  test('all 7 admin pages load without "Something went wrong"', async ({
    page,
  }) => {
    await setupOrgAdminMocks(page);

    const adminPages = [
      { name: "Dashboard", path: BASE },
      { name: "Members", path: `${BASE}/members` },
      { name: "Billing", path: `${BASE}/billing` },
      { name: "Branding", path: `${BASE}/branding` },
      { name: "API Keys", path: `${BASE}/api-keys` },
      { name: "Embeds", path: `${BASE}/embeds` },
      { name: "Audit Log", path: `${BASE}/audit` },
    ];

    for (const adminPage of adminPages) {
      await page.goto(adminPage.path);

      // Wait for the page to settle (org context loads async)
      await page.waitForLoadState("networkidle");

      // Assert no error boundary
      const errorText = page.getByText("Something went wrong");
      await expect(errorText).not.toBeVisible();
    }
  });
});
