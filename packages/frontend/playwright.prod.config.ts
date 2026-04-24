import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, ".env.local") });

/**
 * Playwright config that runs against the deployed Railway frontend +
 * backend instead of spinning up local servers. Used for P1 sign-off
 * where "green on localhost" is not the interesting signal — "green
 * on prod" is.
 *
 * Override PLAYWRIGHT_BASE_URL if you need to point at a preview URL.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /content-pipeline-p1-.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL || "https://propertyiq.up.railway.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "p1-signoff-setup",
      testMatch: /p1-signoff-auth\.setup\.ts$/,
    },
    {
      name: "chromium-prod",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["p1-signoff-setup"],
    },
  ],
});
