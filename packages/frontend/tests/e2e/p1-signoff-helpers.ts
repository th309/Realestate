import path from "path";
import type { Page } from "@playwright/test";

export const p1AdminAuthFile = path.join(
  __dirname,
  "../fixtures/.auth/p1-signoff-admin.json",
);

/**
 * Extract the Supabase access-token JWT from the browser's storage state
 * so Playwright's `request` fixture can forward it on direct backend API
 * calls. Supabase writes the session cookie as `base64-<payload>` where
 * the payload is another base64-encoded JSON blob containing access_token
 * and refresh_token. We strip the prefix, base64-decode, and pull out
 * access_token.
 */
export async function buildAuthHeadersFromStorage(
  page: Page,
): Promise<Record<string, string>> {
  const state = await page.context().storageState();
  const sbCookie = state.cookies.find((c) => c.name.includes("-auth-token"));
  if (!sbCookie) return {};
  try {
    let raw = decodeURIComponent(sbCookie.value);
    if (raw.startsWith("base64-")) {
      raw = Buffer.from(raw.slice("base64-".length), "base64").toString("utf8");
    }
    const parsed = JSON.parse(raw);
    const token =
      parsed?.access_token ?? (Array.isArray(parsed) ? parsed[0] : undefined);
    if (typeof token === "string") {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // fall through
  }
  return {};
}
