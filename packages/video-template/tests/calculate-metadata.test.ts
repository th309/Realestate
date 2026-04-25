import { describe, it, expect } from "@jest/globals";
import { calculateRankingMetadata } from "../src/PropertyIQVideo";
import type { VideoProps } from "../src/types";

// Frame constants (must stay in sync with PropertyIQVideo.tsx)
const BUMPER = 60; // 2.0 s brand sting
const INTRO = 90; // 3.0 s
const ROW = 150; // 5.0 s per row
const OUTRO = 135; // 4.5 s
const BRAND_OUTRO = 120; // 4.0 s

function expectedFrames(n: number) {
  return BUMPER + INTRO + n * ROW + OUTRO + BRAND_OUTRO;
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

  it("duration scales linearly with resolved_markets.length (each row = 150 frames)", () => {
    const d5 = calculateRankingMetadata({
      props: propsForN(5),
    } as any).durationInFrames;
    const d10 = calculateRankingMetadata({
      props: propsForN(10),
    } as any).durationInFrames;
    expect(d10 - d5).toBe(5 * ROW);
  });

  it("N=5 → 1155 frames (60+90+750+135+120)", () => {
    const d = calculateRankingMetadata({
      props: propsForN(5),
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(5)); // 1155
  });

  it("N=10 → 1905 frames (60+90+1500+135+120)", () => {
    const d = calculateRankingMetadata({
      props: propsForN(10),
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10)); // 1905
  });

  it("defaults to 10 rows when params is absent (durationInFrames = 1905)", () => {
    const d = calculateRankingMetadata({
      props: { format: "top_10_ranking" } as any,
    } as any).durationInFrames;
    expect(d).toBe(expectedFrames(10)); // 1905
  });
});
