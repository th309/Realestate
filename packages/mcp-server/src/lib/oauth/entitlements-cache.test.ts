import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkEntitlement,
  invalidateMany,
  __resetCacheForTests,
  POSITIVE_TTL_MS,
  NEGATIVE_TTL_MS,
} from "./entitlements-cache";

describe("entitlements-cache TTL split", () => {
  beforeEach(() => {
    __resetCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports POSITIVE_TTL_MS = 5 minutes", () => {
    expect(POSITIVE_TTL_MS).toBe(5 * 60 * 1000);
  });

  it("exports NEGATIVE_TTL_MS = 30 seconds", () => {
    expect(NEGATIVE_TTL_MS).toBe(30 * 1000);
  });

  it("a positive result is cached for up to 5 minutes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access: { "feature:mcp_access": { level: "full" } },
        }),
        { status: 200 },
      ),
    );

    await checkEntitlement("user-pro");
    await checkEntitlement("user-pro"); // should hit cache
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(POSITIVE_TTL_MS - 1);
    await checkEntitlement("user-pro");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still cached

    vi.advanceTimersByTime(2);
    await checkEntitlement("user-pro");
    expect(fetchSpy).toHaveBeenCalledTimes(2); // re-fetched
    fetchSpy.mockRestore();
  });

  it("a negative result is cached for only 30 seconds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access: { "feature:mcp_access": { level: "none" } },
        }),
        { status: 200 },
      ),
    );

    await checkEntitlement("user-free");
    await checkEntitlement("user-free");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(NEGATIVE_TTL_MS - 1);
    await checkEntitlement("user-free");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await checkEntitlement("user-free");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });
});

describe("fail-open on backend errors", () => {
  beforeEach(() => {
    __resetCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails open and does not cache on HTTP 502", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "error",
            code: 502,
            message: "Application failed to respond",
          }),
          { status: 502 },
        ),
      );

    expect(await checkEntitlement("user-during-outage")).toBe(true);
    // Not cached: the next call should re-fetch (proving no negative-cache leak)
    expect(await checkEntitlement("user-during-outage")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("fails open and does not cache on HTTP 503", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 503 }));

    expect(await checkEntitlement("user-during-degradation")).toBe(true);
    expect(await checkEntitlement("user-during-degradation")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("fails open and does not cache on network error (fetch rejection)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));

    expect(await checkEntitlement("user-no-network")).toBe(true);
    expect(await checkEntitlement("user-no-network")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });

  it("once backend recovers, denial is honored normally", async () => {
    // First call: backend down → fail-open, no cache
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 502 }));
    expect(await checkEntitlement("user-recovering")).toBe(true);

    // Second call: backend back, returns level=none → cache denial for 30s
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access: { "feature:mcp_access": { level: "none" } } }),
        { status: 200 },
      ),
    );
    expect(await checkEntitlement("user-recovering")).toBe(false);

    // Third call within 30s: served from negative cache, no fetch
    expect(await checkEntitlement("user-recovering")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    fetchSpy.mockRestore();
  });
});

describe("invalidateMany", () => {
  beforeEach(() => {
    __resetCacheForTests();
  });

  it("returns 0 when nothing is cached", () => {
    expect(invalidateMany(["a", "b"])).toBe(0);
  });

  it("deletes cached entries and returns the delete count", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            access: { "feature:mcp_access": { level: "full" } },
          }),
          { status: 200 },
        ),
    );
    await checkEntitlement("user-1");
    await checkEntitlement("user-2");
    await checkEntitlement("user-3");

    expect(invalidateMany(["user-1", "user-2", "missing"])).toBe(2);

    // Missing users don't throw, just don't count.
    expect(invalidateMany(["missing-again"])).toBe(0);
  });

  it("handles empty input", () => {
    expect(invalidateMany([])).toBe(0);
  });
});
