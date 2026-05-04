import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";

// Mock the supabase module BEFORE importing the SUT so requireSupabase()
// returns a per-test-controllable fake client.
type FakeRow = Record<string, unknown> | null;
type TableSpec = { eq?: Record<string, unknown>; row?: FakeRow };

const tableHandlers = new Map<string, () => Promise<{ data: FakeRow }>>();

function setTableResponse(
  table: string,
  rows: Array<{ where: Record<string, unknown>; row: FakeRow }>,
): void {
  tableHandlers.set(table, async () => {
    // Last-write-wins: respond with the first row that matches the captured
    // .eq() chain. We capture .eq() calls below into `currentFilters`.
    for (const r of rows) {
      const allMatch = Object.entries(r.where).every(
        ([k, v]) => currentFilters[k] === v,
      );
      if (allMatch) return { data: r.row };
    }
    return { data: null };
  });
}

let currentFilters: Record<string, unknown> = {};

vi.mock("./oauth/supabase", () => {
  return {
    requireSupabase: () => ({
      from: (table: string) => {
        currentFilters = {};
        const builder = {
          select: () => builder,
          eq: (col: string, val: unknown) => {
            currentFilters[col] = val;
            return builder;
          },
          maybeSingle: async () => {
            const handler = tableHandlers.get(table);
            if (!handler) return { data: null };
            return handler();
          },
        };
        return builder;
      },
    }),
  };
});

import {
  lookupApiKey,
  __resetApiKeyCacheForTests,
  POSITIVE_TTL_MS,
  NEGATIVE_TTL_MS,
} from "./api-keys";

const RAW_KEY = "piq_live_testkey1234567890abcdef";
const KEY_HASH = createHash("sha256").update(RAW_KEY).digest("hex");

beforeEach(() => {
  __resetApiKeyCacheForTests();
  tableHandlers.clear();
  currentFilters = {};
});

describe("lookupApiKey TTL constants", () => {
  it("exports POSITIVE_TTL_MS = 60 seconds", () => {
    expect(POSITIVE_TTL_MS).toBe(60 * 1000);
  });

  it("exports NEGATIVE_TTL_MS = 30 seconds", () => {
    expect(NEGATIVE_TTL_MS).toBe(30 * 1000);
  });
});

describe("lookupApiKey — user_api_keys", () => {
  it("returns userId when key found in user_api_keys", async () => {
    setTableResponse("user_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: { id: "uak-1", user_id: "user-pro-123", expires_at: null },
      },
    ]);

    const result = await lookupApiKey(RAW_KEY);
    expect(result).toEqual({
      userId: "user-pro-123",
      source: "user",
      keyId: "uak-1",
    });
  });

  it("returns null when user key has expired", async () => {
    setTableResponse("user_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: {
          id: "uak-2",
          user_id: "user-pro-123",
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      },
    ]);

    const result = await lookupApiKey(RAW_KEY);
    expect(result).toBeNull();
  });
});

describe("lookupApiKey — organization_api_keys", () => {
  it("returns org-owner userId when key found in organization_api_keys", async () => {
    setTableResponse("organization_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: {
          id: "oak-1",
          organization_id: "org-9",
          expires_at: null,
        },
      },
    ]);
    setTableResponse("organizations", [
      {
        where: { id: "org-9" },
        row: { owner_id: "user-owner-99" },
      },
    ]);

    const result = await lookupApiKey(RAW_KEY);
    expect(result).toEqual({
      userId: "user-owner-99",
      source: "org",
      keyId: "oak-1",
      orgId: "org-9",
    });
  });

  it("returns null when org key has expired", async () => {
    setTableResponse("organization_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: {
          id: "oak-2",
          organization_id: "org-9",
          expires_at: new Date(Date.now() - 1000).toISOString(),
        },
      },
    ]);

    const result = await lookupApiKey(RAW_KEY);
    expect(result).toBeNull();
  });

  it("returns null when org has no owner_id", async () => {
    setTableResponse("organization_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: { id: "oak-3", organization_id: "org-orphan", expires_at: null },
      },
    ]);
    setTableResponse("organizations", [
      { where: { id: "org-orphan" }, row: { owner_id: null } },
    ]);

    const result = await lookupApiKey(RAW_KEY);
    expect(result).toBeNull();
  });

  it("prefers organization_api_keys when key exists in both tables", async () => {
    setTableResponse("organization_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: { id: "oak-4", organization_id: "org-7", expires_at: null },
      },
    ]);
    setTableResponse("organizations", [
      { where: { id: "org-7" }, row: { owner_id: "user-owner-7" } },
    ]);
    setTableResponse("user_api_keys", [
      {
        where: { key_hash: KEY_HASH, is_active: true },
        row: { id: "uak-X", user_id: "user-collision", expires_at: null },
      },
    ]);

    const result = await lookupApiKey(RAW_KEY);
    expect(result?.source).toBe("org");
    expect(result?.userId).toBe("user-owner-7");
  });
});

describe("lookupApiKey — not found", () => {
  it("returns null when key not in either table", async () => {
    // No table responses configured → handlers return { data: null }
    const result = await lookupApiKey(RAW_KEY);
    expect(result).toBeNull();
  });
});

describe("lookupApiKey — caching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("caches positive results for POSITIVE_TTL_MS", async () => {
    let userKeyCalls = 0;
    tableHandlers.set("user_api_keys", async () => {
      userKeyCalls++;
      return { data: { id: "uak-1", user_id: "user-A", expires_at: null } };
    });

    await lookupApiKey(RAW_KEY);
    await lookupApiKey(RAW_KEY); // cache hit
    expect(userKeyCalls).toBe(1);

    vi.advanceTimersByTime(POSITIVE_TTL_MS - 1);
    await lookupApiKey(RAW_KEY);
    expect(userKeyCalls).toBe(1);

    vi.advanceTimersByTime(2);
    await lookupApiKey(RAW_KEY);
    expect(userKeyCalls).toBe(2);
  });

  it("caches negative results for NEGATIVE_TTL_MS only", async () => {
    let calls = 0;
    tableHandlers.set("organization_api_keys", async () => {
      calls++;
      return { data: null };
    });
    tableHandlers.set("user_api_keys", async () => {
      calls++;
      return { data: null };
    });

    await lookupApiKey(RAW_KEY);
    await lookupApiKey(RAW_KEY);
    expect(calls).toBe(2); // 2 tables hit on first call, 0 on cached second

    vi.advanceTimersByTime(NEGATIVE_TTL_MS - 1);
    await lookupApiKey(RAW_KEY);
    expect(calls).toBe(2); // still cached

    vi.advanceTimersByTime(2);
    await lookupApiKey(RAW_KEY);
    expect(calls).toBe(4); // negative TTL expired, both tables hit again
  });
});

describe("lookupApiKey — security", () => {
  it("hashes the raw key with SHA256 before any DB query", async () => {
    let observedHash: unknown;
    tableHandlers.set("organization_api_keys", async () => {
      observedHash = currentFilters.key_hash;
      return { data: null };
    });

    await lookupApiKey(RAW_KEY);
    expect(observedHash).toBe(KEY_HASH);
    // And the raw key never appears in the filter
    expect(observedHash).not.toBe(RAW_KEY);
  });
});
