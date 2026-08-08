import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) =>
  readFileSync(join(__dirname, "..", rel), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

const KPI_STRIP = read("explorer/components/KpiStrip.tsx");
const LEADERBOARD = read("explorer/components/Leaderboard.tsx");
const DETAIL_RAIL = read("explorer/components/DetailRail.tsx");
const EXPLORER = read("explorer/MarketExplorer.tsx");

describe("market defers to the shared primitives", () => {
  it("renders the KPI strip through KpiTile", () => {
    expect(KPI_STRIP).toContain("KpiTile");
  });

  it("renders rankings through DataTable", () => {
    expect(LEADERBOARD).toContain("DataTable");
  });

  it("renders ranking scores through ScorePill", () => {
    expect(LEADERBOARD).toContain("ScorePill");
  });

  it("uses no arbitrary hex", () => {
    expect(KPI_STRIP + LEADERBOARD + DETAIL_RAIL + EXPLORER).not.toMatch(
      /\[#[0-9A-Fa-f]{3,8}\]/,
    );
  });
});

/**
 * The KPI tiles previously showed a bare label and a number — "PIQ score" with
 * no indication of what scale it is on. The plan calls for the caption line
 * each metric lacked.
 */
describe("market KPI tiles say what the metric is", () => {
  it("gives every tile a caption", () => {
    // Six call sites (five tiles, two of which swap for state scope).
    const captions = KPI_STRIP.match(/^\s*"[^"]+",$/gm) ?? [];
    expect(captions.length).toBeGreaterThanOrEqual(12);
  });

  it("states the score's scale as 1-99, never 0-100", () => {
    expect(KPI_STRIP).toContain("1–99");
    expect(KPI_STRIP).not.toMatch(/0\s*[-–]\s*100|out of 100/);
  });
});

/**
 * The ranking rows carried a hand-rolled score pill with a comment declaring
 * itself an exception to the shared score components. ScorePill is that
 * compact form, so the exception should no longer exist.
 */
describe("market rankings retire the score-badge exception", () => {
  it("no longer documents an exception to the score components", () => {
    expect(LEADERBOARD).not.toMatch(/documented exception/i);
  });

  it("carries no hand-rolled score colours", () => {
    expect(LEADERBOARD).not.toContain("scoreBg");
    expect(LEADERBOARD).not.toContain("scoreColor");
  });

  it("selects in place rather than navigating away", () => {
    // Rankings highlight a market; they do not leave the page. That is a
    // button (Enter or Space), not a link.
    expect(LEADERBOARD).toContain('rowRole="button"');
  });
});
