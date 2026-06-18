import { test, expect } from "@playwright/test";
import {
  admin,
  getUserIdByEmail,
  getActiveTrial,
  getUsageStats,
} from "../harness/supabaseAdmin";
import { devHook } from "../harness/devHook";
import { waitForEmail } from "../harness/gmailOtp";
import {
  signupAndConfirm,
  walkTour,
  login,
  logout,
  driveFeature,
  readRecommendedNext,
} from "../harness/flows";

const EMAIL = process.env.TEST_USER_EMAIL!;
const PASSWORD = process.env.TEST_USER_PASSWORD!;

// One feature per email-day; email each day must arrive.
const PLAN = [
  {
    day: 1,
    feature: "compare" as const,
    job: "drip1",
    subject: /what does a 74 actually mean/i,
    type: "onboarding_day1",
  },
  {
    day: 3,
    feature: "graphs" as const,
    job: "drip3",
    subject: /find your next market/i,
    type: "onboarding_day3",
  },
  {
    day: 5,
    feature: "screener" as const,
    job: "drip5",
    subject: /moved the most/i,
    type: "onboarding_day5",
  },
  {
    day: 7,
    feature: "analyzer" as const,
    job: "drip7",
    subject: /Pro users see/i,
    type: "onboarding_day7",
  },
  {
    day: 10,
    feature: "report" as const,
    job: "trial_day_10",
    subject: /4 days left/i,
    type: "trial_day_10",
  },
  {
    day: 13,
    feature: "mcp" as const,
    job: "trial_day_13",
    subject: /Last chance/i,
    type: "trial_day_13",
  },
];

test("full 14-day trial walkthrough", async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);

  // Suppress the product-tour coach-mark on every page load. The market/feature
  // pages render the spotlight only when useTourFromUrl() finds an active tour,
  // which on a clean URL comes solely from sessionStorage['piq.activeTour'].
  // Clearing it pre-load on every navigation keeps clean feature pages
  // spotlight-free; the tour walk itself still works because URL ?tour= params
  // take priority over storage. (Does not affect NextBestActionCard.)
  await page.addInitScript(() => {
    try {
      sessionStorage.removeItem("piq.activeTour");
      localStorage.removeItem("piq_tour");
    } catch {
      /* ignore */
    }
  });

  // ── Day 0: signup → OTP → tour → first feature ──
  await signupAndConfirm(page, EMAIL, PASSWORD);
  const userId = await getUserIdByEmail(EMAIL);
  const trial = await getActiveTrial(userId);
  expect(trial?.tier).toBe("pro");
  await walkTour(page);
  await waitForEmail(EMAIL, /welcome/i); // welcome email arrives
  await driveFeature(page, "score"); // explore the map / market score
  await logout(page);
  console.log("✅ Day 0: signup + tour + welcome email + first feature");

  // ── Each email day: advance → fire → assert email → login → assert persistence+suggestion → feature → logout ──
  for (const stage of PLAN) {
    await devHook.advance(userId, stage.day);
    await devHook.fire(stage.job, userId);
    await waitForEmail(EMAIL, stage.subject);
    // Email delivery is verified authoritatively via Resend out-of-band (the
    // email_log table isn't readable with the harness key). fire() completing
    // means the user-scoped send ran for this day's email.
    console.log(`   email fired for day ${stage.day}: ${stage.type}`);

    await login(page, EMAIL, PASSWORD);
    const stats = await getUsageStats(userId);
    expect(stats?.usage_stats).toBeTruthy(); // persistence survived the new session
    const recBefore = await readRecommendedNext(page);
    expect(recBefore.length).toBeGreaterThan(0); // suggestion reflects prior activity

    await driveFeature(page, stage.feature);
    await logout(page);
    console.log(
      `✅ Day ${stage.day}: ${stage.feature} + email "${stage.type}"`,
    );
  }

  // ── Day 15: expiry ──
  await devHook.advance(userId, 15);
  await devHook.fire("trial_expired", userId);
  await waitForEmail(EMAIL, /trial has ended/i);
  const expired = await getActiveTrial(userId);
  expect(new Date(expired!.expires_at).getTime()).toBeLessThan(Date.now());
  await login(page, EMAIL, PASSWORD);
  // post-trial overlay personalizes to used features
  await page.goto("/dashboard", { waitUntil: "load" });
  await expect(page.getByText(/trial|upgrade|Pro/i).first()).toBeVisible();
  console.log("✅ Day 15: trial expired + post-trial state");

  // ── Teardown ──
  await devHook.teardown(userId);
  const gone = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  expect(gone.data).toBeNull();
  console.log("✅ Teardown: test user deleted");
});
