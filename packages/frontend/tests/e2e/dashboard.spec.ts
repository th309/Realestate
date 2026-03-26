/**
 * Dashboard Page E2E Tests
 *
 * Live tests for the /dashboard page using an enterprise-tier authenticated
 * session. Covers page load, score widgets, navigation links, watchlist
 * section, and data card rendering.
 *
 * The dashboard may redirect to /map or /onboarding depending on whether
 * the user has completed the onboarding quiz. Both paths are handled.
 */

import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/enterprise-user.json");

test.describe("Dashboard — Live E2E", () => {
  test.use({ storageState: authFile });
  test.setTimeout(30000);

  // -------------------------------------------------------------------------
  // 1. Dashboard loads
  // -------------------------------------------------------------------------

  test("dashboard loads and shows a heading or welcome message", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });

    // The page may redirect to /map or /onboarding if the user has not
    // completed the quiz, or stay at /dashboard if they have.
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    const url = page.url();

    if (url.includes("/onboarding")) {
      // Onboarding redirect is a valid terminal state — just verify the page
      // loaded with meaningful content.
      await expect(page.locator("body")).not.toBeEmpty();
      return;
    }

    if (url.includes("/map")) {
      // Map redirect is also a valid terminal state.
      await expect(page.locator("body")).not.toBeEmpty();
      return;
    }

    // On /dashboard — verify the heading or welcome text is present.
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    const headingText = await heading.textContent();
    expect(headingText?.trim().length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 2. Score widgets render
  // -------------------------------------------------------------------------

  test("score display components are visible when dashboard is fully loaded", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    // Only assert score widgets when we actually land on /dashboard.
    if (!page.url().includes("/dashboard")) {
      test.skip();
      return;
    }

    // Wait for loading skeletons to resolve (quiz must be completed for these
    // sections to appear; if the onboarding banner shows instead, skip).
    const onboardingBanner = page.locator("text=Personalize Your Dashboard");
    const hasOnboardingBanner = await onboardingBanner
      .isVisible()
      .catch(() => false);

    if (hasOnboardingBanner) {
      // The onboarding banner is the expected UI when quiz is not completed.
      await expect(onboardingBanner).toBeVisible();
      return;
    }

    // Quiz completed — score rings should appear inside TopMarketsList rows.
    // Each market row contains an SVG score ring with a numeric label.
    const scoreRing = page.locator("svg circle").first();
    await expect(scoreRing).toBeVisible({ timeout: 15000 });

    // At least one numeric score value should be rendered inside a ring.
    const scoreNumbers = page.locator("svg + div span, svg ~ span").first();
    const scoreNumberFallback = page
      .locator(".relative.flex-shrink-0 span")
      .first();

    const hasScore =
      (await scoreNumbers.isVisible().catch(() => false)) ||
      (await scoreNumberFallback.isVisible().catch(() => false));

    expect(hasScore).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. Quick actions / navigation links
  // -------------------------------------------------------------------------

  test("navigation links to map, reports, and graphs pages are present", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    if (!page.url().includes("/dashboard")) {
      test.skip();
      return;
    }

    // The app shell (nav drawer / sidebar) is always rendered on /dashboard.
    // Check for links to core app sections — either in the nav or page body.
    const mapLink = page.locator('a[href*="/map"]').first();
    await expect(mapLink).toBeVisible({ timeout: 10000 });

    // Verify the map link is actually clickable (not disabled/hidden).
    await expect(mapLink).toBeEnabled();
  });

  test("map link navigates to /map", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    if (!page.url().includes("/dashboard")) {
      test.skip();
      return;
    }

    // Click the first map link and verify navigation.
    const mapLink = page.locator('a[href*="/map"]').first();
    await expect(mapLink).toBeVisible({ timeout: 10000 });
    await mapLink.click();
    await page.waitForURL(/\/map/, { timeout: 10000 });
    expect(page.url()).toContain("/map");
  });

  // -------------------------------------------------------------------------
  // 4. Watchlist section
  // -------------------------------------------------------------------------

  test("watchlist section renders (empty state or saved markets)", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    if (!page.url().includes("/dashboard")) {
      test.skip();
      return;
    }

    // Skip check if onboarding banner is shown (quiz not completed).
    const onboardingBanner = page.locator("text=Personalize Your Dashboard");
    if (await onboardingBanner.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    // "Watchlist Updates" heading should be visible.
    const watchlistHeading = page.locator("text=Watchlist Updates");
    await expect(watchlistHeading).toBeVisible({ timeout: 15000 });

    // Either saved markets or the empty state prompt should appear — both are
    // valid. The section itself must be rendered.
    const watchlistSection = page
      .locator("text=Watchlist Updates")
      .locator("..")
      .locator("..");

    // Empty state text OR saved market count label.
    const emptyState = page.locator("text=No markets saved yet");
    const savedMarketsCount = page.locator("text=/\\d+ market(s)? saved/");

    const hasEmptyState = await emptyState.isVisible().catch(() => false);
    const hasSavedMarkets = await savedMarketsCount
      .isVisible()
      .catch(() => false);

    expect(hasEmptyState || hasSavedMarkets).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Recent reports section (TopMarketsList)
  // -------------------------------------------------------------------------

  test("top market matches section renders after quiz completion", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    if (!page.url().includes("/dashboard")) {
      test.skip();
      return;
    }

    // When quiz is not completed the onboarding banner replaces the sections.
    const onboardingBanner = page.locator("text=Personalize Your Dashboard");
    if (await onboardingBanner.isVisible().catch(() => false)) {
      // Onboarding banner is the expected UI — section intentionally absent.
      await expect(onboardingBanner).toBeVisible();
      return;
    }

    // Quiz completed — "Top Market Matches" section must be present.
    const topMarketsHeading = page.locator("text=Top Market Matches");
    await expect(topMarketsHeading).toBeVisible({ timeout: 15000 });

    // Either a list of markets or the empty/loading state should render.
    const marketRow = page.locator("text=Markets to Watch");
    await expect(marketRow).toBeVisible({ timeout: 15000 });
  });

  // -------------------------------------------------------------------------
  // 6. Dashboard cards have data (not just loading spinners)
  // -------------------------------------------------------------------------

  test("at least one numeric value is visible on the dashboard", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForURL(/\/(dashboard|map|onboarding)/, { timeout: 15000 });

    if (!page.url().includes("/dashboard")) {
      test.skip();
      return;
    }

    // Skip if pre-quiz state (onboarding banner shown instead of data cards).
    const onboardingBanner = page.locator("text=Personalize Your Dashboard");
    if (await onboardingBanner.isVisible().catch(() => false)) {
      test.skip();
      return;
    }

    // Wait for loading skeletons to disappear — animate-pulse divs indicate
    // content is still loading.
    await page
      .locator(".animate-pulse")
      .first()
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {
        // Skeletons may never appear (data was fast) — that's fine.
      });

    // Match score numbers appear as short integers inside the SVG rings
    // (e.g. "78", "92"). A digit-only text node inside the score ring span
    // confirms real data has rendered, not just a skeleton.
    const numericScorePattern = /^\d{1,3}$/;
    const allSpans = page.locator(
      "svg ~ div span, .relative.flex-shrink-0 span",
    );
    const count = await allSpans.count();

    let foundNumeric = false;
    for (let i = 0; i < Math.min(count, 20); i++) {
      const text = (await allSpans.nth(i).textContent()) ?? "";
      if (numericScorePattern.test(text.trim())) {
        foundNumeric = true;
        break;
      }
    }

    // Also accept any visible text that looks like a numeric metric value
    // (handles cases where score rings use a different DOM structure).
    if (!foundNumeric) {
      const bodyText = await page.locator("body").textContent();
      // Match patterns like "78", "Match score: 82", "92" within the page.
      const numericMatch = bodyText?.match(/\bMatch score:\s*\d{1,3}\b/);
      foundNumeric = !!numericMatch;
    }

    expect(foundNumeric).toBe(true);
  });
});
