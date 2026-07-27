import { describe, it, expect } from "vitest";
import { toEditableCopy } from "../posts-api";

/**
 * The copy PATCH replaces the whole `copy` JSONB and the backend's validation
 * whitelist drops unknown keys, so what this function returns is exactly what
 * survives a save. Anything it forgets to carry is destroyed on the round trip.
 */
describe("toEditableCopy keeps every field the copy endpoint accepts", () => {
  it("carries the post fields the editor exposes", () => {
    expect(
      toEditableCopy({
        hook: "Austin just flipped",
        body: "Days on market fell.",
        cta: "See the score",
        hashtags: ["austin", "realestate"],
      }),
    ).toEqual({
      hook: "Austin just flipped",
      body: "Days on market fell.",
      cta: "See the score",
      hashtags: ["austin", "realestate"],
    });
  });

  it("carries fields the editor does NOT expose, so a save can't destroy them", () => {
    const saved = toEditableCopy({
      hook: "Why renters are buying",
      slides: [{ heading: "One", body: "First" }],
      title: "Renting versus buying",
      close: "Follow for more",
      sceneDirection: "Cut to the chart",
      durationSeconds: 45,
      suggestedFormat: "grade_reveal",
      suggestedMarketQuery: "Austin, TX",
    });

    expect(saved.slides).toEqual([{ heading: "One", body: "First" }]);
    expect(saved.title).toBe("Renting versus buying");
    expect(saved.close).toBe("Follow for more");
    expect(saved.sceneDirection).toBe("Cut to the chart");
    expect(saved.durationSeconds).toBe(45);
    expect(saved.suggestedFormat).toBe("grade_reveal");
    expect(saved.suggestedMarketQuery).toBe("Austin, TX");
  });

  it("drops keys the backend would strip anyway, rather than sending them", () => {
    const saved = toEditableCopy({
      hook: "Austin just flipped",
      somethingTheModelInvented: "nonsense",
    });
    expect(saved).toEqual({ hook: "Austin just flipped" });
  });

  it("omits absent fields instead of sending explicit undefined", () => {
    expect(Object.keys(toEditableCopy({ hook: "Only a hook" }))).toEqual([
      "hook",
    ]);
  });
});
