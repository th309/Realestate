/**
 * MCP Server Authentication
 *
 * Handles credential storage, device flow, and API key resolution.
 * Priority: stored credentials → env var → device flow.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  existsSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";

const CREDENTIALS_DIR = join(homedir(), ".propertyiq");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 200; // 10 min / 3s

interface StoredCredentials {
  api_key: string;
  created_at: string;
  user_email?: string;
}

export function getApiKey(): string | null {
  // 1. Stored credentials
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      const raw = readFileSync(CREDENTIALS_FILE, "utf-8");
      const creds: StoredCredentials = JSON.parse(raw);
      if (creds.api_key) return creds.api_key;
    }
  } catch {
    // Corrupted file — fall through
  }

  // 2. Environment variable (silent fallback)
  if (process.env.PROPERTYIQ_API_KEY) {
    return process.env.PROPERTYIQ_API_KEY;
  }

  return null;
}

export async function authenticate(apiUrl: string): Promise<string> {
  console.error("[PropertyIQ] No API key found. Starting authentication...");

  // 1. Request device code
  const createRes = await fetch(`${apiUrl}/api/auth/device-code`, {
    method: "POST",
  });

  if (!createRes.ok) {
    throw new Error(`Failed to start auth: ${createRes.status}`);
  }

  const { device_code, user_code, verification_url } =
    (await createRes.json()) as {
      device_code: string;
      user_code: string;
      verification_url: string;
    };

  console.error("");
  console.error("  To connect PropertyIQ, visit:");
  console.error(`    ${verification_url}`);
  console.error("");
  console.error(`  Enter code: ${user_code}`);
  console.error("");

  // Try to open browser (best-effort)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const open = await import("open" as any);
    await open.default(verification_url);
  } catch {
    // No 'open' package — user opens manually
  }

  // 2. Poll until complete or expired
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(
      `${apiUrl}/api/auth/device-code/${device_code}`,
    );
    if (!pollRes.ok) continue;

    const poll = (await pollRes.json()) as {
      status: string;
      api_key?: string;
      user_email?: string;
    };

    if (poll.status === "complete" && poll.api_key) {
      storeCredentials({
        api_key: poll.api_key,
        created_at: new Date().toISOString(),
        user_email: poll.user_email,
      });

      console.error("[PropertyIQ] Authenticated successfully!");
      return poll.api_key;
    }

    if (poll.status === "expired") {
      throw new Error(
        "Activation code expired. Please restart the MCP server to try again.",
      );
    }
  }

  throw new Error(
    "Authentication timed out. Please restart the MCP server to try again.",
  );
}

export function clearCredentials(): void {
  try {
    if (existsSync(CREDENTIALS_FILE)) {
      unlinkSync(CREDENTIALS_FILE);
      console.error(
        "[PropertyIQ] Credentials cleared. Re-authenticate on next start.",
      );
    }
  } catch {
    // Ignore
  }
}

function storeCredentials(creds: StoredCredentials): void {
  try {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
    writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), "utf-8");
  } catch (err) {
    console.error(`[PropertyIQ] Warning: Could not save credentials: ${err}`);
  }
}
