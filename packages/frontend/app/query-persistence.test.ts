import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Query } from "@tanstack/react-query";

/**
 * idb-keyval touches real IndexedDB (`createStore` calls `indexedDB.open`),
 * which jsdom doesn't implement — mock it per the wave brief so this module
 * can be imported under vitest without a fake-indexeddb dependency.
 */
vi.mock("idb-keyval", () => ({
  createStore: vi.fn(() => "mock-idb-store"),
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
}));

/** Minimal duck-typed stand-in for a React Query `Query` instance. */
function makeQuery(
  status: "success" | "pending" | "error",
  queryKey: unknown[],
): Query {
  return { state: { status }, queryKey } as unknown as Query;
}

describe("query-persistence", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("shouldPersistQuery", () => {
    it.each([
      "snapshot",
      "scores",
      "score-heatmap",
      "dates",
      "trend",
      "market-snapshot",
      "market-snapshot-trends",
      "market-match",
      "market-match-top",
      "top-markets",
      "validation",
    ])(
      "persists successful '%s' queries (public read data)",
      async (family) => {
        const { shouldPersistQuery } = await import("./query-persistence");
        const query = makeQuery("success", [family, "metro", "35620"]);
        expect(shouldPersistQuery(query)).toBe(true);
      },
    );

    it.each([
      "entitlements",
      "user-preferences",
      "watchlist",
      "my-org",
      "onboarding-state",
      "admin",
      "analytics",
      "shadow-pairs",
      "grade-brrrr-deal",
      "ai-insight",
      "thresholds",
    ])(
      "never persists '%s' queries even on success (user/admin/auth-scoped)",
      async (family) => {
        const { shouldPersistQuery } = await import("./query-persistence");
        const query = makeQuery("success", [family, "user-123"]);
        expect(shouldPersistQuery(query)).toBe(false);
      },
    );

    it.each(["pending", "error"] as const)(
      "never persists an allowlisted family while status is '%s'",
      async (status) => {
        const { shouldPersistQuery } = await import("./query-persistence");
        const query = makeQuery(status, ["snapshot", "metro", "35620"]);
        expect(shouldPersistQuery(query)).toBe(false);
      },
    );

    it("treats a non-string first key segment as unpersistable", async () => {
      const { shouldPersistQuery } = await import("./query-persistence");
      const query = makeQuery("success", [{ nested: true }]);
      expect(shouldPersistQuery(query)).toBe(false);
    });
  });

  describe("PERSISTED_QUERY_CACHE_BUSTER", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("falls back to 'dev' when NEXT_PUBLIC_BUILD_ID is unset", async () => {
      vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "");
      const { PERSISTED_QUERY_CACHE_BUSTER } =
        await import("./query-persistence");
      expect(PERSISTED_QUERY_CACHE_BUSTER).toBe("dev");
    });

    it("uses NEXT_PUBLIC_BUILD_ID when the build pipeline sets it", async () => {
      vi.stubEnv("NEXT_PUBLIC_BUILD_ID", "abc123commitsha");
      const { PERSISTED_QUERY_CACHE_BUSTER } =
        await import("./query-persistence");
      expect(PERSISTED_QUERY_CACHE_BUSTER).toBe("abc123commitsha");
    });
  });

  describe("queryPersister", () => {
    it("exposes the Persister interface (persistClient/restoreClient/removeClient)", async () => {
      const { queryPersister } = await import("./query-persistence");
      expect(typeof queryPersister.persistClient).toBe("function");
      expect(typeof queryPersister.restoreClient).toBe("function");
      expect(typeof queryPersister.removeClient).toBe("function");
    });
  });

  describe("PERSISTED_QUERY_MAX_AGE", () => {
    it("is 24 hours in milliseconds", async () => {
      const { PERSISTED_QUERY_MAX_AGE } = await import("./query-persistence");
      expect(PERSISTED_QUERY_MAX_AGE).toBe(24 * 60 * 60 * 1000);
    });
  });
});
