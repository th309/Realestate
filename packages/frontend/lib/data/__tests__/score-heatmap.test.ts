import { describe, expect, it } from "vitest";
import { isValidHeatmapPayload } from "../fetchers/score-heatmap";

const validPayload = {
  months: ["2026-04-30", "2026-05-31"],
  metros: [
    {
      id: "19780",
      name: "Des Moines-West Des Moines, IA",
      lat: 41.512,
      lon: -93.729,
      pop: 737164,
      conf: "A",
    },
  ],
  scores: [[55, 57]],
};

describe("isValidHeatmapPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(isValidHeatmapPayload(validPayload)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidHeatmapPayload(null)).toBe(false);
  });

  it("rejects a matrix with the wrong number of rows", () => {
    expect(
      isValidHeatmapPayload({
        ...validPayload,
        scores: [
          [55, 57],
          [1, 2],
        ],
      }),
    ).toBe(false);
  });

  it("rejects a row whose length disagrees with months", () => {
    expect(isValidHeatmapPayload({ ...validPayload, scores: [[55]] })).toBe(
      false,
    );
  });

  it("rejects empty months or metros", () => {
    expect(isValidHeatmapPayload({ ...validPayload, months: [] })).toBe(false);
    expect(
      isValidHeatmapPayload({ ...validPayload, metros: [], scores: [] }),
    ).toBe(false);
  });
});
