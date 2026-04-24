import { test as setup, expect } from "@playwright/test";
import { p1AdminAuthFile } from "./p1-signoff-helpers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set in packages/frontend/.env.local for P1 sign-off.`,
    );
  }
  return value;
}

setup("authenticate admin for P1 sign-off", async ({ page }) => {
  const email = requireEnv("P1_SIGNOFF_ADMIN_EMAIL");
  const password = requireEnv("P1_SIGNOFF_ADMIN_PASSWORD");

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  // Troy's account lands on /map by default; other admins may go to
  // /dashboard, /admin, /home, /team — accept any authenticated route.
  await page.waitForURL(/\/(map|dashboard|admin|home|team)(\/.*)?$/, {
    timeout: 20_000,
  });

  // Confirm we landed authed by checking cookie exists
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name.includes("sb-"))).toBe(true);

  await page.context().storageState({ path: p1AdminAuthFile });
});
