import { color } from "d3";
import { describe, expect, it } from "vitest";
import {
  MOMENTUM_COLOR_STOPS,
  MOMENTUM_COLOR_STOPS_DARK,
  NO_DATA_COLOR,
  momentumLegendGradient,
  scoreToColor,
  stopsForMode,
  type MomentumColorMode,
} from "../momentum-map-colors";

// d3 scales emit "rgb(...)" strings; normalize both sides to hex to compare.
const hex = (c: string) => color(c)!.formatHex().toLowerCase();

const MODES: { mode: MomentumColorMode; stops: typeof MOMENTUM_COLOR_STOPS }[] =
  [
    { mode: "light", stops: MOMENTUM_COLOR_STOPS },
    { mode: "dark", stops: MOMENTUM_COLOR_STOPS_DARK },
  ];

describe("scoreToColor", () => {
  it("returns the no-data color for 0 (missing month) in both modes", () => {
    expect(scoreToColor(0)).toBe(NO_DATA_COLOR);
    expect(scoreToColor(0, "dark")).toBe(NO_DATA_COLOR);
  });

  it.each(MODES)(
    "returns exact anchor colors at bucket stops ($mode)",
    ({ mode, stops }) => {
      for (const stop of stops) {
        expect(hex(scoreToColor(stop.score, mode))).toBe(hex(stop.color));
      }
    },
  );

  it.each(MODES)(
    "clamps outside the 1-99 domain ($mode)",
    ({ mode, stops }) => {
      expect(scoreToColor(150, mode)).toBe(
        scoreToColor(stops[stops.length - 1].score, mode),
      );
    },
  );

  it("interpolates between stops (49 is not the STEADY anchor)", () => {
    expect(scoreToColor(49)).not.toBe(scoreToColor(50));
  });

  it("defaults to the light stops", () => {
    expect(scoreToColor(99)).toBe(scoreToColor(99, "light"));
    expect(scoreToColor(99)).not.toBe(scoreToColor(99, "dark"));
  });
});

describe("stopsForMode", () => {
  it("keeps both stop sets label-aligned at identical score anchors", () => {
    expect(stopsForMode("light").map((s) => s.score)).toEqual(
      stopsForMode("dark").map((s) => s.score),
    );
    expect(stopsForMode("light").map((s) => s.label)).toEqual(
      stopsForMode("dark").map((s) => s.label),
    );
  });
});

describe("momentumLegendGradient", () => {
  it.each(MODES)(
    "builds a linear-gradient from every stop ($mode)",
    ({ mode, stops }) => {
      const gradient = momentumLegendGradient(mode);
      expect(gradient).toContain("linear-gradient(to right");
      for (const stop of stops) {
        expect(gradient.toLowerCase()).toContain(stop.color.toLowerCase());
      }
    },
  );
});
