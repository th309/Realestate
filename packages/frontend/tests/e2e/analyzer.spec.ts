/**
 * E2E tests for the /analyzer page (Deal Analyzer).
 *
 * Covers:
 *  - Happy path (Pro user): autocomplete → KPI strip renders → market context visible
 *  - Graceful degradation: insurance field unavailable, rest still works
 *  - Anonymous quota wall after 3 analyses
 *  - Save → share URL publicly visible without auth
 *
 * Notes:
 *  - The /analyzer page renders a responsive layout: the InputPanel lives in a
 *    sticky <aside> on desktop, and inside the `EditInputsFab` drawer on mobile.
 *    Both copies may be in the DOM; selectors that could match both must use
 *    `.first()` to avoid Playwright strict-mode violations.
 *  - These tests target desktop chromium only — the mobile-chrome viewport's
 *    open FAB drawer intercepts pointer events on action buttons. Add separate
 *    mobile coverage if needed.
 */

import { test, expect } from "@playwright/test";
import path from "path";

// Note: run only against the chromium project — analyzer is desktop-targeted;
// mobile-chrome's open <details> accordion intercepts pointer events on
// action buttons. Invoke with: `npx playwright test analyzer --project=chromium`.

// Use the existing enterprise user storage state created by auth.setup.ts.
// Enterprise tier satisfies the analyzer's Pro gate (allowed: pro, enterprise, admin).
const enterpriseUserAuthFile = path.join(
  __dirname,
  "../fixtures/.auth/enterprise-user.json",
);

test.describe("/analyzer (Pro-gated paths)", () => {
  test.use({ storageState: enterpriseUserAuthFile });

  test("happy path — autocomplete → results render → market tile visible to Pro", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("123 Main St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    await expect(page.getByText("Cap rate", { exact: true })).toBeVisible();
    await expect(page.getByText("Cash-on-cash", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Cashflow / mo", { exact: true }),
    ).toBeVisible();

    // FLIP tab requires ARV + rehab inputs to compute metrics; otherwise the
    // panel shows an empty-state prompt. This test only fills the address bar,
    // so assert the empty-state copy after switching tabs.
    await page.getByRole("button", { name: "FLIP" }).click();
    await expect(page.getByText(/Enter ARV \+ rehab budget/i)).toBeVisible();

    // MarketContextTile renders the heading in both the locked overlay and the
    // underlying tile, so pin to the first match.
    await expect(
      page.getByText(/PropertyIQ Market Context/).first(),
    ).toBeVisible();
  });

  test("save → share URL is publicly visible without auth", async ({
    page,
    browser,
  }) => {
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("123 Main St Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    await page.getByRole("button", { name: /^Save$/ }).click();
    const toast = page.getByText(/Saved — share at/);
    await expect(toast).toBeVisible();

    const link = await toast.textContent();
    const match = link?.match(/\/shared\/analysis\/[A-Za-z0-9_-]+/);
    expect(match, "expected share URL in toast text").toBeTruthy();
    const url = match![0];

    // Open the share URL in an anonymous context (no auth cookies/storage).
    const anonCtx = await browser.newContext();
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(url);

    await expect(anonPage.getByText(/Shared analysis/)).toBeVisible();
    // The anonymous share view must NOT expose a Save button.
    await expect(anonPage.getByRole("button", { name: /Save/ })).toHaveCount(0);

    await anonCtx.close();
  });
});

test.describe("/analyzer (no auth required)", () => {
  test("graceful: insurance field renders unavailable, rest works", async ({
    page,
  }) => {
    await page.goto("/analyzer");
    await page
      .getByRole("textbox", { name: /Address search/i })
      .fill("1 Microsoft Way Redmond");
    await page
      .getByText(/Redmond, WA/)
      .first()
      .click();

    // Insurance comes from a third-party metric that may be unavailable for
    // some markets — verify the "unavailable" badge renders rather than
    // silently falling back to a fake value. The badge appears in both the
    // mobile <details> (hidden on desktop) and desktop <aside>; scope to the
    // <aside> which is the desktop-visible copy.
    await expect(page.locator("aside").getByText(/unavailable/i)).toBeVisible();

    // User can still override insurance manually and the rest of the
    // analysis surface keeps working.
    const insField = page.locator(
      'aside label:has-text("Insurance / year") input',
    );
    await insField.fill("1500");

    await expect(page.getByText("Cap rate", { exact: true })).toBeVisible();
  });

  test("anonymous quota wall after 3 analyses", async ({ browser }) => {
    // Fresh context — no logged-in storage state, no cookies.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    for (let i = 0; i < 3; i++) {
      await page.goto("/analyzer");
      await page.getByRole("textbox").fill(`${i + 100} Main St Austin`);
      await page
        .getByText(/Austin, TX/)
        .first()
        .click();
      // Brief settle for the analyze call to register against the quota.
      await page.waitForTimeout(500);
    }

    // 4th attempt should hit the quota wall.
    await page.goto("/analyzer");
    await page.getByRole("textbox").fill("400 Congress Ave Austin");
    await page
      .getByText(/Austin, TX/)
      .first()
      .click();

    await expect(page.getByText(/used your 3 free/i)).toBeVisible();

    await ctx.close();
  });
});
