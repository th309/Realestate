import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "../base";

const mockFetchAPI = vi.fn();

vi.mock("../base", async () => {
  const actual = await vi.importActual<typeof import("../base")>("../base");
  return {
    ...actual,
    fetchAPI: (...a: unknown[]) => mockFetchAPI(...a),
    fetchAPIWithParams: (...a: unknown[]) => mockFetchAPI(...a),
  };
});

import { fetchScore, fetchScoreExpanded } from "../scores";

describe("fetchScore / fetchScoreExpanded 404 handling", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetchAPI.mockReset();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  it("returns null WITHOUT logging when the score endpoint 404s (unscored geo)", async () => {
    // ~5,376 ZIPs / 87 counties exist in search but have no PropertyIQ score.
    // A 404 there is expected, not an error — it must not pop the dev overlay.
    mockFetchAPI.mockRejectedValue(new ApiError(404));

    const result = await fetchScore("zip", "00601");

    expect(result).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("still returns null AND logs on a real failure (5xx)", async () => {
    mockFetchAPI.mockRejectedValue(new ApiError(500));

    const result = await fetchScore("metro", "12420");

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("fetchScoreExpanded is silent on 404 too", async () => {
    mockFetchAPI.mockRejectedValue(new ApiError(404));

    const result = await fetchScoreExpanded("county", "72005", {
      historyMonths: 6,
    });

    expect(result).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
