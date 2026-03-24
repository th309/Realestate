/**
 * Enterprise Admin Portal E2E Tests
 *
 * Validates page rendering, navigation, and access control for the
 * organization admin portal at /org/[slug]/admin/*.
 *
 * Prerequisites:
 * - Frontend dev server running on port 3000
 * - Backend dev server running on port 3001
 * - Test org seeded via seed-test-org.ts (slug: test-brokerage-e2e)
 * - Env vars: TEST_ADMIN_EMAIL, TEST_MEMBER_EMAIL, TEST_OUTSIDER_EMAIL,
 *   TEST_USER_PASSWORD
 */

import { test, expect, type Page } from "@playwright/test";

// ============================================================================
// Test Configuration
// ============================================================================

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const ORG_SLUG = "test-brokerage-e2e";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const MEMBER_EMAIL = process.env.TEST_MEMBER_EMAIL || "";
const OUTSIDER_EMAIL = process.env.TEST_OUTSIDER_EMAIL || "";
const USER_PASSWORD = process.env.TEST_USER_PASSWORD || "";

/** Default timeout for waiting on navigation and element visibility. */
const DEFAULT_TIMEOUT = 15_000;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Log in via the Supabase auth sign-in page using email + password.
 * Waits for the post-login redirect before returning.
 */
