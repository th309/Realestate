import { test, expect, Page, ConsoleMessage } from "@playwright/test";
import {
  p1AdminAuthFile,
  buildAuthHeadersFromStorage,
} from "./p1-signoff-helpers";

test.use({ storageState: p1AdminAuthFile });

interface ConsoleIssue {
  type: "error" | "pageerror";
  text: string;
}

function attachConsoleListeners(page: Page, bucket: ConsoleIssue[]) {
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      bucket.push({ type: "error", text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    bucket.push({ type: "pageerror", text: err.message });
  });
}

/**
 * P1 acceptance criterion #6: `/admin/content-pipeline` renders in browser
 * without console errors. Validates all 7 operator-facing pages against
 * the deployed Railway environment.
 *
 * A run-detail ID is pulled live from the dashboard API so the spec
 * doesn't rot when test data churns.
 */
test.describe.serial("P1 #6: admin content-pipeline pages render clean", () => {
  const staticPages: Array<{ name: string; path: string }> = [
    { name: "dashboard", path: "/admin/content-pipeline" },
    { name: "new-run-wizard", path: "/admin/content-pipeline/new" },
    { name: "review-queue", path: "/admin/content-pipeline/review" },
    { name: "platforms", path: "/admin/content-pipeline/platforms" },
    { name: "settings", path: "/admin/content-pipeline/settings" },
    { name: "performance", path: "/admin/content-pipeline/performance" },
  ];

  for (const p of staticPages) {
    test(`${p.name}`, async ({ page }) => {
      const issues: ConsoleIssue[] = [];
      attachConsoleListeners(page, issues);

      const response = await page.goto(p.path, { waitUntil: "networkidle" });
      expect(response?.ok(), `${p.path} HTTP ${response?.status()}`).toBe(true);

      // Attach console issues so they show up in the HTML report
      if (issues.length > 0) {
        await test.info().attach(`${p.name}-console`, {
          body: JSON.stringify(issues, null, 2),
          contentType: "application/json",
        });
      }
      expect(
        issues,
        `console errors on ${p.path}:\n${issues
          .map((i) => `  [${i.type}] ${i.text}`)
          .join("\n")}`,
      ).toHaveLength(0);
    });
  }

  test("run-detail", async ({ page, request }) => {
    const apiBase =
      process.env.PLAYWRIGHT_API_BASE ||
      "https://backend-production-ee4d.up.railway.app";

    // Pull the dashboard to find the most recent run ID — shape:
    // { success: true, data: { recentRuns: [{ id, status, ... }] } }
    const dashResp = await request.get(
      `${apiBase}/api/admin/content-pipeline/dashboard`,
      { headers: await buildAuthHeadersFromStorage(page) },
    );
    expect(dashResp.ok(), "dashboard API must be 200").toBe(true);
    const dashBody = await dashResp.json();
    const runId: string | undefined =
      dashBody?.data?.recentRuns?.[0]?.id ?? dashBody?.data?.runs?.[0]?.id;
    test.skip(!runId, "No runs found in dashboard — nothing to open");

    const issues: ConsoleIssue[] = [];
    attachConsoleListeners(page, issues);
    const response = await page.goto(`/admin/content-pipeline/runs/${runId}`, {
      waitUntil: "networkidle",
    });
    expect(response?.ok(), `run page HTTP ${response?.status()}`).toBe(true);
    expect(
      issues,
      `console errors on run-detail:\n${issues
        .map((i) => `  [${i.type}] ${i.text}`)
        .join("\n")}`,
    ).toHaveLength(0);
  });
});
