import { Page } from "@playwright/test";
import { waitForOtp } from "./gmailOtp";

/**
 * Onboarding coach-mark spotlights render a full-screen dim layer
 * (data-testid="spotlight-dim-*") that intercepts pointer events and blocks
 * clicks. Dismiss any that are visible (the intended user action is the
 * "Do this later" button). Safe no-op when none are present.
 */
export async function dismissOverlays(page: Page) {
  for (let pass = 0; pass < 3; pass++) {
    let acted = false;
    for (const re of [
      /do this later/i,
      /got it/i,
      /^dismiss$/i,
      /no thanks/i,
      /maybe later/i,
      /skip( tour)?/i,
    ]) {
      const btn = page.getByRole("button", { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
        acted = true;
      }
    }
    if (!acted) break;
  }
}

export async function signupAndConfirm(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/auth/sign-up", { waitUntil: "load" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirm-password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();

  // OTP step
  await page
    .locator('input[autocomplete="one-time-code"]')
    .waitFor({ timeout: 30_000 });
  const code = await waitForOtp(email);
  await page.locator('input[autocomplete="one-time-code"]').fill(code);
  await page.getByRole("button", { name: /^verify$/i }).click();
  // default redirect post-signup is /tour
  await page.waitForURL(/\/tour/, { timeout: 30_000 });
}

export async function walkTour(page: Page) {
  await page
    .getByText(/What brings you to PropertyIQ/i)
    .waitFor({ timeout: 20_000 });
  await page.getByText(/I'm an investor/i).click();
  await page
    .getByText(/What market matters most/i)
    .waitFor({ timeout: 20_000 });
  // take the skip/fallback market to keep the run deterministic
  await page.getByText(/Or skip — show me/i).click();
  // finale: authed users see the Pro confirmation. Best-effort — if the tour
  // stalls on a slow market/score load, proceed into the app rather than
  // hard-failing the whole walkthrough on a tangential onboarding step.
  try {
    await page
      .getByText(/You're set with Pro|14 days of full access/i)
      .waitFor({ timeout: 60_000 });
    console.log("[walkTour] reached finale");
  } catch {
    console.log(
      "[walkTour] finale not reached within 60s (tour stalled on market load); ending tour and continuing",
    );
  }
  // End the tour session. It persists in localStorage('piq_tour') and
  // sessionStorage('piq.activeTour') and the market/feature pages REHYDRATE
  // the active tour from there even on clean URLs — so without this the
  // coach-mark spotlight re-appears on every feature page and blocks clicks.
  await page.evaluate(() => {
    try {
      localStorage.removeItem("piq_tour");
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem("piq.activeTour");
    } catch {
      /* ignore */
    }
  });
  await page.goto("/dashboard", { waitUntil: "load" });
  await dismissOverlays(page);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/sign-in", { waitUntil: "load" });
  // ensure password mode
  const usePw = page.getByText(/use password instead/i);
  if (await usePw.isVisible().catch(() => false)) await usePw.click();
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), {
    timeout: 30_000,
  });
}

export async function logout(page: Page) {
  await dismissOverlays(page);
  const menu = page.getByTestId("user-menu");
  await menu
    .click({ timeout: 8000 })
    .catch(async () => menu.click({ force: true }));
  await page.getByRole("button", { name: /sign out/i }).click();
  await page
    .getByRole("button", { name: /log in/i })
    .waitFor({ timeout: 15_000 });
}

type Feature =
  | "score"
  | "compare"
  | "graphs"
  | "screener"
  | "analyzer"
  | "report"
  | "mcp"
  | "watchlist";

const ROUTES: Record<Feature, { url: string; anchor: RegExp }> = {
  score: {
    url: "/market/16740",
    anchor: /Market Position|Market Overview|AI Market Analysis/i,
  },
  compare: { url: "/compare/markets", anchor: /compare|side by side/i },
  graphs: { url: "/graphs", anchor: /Market Explorer/i },
  screener: { url: "/screener", anchor: /select your market|screener/i },
  analyzer: { url: "/analyzer", anchor: /Deal Analyzer|address/i },
  report: { url: "/reports", anchor: /select your market|report/i },
  mcp: { url: "/docs/mcp", anchor: /MCP|Claude/i },
  watchlist: { url: "/market", anchor: /watchlist|markets/i },
};

export async function driveFeature(page: Page, feature: Feature) {
  const { url, anchor } = ROUTES[feature];
  await page.goto(url, { waitUntil: "load" });
  await dismissOverlays(page);
  // Best-effort anchor: feature pages vary, and the goal is to land on the
  // page + let the analytics tracker fire — not to assert exact copy. Don't
  // fail the whole walkthrough if a page's wording differs.
  await page
    .getByText(anchor)
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() =>
      console.log(`[driveFeature] ${feature}: anchor not found, page loaded`),
    );
  // dwell so the analytics tracker batches + flushes the feature.* event
  await page.waitForTimeout(6000);
}

export async function readRecommendedNext(page: Page): Promise<string> {
  await page.goto("/dashboard", { waitUntil: "load" });
  await dismissOverlays(page);
  // NextBestActionCard renders the recommended feature's title text
  const card = page
    .locator("a", {
      hasText:
        /Use PropertyIQ inside Claude|Underwrite a real deal|Find your next market|Compare to a peer|Build your watchlist|Explore the data visually|Generate an AI report|Check a market's Score/i,
    })
    .first();
  await card.waitFor({ timeout: 20_000 });
  return (await card.innerText()).trim();
}
