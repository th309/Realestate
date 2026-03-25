/**
 * Org Admin Members Page E2E Tests
 *
 * Tests the /org/:slug/admin/members page including:
 * - Page load and basic rendering
 * - Seat usage bar display
 * - Member table structure and content
 * - Invite Member dialog
 * - Refresh functionality
 * - No uncaught JS errors
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";

// ============================================================================
// Test Configuration
// ============================================================================

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");
const ORG_SLUG = "test-broker2";
const BASE_PATH = `/org/${ORG_SLUG}/admin/members`;

const MOCK_ORG = {
  id: "org-001",
  name: "Test Broker 2",
  slug: ORG_SLUG,
  owner_id: "user-admin-001",
  seat_limit: 25,
  website_url: null,
  billing_status: "active",
  created_at: "2025-12-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
  role: "admin",
};

const MOCK_MEMBERS = {
  members: [
    {
      user_id: "user-admin-001",
      email: "admin@testbroker2.com",
      display_name: "Troy Hamilton",
      role: "admin",
      joined_at: "2025-12-01T00:00:00Z",
    },
    {
      user_id: "user-member-002",
      email: "agent@testbroker2.com",
      display_name: "Alice Johnson",
      role: "member",
      joined_at: "2026-01-15T00:00:00Z",
    },
    {
      user_id: "user-member-003",
      email: "broker@testbroker2.com",
      display_name: "Bob Chen",
      role: "member",
      joined_at: "2026-02-10T00:00:00Z",
    },
  ],
  total: 3,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Intercept org and member API calls with mock data so
 * the page renders predictably without a live backend.
 */
async function setupOrgMocks(page: Page) {
  // Mock org detail (used by OrgContextProvider)
  await page.route(`**/api/org/${ORG_SLUG}`, (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ORG),
      });
    } else {
      route.continue();
    }
  });

  // Mock members list
  await page.route(`**/api/org/${ORG_SLUG}/members`, (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_MEMBERS),
      });
    } else {
      route.continue();
    }
  });

  // Mock user profile (auth context)
  await page.route("**/api/user/profile", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "user-admin-001",
          email: "admin@testbroker2.com",
          tier: "enterprise",
          role: "admin",
          name: "Troy Hamilton",
        },
      }),
    });
  });
}

// ============================================================================
// Tests
// ============================================================================

test.describe("Org Admin Members Page", () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({ page }) => {
    await setupOrgMocks(page);
  });

  // --------------------------------------------------------------------------
  // 1. Members page loads without errors
  // --------------------------------------------------------------------------

  test("members page loads without errors", async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    // Page heading should be visible
    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    // Subheading text
    await expect(page.getByText(/manage your organization/i)).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 2. Shows seat usage bar with count
  // --------------------------------------------------------------------------

  test("shows seat usage bar with count", async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    // Wait for data to load
    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    // Seat usage text: "3 of 25 seats used"
    await expect(page.getByText(/3 of 25 seats used/i)).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 3. Table has headers: Member, Role, Status, Joined, Actions
  // --------------------------------------------------------------------------

  test("table has correct column headers", async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    // Wait for the table to render
    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });

    const headerRow = page.locator("thead tr");
    await expect(headerRow.getByText("Member")).toBeVisible();
    await expect(headerRow.getByText("Role")).toBeVisible();
    // Status and Joined are hidden on small screens; check they exist in DOM
    await expect(headerRow.getByText("Status")).toBeAttached();
    await expect(headerRow.getByText("Joined")).toBeAttached();
    await expect(headerRow.getByText("Actions")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 4. Current user appears with Admin badge and "(you)" indicator
  // --------------------------------------------------------------------------

  test('current user row shows Admin badge and "(you)" indicator', async ({
    page,
  }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });

    // The admin user row should contain the name, "(you)", and "Admin" badge
    const adminRow = page.locator("tr", { hasText: "Troy Hamilton" });
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByText("(you)")).toBeVisible();
    await expect(adminRow.getByText("Admin")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 5. Invite Member button opens dialog
  // --------------------------------------------------------------------------

  test("Invite Member button opens dialog", async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    // Click the Invite Member button
    await page.getByRole("button", { name: /invite member/i }).click();

    // Dialog heading should appear
    await expect(
      page.getByRole("heading", { name: /invite member/i }),
    ).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 6. Dialog has email, first name, last name fields
  // --------------------------------------------------------------------------

  test("invite dialog has email, first name, and last name fields", async ({
    page,
  }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /invite member/i }).click();

    // Email field
    await expect(page.locator("#invite-email")).toBeVisible();

    // First name field
    await expect(page.locator("#invite-first-name")).toBeVisible();

    // Last name field
    await expect(page.locator("#invite-last-name")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 7. Dialog has Member and Admin role buttons
  // --------------------------------------------------------------------------

  test("invite dialog has Member and Admin role buttons", async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /invite member/i }).click();

    // Wait for dialog to fully render
    await expect(
      page.getByRole("heading", { name: /invite member/i }),
    ).toBeVisible();

    // Role buttons within the dialog
    const dialog = page.locator(".fixed.inset-0");
    await expect(
      dialog.getByRole("button", { name: "Member", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Admin", exact: true }),
    ).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 8. Dialog cancel closes it
  // --------------------------------------------------------------------------

  test("dialog Cancel button closes the dialog", async ({ page }) => {
    await page.goto(BASE_PATH, { waitUntil: "load" });

    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    // Open dialog
    await page.getByRole("button", { name: /invite member/i }).click();
    await expect(
      page.getByRole("heading", { name: /invite member/i }),
    ).toBeVisible();

    // Click Cancel
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    // Dialog heading should no longer be visible
    await expect(
      page.getByRole("heading", { name: /invite member/i }),
    ).not.toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 9. Refresh button reloads the list (no crash)
  // --------------------------------------------------------------------------

  test("refresh button reloads the member list without crashing", async ({
    page,
  }) => {
    let fetchCount = 0;

    // Override the members mock to count calls
    await page.route(`**/api/org/${ORG_SLUG}/members`, (route) => {
      if (route.request().method() === "GET") {
        fetchCount++;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_MEMBERS),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(BASE_PATH, { waitUntil: "load" });

    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });

    const initialCount = fetchCount;

    // Click the refresh button (aria-label="Refresh members")
    await page.getByLabel("Refresh members").click();

    // Wait for the table to be visible again after refresh
    await expect(page.locator("table")).toBeVisible();

    // Should have made at least one additional fetch
    expect(fetchCount).toBeGreaterThan(initialCount);

    // Members should still be rendered
    await expect(page.getByText("Troy Hamilton")).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 10. No uncaught JS errors
  // --------------------------------------------------------------------------

  test("no uncaught JavaScript errors on the page", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto(BASE_PATH, { waitUntil: "load" });

    // Wait for the page to fully render
    await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
      timeout: 15_000,
    });

    // Wait a bit for any async errors to surface
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });
});
