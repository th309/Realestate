import { describe, it, expect } from "@jest/globals";
import { calculateRankingMetadata } from "../src/PropertyIQVideo";
import { computeRankingTiming } from "../src/layouts/top10-timing";
import type { VideoProps } from "../src/types";

// Frame constants (must stay in sync with layouts/top10-timing.ts fallback)
//
// Ranking formats are 9:16 short-form, so they carry NO opening brand
// bumper — the hook is on screen at frame 0. The 60 frames the sting used
// to occupy are gone from the composition entirely, not reallocated, which
// is why these totals are 60 lower than they were before.
const HOOK = 45; // Hook line
const ROW = 105; // Each row reveal
const OUTRO = 60; // Closing CTA line
const BRAND_OUTRO = 90; // Brand outro card

function expectedFrames(n: number) {
  return HOOK + n * ROW + OUTRO + BRAND_OUTRO;
}

function propsForN(n: number): VideoProps {
  return {
    format: "top_10_ranking",
    resolvedMarket: { canonical_name: "Test", geography: "metro", id: "0" },
    dataBundle: null,
    ctaUrl: "https://propertyiq.com",
    params: {
      format: "top_10_ranking",
      direction: "top",
      metric: {
        id: "piq_score",
        label: "PIQ Score",
        unit: "",
        format: "index",
      },
      scope: { type: "national", id: null, label: "United States" },
      geo_level: "metro",
      as_of: "2026-04-01",
      resolved_markets: Array.from({ length: n }, (_, i) => ({
        rank: i + 1,
        region_id: String(i),
        region_name: `Metro ${i}`,
        state: "NY",
        value: 100 - i,
        value_formatted: `${100 - i}`,
      })),
    },
  } as VideoProps;
}

describe("calculateRankingMetadata", () => {
  it("returns the required Remotion metadata shape", () => {
    const m = calculateRankingMetadata({ props: propsForN(10) } as any);
    expect(m.fps).toBe(30);
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1920);
    expect(typeof m.durationInFrames).toBe("number");
    expect(m.durationInFrames).toBeGreaterThan(0);
  });

  it("duration scales linearly with resolved_markets.length (each row = 105 frames)", () => {
    const d5 = calculateRankingMetadata({
      props: propsForN(5),
    } as any).durationInFrames;
    const d10 = calculateRankingMetadata({
      props: propsForN(10),
    } as any).durationInFrames;
    expect(d10 - d5).toBe(5 * ROW);
  });

  it("N=5 → 720 frames (45+525+60+90, no bumper)", () => {
    const d = calculateRankingMetadata({
      props: propsForN(5),
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(5)); // 720
  });

  it("N=10 → 1245 frames (45+1050+60+90, no bumper)", () => {
    const d = calculateRankingMetadata({
      props: propsForN(10),
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10)); // 1245
  });

  it("defaults to 10 rows when params is absent (durationInFrames = 1245)", () => {
    const d = calculateRankingMetadata({
      props: { format: "top_10_ranking" } as any,
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10)); // 1245
  });

  it("caps at the rows the layout actually renders", () => {
    // An over-fetched candidate list must not stretch the composition past
    // what plays. Top10Layout slices to 10, so 15 candidates still yield a
    // 10-row duration — otherwise the video runs on past its own outro.
    const overfetched = {
      ...(propsForN(10) as any),
      params: {
        ...(propsForN(10) as any).params,
        resolved_markets: Array.from({ length: 15 }, (_, i) => ({
          rank: i + 1,
          region_id: `r${i}`,
          region_name: `Market ${i}`,
          state: "TX",
          value: 100 - i,
          value_formatted: `${100 - i}`,
        })),
      },
    };
    const d = calculateRankingMetadata({
      props: overfetched,
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10));
  });

  it("opens on the hook at frame 0 — no bumper gap on vertical", () => {
    const timing = computeRankingTiming(10, undefined, false);
    expect(timing.hookStartFrame).toBe(0);
  });

  it("still reserves the bumper when a format opts in", () => {
    const timing = computeRankingTiming(10, undefined, true);
    expect(timing.hookStartFrame).toBe(60);
  });
});
