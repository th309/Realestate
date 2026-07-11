import { color } from "d3";
import { describe, expect, it } from "vitest";
import {
  MOMENTUM_COLOR_STOPS,
  NO_DATA_COLOR,
  momentumLegendGradient,
  scoreToColor,
  summarizeFrame,
} from "../momentum-map-colors";

// d3 scales emit "rgb(...)" strings; normalize both sides to hex to compare.
const hex = (c: string) => color(c)!.formatHex().toLowerCase();

describe("scoreToColor", () => {
  it("returns the no-data color for 0 (missing month)", () => {
    expect(scoreToColor(0)).toBe(NO_DATA_COLOR);
  });

  it("returns exact anchor colors at bucket stops", () => {
    for (const stop of MOMENTUM_COLOR_STOPS) {
      expect(hex(scoreToColor(stop.score))).toBe(hex(stop.color));
    }
  });

  it("clamps outside the 1-99 domain", () => {
    expect(scoreToColor(150)).toBe(
      scoreToColor(MOMENTUM_COLOR_STOPS[MOMENTUM_COLOR_STOPS.length - 1].score),
    );
  });

  it("interpolates between stops (49 is not the STEADY anchor)", () => {
    expect(scoreToColor(49)).not.toBe(scoreToColor(50));
  });
});

describe("momentumLegendGradient", () => {
  it("builds a linear-gradient from every stop", () => {
    const gradient = momentumLegendGradient();
    expect(gradient).toContain("linear-gradient(to right");
    for (const stop of MOMENTUM_COLOR_STOPS) {
      expect(gradient.toLowerCase()).toContain(stop.color.toLowerCase());
    }
  });
});

describe("summarizeFrame", () => {
  // Columns: month 0 exercises all three buckets + a no-data metro.
  const scores = [
    [72, 40], // rising (>=60)
    [55, 55], // steady (50-59)
    [41, 62], // easing (<50)
    [0, 88], // no data in month 0 — excluded from denominators
  ];

  it("buckets >=60 as rising, 50-59 steady, 1-49 easing; excludes 0", () => {
    const summary = summarizeFrame(scores, 0);
    expect(summary.scoredCount).toBe(3);
    expect(summary.risingPct).toBe(33);
    expect(summary.steadyPct).toBe(33);
    expect(summary.easingPct).toBe(33);
  });

  it("handles boundary scores 50 and 60 correctly", () => {
    const boundary = [[60], [50], [49]];
    const summary = summarizeFrame(boundary, 0);
    expect(summary.risingPct).toBe(33); // 60 is FIRMING -> rising bucket
    expect(summary.steadyPct).toBe(33); // 50 is STEADY
    expect(summary.easingPct).toBe(33); // 49 is EASING
  });

  it("returns zeros for an all-empty month", () => {
    const summary = summarizeFrame([[0], [0]], 0);
    expect(summary.scoredCount).toBe(0);
    expect(summary.risingPct).toBe(0);
  });
});
