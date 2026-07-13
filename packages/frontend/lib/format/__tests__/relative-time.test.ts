import { describe, it, expect } from "vitest";
import { formatRelativeTimeShort } from "../relative-time";

describe("formatRelativeTimeShort", () => {
  it("falls through to 0m ago below a minute when no zeroLabel is given (PipelineRunsCard behavior)", () => {
    expect(formatRelativeTimeShort(0)).toBe("0m ago");
    expect(formatRelativeTimeShort(59_999)).toBe("0m ago");
  });

  it("uses the given zeroLabel below the threshold (CachedDataBadge/AlertItem behavior)", () => {
    expect(formatRelativeTimeShort(0, { zeroLabel: "moments ago" })).toBe(
      "moments ago",
    );
    expect(formatRelativeTimeShort(59_999, { zeroLabel: "Just now" })).toBe(
      "Just now",
    );
    // Exactly at the threshold falls through to the minute math.
    expect(formatRelativeTimeShort(60_000, { zeroLabel: "Just now" })).toBe(
      "1m ago",
    );
  });

  it("formats minutes, hours, and days", () => {
    expect(formatRelativeTimeShort(12 * 60_000)).toBe("12m ago");
    expect(formatRelativeTimeShort(3 * 60 * 60_000)).toBe("3h ago");
    expect(formatRelativeTimeShort(2 * 24 * 60 * 60_000)).toBe("2d ago");
  });
});
