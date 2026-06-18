import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchEntitlements,
  fetchEntitlementsWithRetry,
  trackPaywallEvent,
} from "../api";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const PRO_PAYLOAD = {
  tier: "pro",
  access: { "metric:home_value": { level: "full" } },
  trial: { active: true, daysRemaining: 7, tier: "pro" },
};

function mockOkResponse(payload: unknown) {
  return { ok: true, json: () => Promise.resolve(payload) };
}

describe("fetchEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends resources as comma-separated query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tier: "free", access: {}, trial: null }),
    });

    await fetchEntitlements(["metric:home_value", "feature:scores"]);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      "resources=metric%3Ahome_value%2Cfeature%3Ascores",
    );
  });

  it("includes tier override in query params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tier: "pro", access: {}, trial: null }),
    });

    await fetchEntitlements(["metric:home_value"], "pro");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("tier=pro");
  });

  it("returns parsed entitlements state", async () => {
    const apiResponse = {
      tier: "pro",
      access: { "metric:home_value": { level: "full" } },
      trial: { active: true, daysRemaining: 7, tier: "pro" },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    });

    const result = await fetchEntitlements(["metric:home_value"]);

    expect(result.tier).toBe("pro");
    expect(result.access).toEqual({ "metric:home_value": { level: "full" } });
    expect(result.trial).toEqual({
      active: true,
      daysRemaining: 7,
      tier: "pro",
    });
    expect(result.loading).toBe(false);
    expect(result.error).toBeNull();
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchEntitlements(["metric:home_value"])).rejects.toThrow(
      "Entitlements API returned 500",
    );
  });

  it("omits resources param when empty array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ tier: "free", access: {}, trial: null }),
    });

    await fetchEntitlements([]);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("resources=");
  });
});

describe("fetchEntitlementsWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns immediately on first-attempt success without retrying", async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse(PRO_PAYLOAD));

    const result = await fetchEntitlementsWithRetry(["metric:home_value"]);

    expect(result.tier).toBe("pro");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then resolves with the success payload", async () => {
    // Two transient backend-unreachable blips, then success on the 3rd attempt.
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(mockOkResponse(PRO_PAYLOAD));

    const promise = fetchEntitlementsWithRetry(["metric:home_value"]);
    // Advance through the backoff schedule (400ms, 1s) so the retries fire.
    await vi.runAllTimersAsync();
    const result = await promise;

    // Final state is the success payload (pro), NOT the free default.
    expect(result.tier).toBe("pro");
    expect(result.access).toEqual(PRO_PAYLOAD.access);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries a non-ok 5xx response then resolves on recovery", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce(mockOkResponse(PRO_PAYLOAD));

    const promise = fetchEntitlementsWithRetry(["metric:home_value"]);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.tier).toBe("pro");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry an aborted request (intentional unmount/navigation/HMR)", async () => {
    const abortError = new DOMException("aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortError);

    const promise = fetchEntitlementsWithRetry(["metric:home_value"]);
    // Surface the rejection synchronously to the assertion (no timers needed).
    await expect(promise).rejects.toThrow("Request aborted");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("re-throws after exhausting retries on persistent failure", async () => {
    // 1 initial attempt + 3 retries = 4 total attempts, all failing.
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    const promise = fetchEntitlementsWithRetry(["metric:home_value"]);
    // Attach a rejection handler up-front so exhaustion doesn't surface as an
    // unhandled rejection while timers advance.
    const settled = expect(promise).rejects.toThrow("Backend unreachable");
    await vi.runAllTimersAsync();
    await settled;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe("trackPaywallEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends event via POST", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await trackPaywallEvent("feature", "scores", "view", "/pricing");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/entitlements/events"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          resourceType: "feature",
          resourceId: "scores",
          eventType: "view",
          pagePath: "/pricing",
        }),
      }),
    );
  });

  it("does not throw on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    // Should not throw
    await expect(
      trackPaywallEvent("feature", "scores", "click_upgrade", "/map"),
    ).resolves.toBeUndefined();
  });
});
