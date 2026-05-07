import { describe, it, expect } from "@jest/globals";
import { calculateRankingMetadata } from "../src/PropertyIQVideo";
import type { VideoProps } from "../src/types";

// Frame constants (must stay in sync with layouts/top10-timing.ts fallback)
const BUMPER = 60; // Brand bumper
const HOOK = 45; // Hook line
const ROW = 105; // Each row reveal
const OUTRO = 60; // Closing CTA line
const BRAND_OUTRO = 90; // Brand outro card

function expectedFrames(n: number) {
  return BUMPER + HOOK + n * ROW + OUTRO + BRAND_OUTRO;
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

  it("N=5 → 780 frames (60+45+525+60+90)", () => {
    const d = calculateRankingMetadata({
      props: propsForN(5),
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(5)); // 780
  });

  it("N=10 → 1305 frames (60+45+1050+60+90)", () => {
    const d = calculateRankingMetadata({
      props: propsForN(10),
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10)); // 1305
  });

  it("defaults to 10 rows when params is absent (durationInFrames = 1305)", () => {
    const d = calculateRankingMetadata({
      props: { format: "top_10_ranking" } as any,
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10)); // 1305
  });
});