async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/sign-in`);

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // After login the app redirects to map, dashboard, org page, or root
  await page.waitForURL(/\/(map|dashboard|org|$)/, {
    timeout: DEFAULT_TIMEOUT,
  });
}

/**
 * Navigate to an admin sub-page for the test org.
 * Waits for the main content area to stabilize.
 */
async function navigateToAdmin(page: Page, subPath = "") {
  const url = `${BASE_URL}/org/${ORG_SLUG}/admin${subPath}`;
  await page.goto(url);
}

// ============================================================================
// Tests: Admin Dashboard
// ============================================================================

test.describe("Enterprise Admin Portal", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  // --------------------------------------------------------------------------
  // 1. Admin can access dashboard
  // --------------------------------------------------------------------------
  test("admin can access the organization dashboard", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page);

    // The dashboard heading includes the org name or "Admin"
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(heading).toContainText(/admin/i);

    // Sidebar should be visible on desktop viewport
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  // --------------------------------------------------------------------------
  // 2. Dashboard shows member count
  // --------------------------------------------------------------------------
  test("dashboard displays member count", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page);

    // The OrgDashboardCards component has a "MEMBERS" card heading
    const membersCard = page.getByText("MEMBERS");
    await expect(membersCard).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // The seat usage bar renders "X of Y seats used"
    await expect(page.getByText(/\d+ of \d+ seats used/)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  });

  // --------------------------------------------------------------------------
  // 3. Members page loads with member list
  // --------------------------------------------------------------------------
  test("members page loads with a member table", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page, "/members");

    // Page heading
    await expect(page.locator("h1", { hasText: "Members" })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Member table should be visible with at least admin + member rows
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Header row + at least 2 data rows (admin + member)
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(2, { timeout: DEFAULT_TIMEOUT });
  });

  // --------------------------------------------------------------------------
  // 4. Invite dialog opens
  // --------------------------------------------------------------------------
  test("invite member dialog opens from members page", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page, "/members");

    // Click the "Invite Member" button
    const inviteButton = page.getByRole("button", { name: /invite member/i });
    await expect(inviteButton).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await inviteButton.click();

    // Dialog should appear with email input and role selector
    // Check for the dialog heading "Invite Member"
    await expect(page.locator("h2", { hasText: "Invite Member" })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Email input
    await expect(page.locator("#invite-email")).toBeVisible();

    // Role selector buttons (Member / Admin)
    await expect(page.getByRole("button", { name: /^member$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^admin$/i })).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 5. Billing page loads with seat info
  // --------------------------------------------------------------------------
  test("billing page shows plan and seat usage", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page, "/billing");

    // Page heading
    await expect(page.locator("h1", { hasText: "Billing" })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Plan name — the seed sets billing_status: 'active' and plan defaults to "Enterprise"
    await expect(page.getByText(/enterprise/i)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Seat usage section
    await expect(page.getByText("SEAT USAGE")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Seat bar renders "X of Y seats used"
    await expect(page.getByText(/\d+ of \d+ seats used/)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  });

  // --------------------------------------------------------------------------
  // 6. Audit page loads with entries
  // --------------------------------------------------------------------------
  test("audit log page renders", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page, "/audit");

    // Page heading
    await expect(page.locator("h1", { hasText: "Audit Log" })).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // Either a table with entries or the "No audit entries yet." message
    const table = page.locator("table");
    const emptyState = page.getByText("No audit entries yet.");

    await expect(table.or(emptyState)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  });

  // --------------------------------------------------------------------------
  // 7. Sidebar navigation works
  // --------------------------------------------------------------------------
  test("sidebar navigation links route correctly", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);
    await navigateToAdmin(page);

    // Click Members
    await page.getByRole("link", { name: "Members" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}/admin/members`), {
      timeout: DEFAULT_TIMEOUT,
    });

    // Click Billing
    await page.getByRole("link", { name: "Billing" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}/admin/billing`), {
      timeout: DEFAULT_TIMEOUT,
    });

    // Click Audit Log
    await page.getByRole("link", { name: "Audit Log" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}/admin/audit`), {
      timeout: DEFAULT_TIMEOUT,
    });

    // Click Dashboard to return
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}/admin$`), {
      timeout: DEFAULT_TIMEOUT,
    });
  });
});

// ============================================================================
// Tests: Access Control
// ============================================================================

test.describe("Enterprise Admin Portal — Access Control", () => {
  test.setTimeout(60_000);

  // --------------------------------------------------------------------------
  // 8. Member user is redirected from admin
  // --------------------------------------------------------------------------
  test("member role is redirected away from admin portal", async ({ page }) => {
    await loginAs(page, MEMBER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/org/${ORG_SLUG}/admin`);

    // OrgGuard redirects non-admin roles to "/"
    await page.waitForURL(/^\/$|\/map|\/dashboard/, {
      timeout: DEFAULT_TIMEOUT,
    });

    // Confirm we are NOT on the admin page
    expect(page.url()).not.toContain(`/org/${ORG_SLUG}/admin`);
  });

  // --------------------------------------------------------------------------
  // 9. Outsider user is redirected from admin
  // --------------------------------------------------------------------------
  test("outsider user is redirected away from admin portal", async ({
    page,
  }) => {
    await loginAs(page, OUTSIDER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/org/${ORG_SLUG}/admin`);

    // OrgGuard redirects users without org membership to "/"
    await page.waitForURL(/^\/$|\/map|\/dashboard|\/auth/, {
      timeout: DEFAULT_TIMEOUT,
    });

    expect(page.url()).not.toContain(`/org/${ORG_SLUG}/admin`);
  });

  // --------------------------------------------------------------------------
  // 10. Invite acceptance page renders for invalid token
  // --------------------------------------------------------------------------
  test("invite page shows error for invalid token", async ({ page }) => {
    await page.goto(`${BASE_URL}/org/invite/invalid-token-for-test`);

    // The invite page should show an error state — "Unable to join" heading
    await expect(
      page.locator("h2", { hasText: /unable to join/i }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Error message about invalid or not-found invite
    await expect(page.getByText(/invalid|not found|expired/i)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });

    // "Return to homepage" link is available
    await expect(
      page.getByRole("link", { name: /return to homepage/i }),
    ).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // 11. Non-existent org shows error or redirect
  // --------------------------------------------------------------------------
  test("non-existent org slug shows error or redirects", async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/org/nonexistent-slug-xyz/admin`);

    // The OrgContextProvider should fail to load the org, causing either:
    // - An error message ("Organization not found" or similar)
    // - A redirect away from the admin page
    // We accept either outcome.
    const errorVisible = page.getByText(/not found|does not exist|error/i);
    const redirectedAway = page
      .waitForURL(/^\/$|\/map|\/dashboard/, {
        timeout: DEFAULT_TIMEOUT,
      })
      .then(() => true)
      .catch(() => false);

    const hasError = await errorVisible
      .isVisible({ timeout: DEFAULT_TIMEOUT })
      .catch(() => false);
    const wasRedirected = await redirectedAway;

    expect(hasError || wasRedirected).toBeTruthy();
  });
});
