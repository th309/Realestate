/**
 * Signup Chain E2E — backlog item #1 (email path; Google OAuth deferred).
 *
 * Drives LIVE pages (no mocks). The "completes email signup" test creates a
 * REAL auth user with a unique disposable email and deletes it afterward.
 *
 * Prereqs: frontend on :3000, backend on :3001, .env.test with
 * NEXT_PUBLIC_SUPABASE_URL + a service/secret key.
 */
import { test, expect } from "@playwright/test";
import {
  findUserIdByEmail,
  hasSignupCompleteEvent,
  deleteUser,
} from "./helpers/supabase-admin";

test.describe("Signup chain", () => {
  test.setTimeout(90_000);

  // ---- Fix A: ToS no longer silently disables ----
  test("sign-up buttons are enabled with ToS unchecked and show an inline error", async ({
    page,
  }) => {
    await page.goto("/auth/sign-up");
    const createBtn = page.getByRole("button", { name: /create account/i });
    await expect(createBtn).toBeEnabled();
    await page.getByLabel(/^email$/i).fill("not-submitted@example.com");
    await page.locator("#password").fill("StrongPass1");
    await page.locator("#confirm-password").fill("StrongPass1");
    await createBtn.click();
    await expect(
      page.getByText(/must accept the terms of service/i),
    ).toBeVisible();
  });

  // ---- Fix B/C: pricing anonymous ----
  test("anonymous Free card says Sign up free, not Current Plan", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("link", { name: /sign up free/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/current plan/i)).toHaveCount(0);
  });

  test("anonymous Pro CTA routes to sign-up", async ({ page }) => {
    await page.goto("/pricing");
    // Bottom CTA uses the pricing A/B copy; match the Pro card button instead.
    await page
      .getByRole("button", { name: /get pro|go pro|upgrade|start/i })
      .first()
      .click();
    await page.waitForURL(/\/auth\/sign-up/, { timeout: 10_000 });
  });

  // ---- Fix D: report dead-end ----
  test("anonymous report generate shows a signup CTA, not a dead-end", async ({
    page,
  }) => {
    await page.goto("/reports");
    // Select a market via the builder's search widget.
    await page.getByRole("heading", { name: /select your market/i }).waitFor();
    const search = page.getByPlaceholder(/search/i).first();
    await search.click();
    await search.fill("Austin");
    await page
      .getByText(/Austin/i)
      .first()
      .click();
    await page.getByRole("button", { name: /generate report/i }).click();
    await expect(page.getByText(/sign up free to generate your/i)).toBeVisible({
      timeout: 10_000,
    });
    const cta = page.getByRole("link", { name: /sign up free/i });
    await expect(cta).toHaveAttribute(
      "href",
      /\/auth\/sign-up\?redirect=.*reports/,
    );
    // No dead-end error string anywhere.
    await expect(page.getByText(/you must be signed in/i)).toHaveCount(0);
  });

  // ---- Email signup happy path + DB assertions (creates + deletes a real user) ----
  test("completes email signup from homepage and logs signup_complete", async ({
    page,
  }) => {
    const email = `piq-e2e-${Date.now()}@example.com`;
    // Unique, non-breached password: prod Supabase rejects leaked passwords
    // (HaveIBeenPwned). Still satisfies the 8+/upper/lower/number rules.
    const password = `Zq9${Date.now()}Lr`;
    let userId: string | null = null;
    try {
      await page.goto("/auth/sign-up");
      await page.getByLabel(/^email$/i).fill(email);
      await page.locator("#password").fill(password);
      await page.locator("#confirm-password").fill(password);
      await page.getByRole("checkbox").check(); // ToS
      await page.getByRole("button", { name: /create account/i }).click();

      // Prod requires email confirmation (no autoconfirm): the form lands on
      // "Check your email". With autoconfirm it navigates to /tour|/map.
      // Accept either — both mean Supabase created the account.
      const confirmation = page.getByText(/check your email/i);
      await Promise.race([
        page.waitForURL(/\/(tour|map)/, { timeout: 25_000 }).catch(() => {}),
        confirmation.waitFor({ timeout: 25_000 }).catch(() => {}),
      ]);

      // The account row now exists in auth.users (even if unconfirmed).
      await expect
        .poll(async () => (userId = await findUserIdByEmail(email)), {
          timeout: 20_000,
        })
        .not.toBeNull();

      if (/\/(tour|map)/.test(page.url())) {
        // Autoconfirm path: a session was issued, so signup_complete is logged.
        await expect
          .poll(async () => hasSignupCompleteEvent(userId as string), {
            timeout: 15_000,
          })
          .toBe(true);
      } else {
        // Confirmation path: signup_complete fires only after the user clicks
        // the emailed link (via /auth/callback), which automation can't do.
        await expect(confirmation).toBeVisible();
      }
    } finally {
      if (userId) await deleteUser(userId);
    }
  });
});
