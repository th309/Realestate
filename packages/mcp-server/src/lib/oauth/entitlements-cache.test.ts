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
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
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
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
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
