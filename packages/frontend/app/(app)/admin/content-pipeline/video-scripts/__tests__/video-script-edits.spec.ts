import { describe, it, expect } from "vitest";
import type { PostCopy } from "../../lib/posts-api";
import { normalizeVideoScript, buildMakeVideoHref } from "../video-script-copy";
import {
  SCRIPT_FIELD_LIMITS,
  applyVideoScriptEdits,
  closeFieldKey,
  isStructuredScriptCopy,
  toVideoScriptEdits,
} from "../video-script-edits";

/** A structured video_script row, as the feed writes them today. */
const structuredCopy: PostCopy = {
  title: "Austin is cooling",
  hook: "Austin just flipped",
  body: "Prices down 4%.",
  close: "Follow for more",
  sceneDirection: "Skyline b-roll",
  durationSeconds: 45,
  suggestedFormat: "score_mover",
  suggestedMarketQuery: "Austin, TX",
};

/** An older row: hook/body/cta and nothing else. */
const legacyCopy: PostCopy = {
  hook: "Big news",
  body: "Details",
  cta: "Subscribe",
};

describe("toVideoScriptEdits seeds from the row, not from the display fallbacks", () => {
  it("reads the structured fields straight through", () => {
    expect(toVideoScriptEdits(structuredCopy)).toEqual({
      title: "Austin is cooling",
      hook: "Austin just flipped",
      body: "Prices down 4%.",
      close: "Follow for more",
      sceneDirection: "Skyline b-roll",
    });
  });

  it("leaves title blank on a legacy row even though the card shows the hook there", () => {
    const edits = toVideoScriptEdits(legacyCopy);
    expect(normalizeVideoScript({ copy: legacyCopy }).title).toBe("Big news");
    expect(edits.title).toBe("");
    // The legacy cta is what the "Close" field edits.
    expect(edits.close).toBe("Subscribe");
  });

  it("never seeds the Untitled script placeholder", () => {
    expect(normalizeVideoScript({ copy: {} }).title).toBe("Untitled script");
    expect(toVideoScriptEdits({}).title).toBe("");
    expect(toVideoScriptEdits(null).title).toBe("");
  });
});

describe("applyVideoScriptEdits round-trips an untouched script", () => {
  it("returns a deep-equal copy for the structured shape", () => {
    const next = applyVideoScriptEdits(
      structuredCopy,
      toVideoScriptEdits(structuredCopy),
    );
    expect(next).toEqual(structuredCopy);
  });

  it("returns a deep-equal copy for the legacy shape — no silent conversion", () => {
    const next = applyVideoScriptEdits(
      legacyCopy,
      toVideoScriptEdits(legacyCopy),
    );
    expect(next).toEqual(legacyCopy);
    expect(next.title).toBeUndefined();
    expect(next.close).toBeUndefined();
    expect(next.sceneDirection).toBeUndefined();
  });

  it("keeps fields the editor never surfaced", () => {
    const copy: PostCopy = {
      ...legacyCopy,
      hashtags: ["austin", "realestate"],
      slides: [{ heading: "One", body: "Two" }],
      someFutureField: { nested: true },
    };
    const next = applyVideoScriptEdits(copy, toVideoScriptEdits(copy));
    expect(next).toEqual(copy);
  });

  it("treats a whitespace-only difference as untouched", () => {
    const copy: PostCopy = { hook: "  Big news  ", body: "Details" };
    const next = applyVideoScriptEdits(copy, {
      ...toVideoScriptEdits(copy),
      hook: "Big news",
    });
    expect(next.hook).toBe("  Big news  ");
  });
});

describe("applyVideoScriptEdits writes close back to the key the row uses", () => {
  it("writes cta on a legacy row", () => {
    const next = applyVideoScriptEdits(legacyCopy, {
      ...toVideoScriptEdits(legacyCopy),
      close: "Hit follow",
    });
    expect(next.cta).toBe("Hit follow");
    expect(next.close).toBeUndefined();
    // Still reads back correctly through the display path.
    expect(normalizeVideoScript({ copy: next }).close).toBe("Hit follow");
  });

  it("writes close on a structured row", () => {
    const next = applyVideoScriptEdits(structuredCopy, {
      ...toVideoScriptEdits(structuredCopy),
      close: "Subscribe for the next one",
    });
    expect(next.close).toBe("Subscribe for the next one");
    expect(next.cta).toBeUndefined();
  });

  it("collapses a duplicate cta rather than leaving a shadow value", () => {
    const copy: PostCopy = { ...structuredCopy, cta: "Old legacy cta" };
    const next = applyVideoScriptEdits(copy, {
      ...toVideoScriptEdits(copy),
      close: "New close",
    });
    expect(next.close).toBe("New close");
    expect(next.cta).toBeUndefined();
  });

  it("stays legacy when a row has neither key yet", () => {
    const copy: PostCopy = { hook: "H", body: "B" };
    const next = applyVideoScriptEdits(copy, {
      ...toVideoScriptEdits(copy),
      close: "Added",
    });
    expect(next.cta).toBe("Added");
    expect(next.close).toBeUndefined();
  });

  it("goes structured when a row already carries structured metadata", () => {
    const copy: PostCopy = {
      hook: "H",
      body: "B",
      suggestedFormat: "grade_reveal",
    };
    const next = applyVideoScriptEdits(copy, {
      ...toVideoScriptEdits(copy),
      close: "Added",
    });
    expect(next.close).toBe("Added");
    expect(next.cta).toBeUndefined();
  });
});

describe("applyVideoScriptEdits handles added and cleared fields", () => {
  it("adds title and scene direction when the operator types them", () => {
    const next = applyVideoScriptEdits(legacyCopy, {
      ...toVideoScriptEdits(legacyCopy),
      title: "A real title",
      sceneDirection: "Drone shot",
    });
    expect(next.title).toBe("A real title");
    expect(next.sceneDirection).toBe("Drone shot");
    // The rest of the legacy row is untouched.
    expect(next.cta).toBe("Subscribe");
  });

  it("removes the key when a field is cleared", () => {
    const next = applyVideoScriptEdits(structuredCopy, {
      ...toVideoScriptEdits(structuredCopy),
      title: "",
      sceneDirection: "   ",
    });
    expect("title" in next).toBe(false);
    expect("sceneDirection" in next).toBe(false);
    // Cleared title falls back to the hook for display.
    expect(normalizeVideoScript({ copy: next }).title).toBe(
      "Austin just flipped",
    );
  });

  it("trims what it writes", () => {
    const next = applyVideoScriptEdits(structuredCopy, {
      ...toVideoScriptEdits(structuredCopy),
      body: "  Trimmed body  ",
    });
    expect(next.body).toBe("Trimmed body");
  });
});

describe("applyVideoScriptEdits drops metadata the backend would reject", () => {
  it("rounds a fractional duration to the integer the DTO requires", () => {
    const copy: PostCopy = { ...structuredCopy, durationSeconds: 45.6 };
    const next = applyVideoScriptEdits(copy, {
      ...toVideoScriptEdits(copy),
      hook: "Edited",
    });
    expect(next.durationSeconds).toBe(46);
  });

  it("drops an out-of-range or non-numeric duration", () => {
    for (const durationSeconds of [2, 900, "sixty" as unknown as number]) {
      const copy: PostCopy = { ...structuredCopy, durationSeconds };
      const next = applyVideoScriptEdits(copy, toVideoScriptEdits(copy));
      expect("durationSeconds" in next).toBe(false);
    }
  });

  it("drops a suggestedFormat outside the accepted formats but keeps a valid one", () => {
    const bad = applyVideoScriptEdits(
      { ...structuredCopy, suggestedFormat: "not_a_format" },
      toVideoScriptEdits(structuredCopy),
    );
    expect("suggestedFormat" in bad).toBe(false);

    const good = applyVideoScriptEdits(
      { ...structuredCopy, suggestedFormat: "infographic" },
      toVideoScriptEdits(structuredCopy),
    );
    expect(good.suggestedFormat).toBe("infographic");
  });

  it("drops an over-long market query", () => {
    const copy: PostCopy = {
      ...structuredCopy,
      suggestedMarketQuery: "x".repeat(121),
    };
    const next = applyVideoScriptEdits(copy, toVideoScriptEdits(copy));
    expect("suggestedMarketQuery" in next).toBe(false);
  });
});

describe("the wizard handoff follows the edited copy", () => {
  it("keeps the prefill after an unrelated edit", () => {
    const next = applyVideoScriptEdits(structuredCopy, {
      ...toVideoScriptEdits(structuredCopy),
      body: "Rewritten body",
    });
    expect(buildMakeVideoHref({ copy: next })).toBe(
      "/admin/content-pipeline/new?format=score_mover&market=Austin%2C+TX",
    );
  });
});

describe("shape helpers", () => {
  it("recognises the structured shape", () => {
    expect(isStructuredScriptCopy(structuredCopy)).toBe(true);
    expect(isStructuredScriptCopy(legacyCopy)).toBe(false);
    expect(isStructuredScriptCopy(null)).toBe(false);
  });

  it("names the close key so the editor can show the right cap", () => {
    expect(closeFieldKey(structuredCopy)).toBe("close");
    expect(closeFieldKey(legacyCopy)).toBe("cta");
    // The legacy cta is capped far lower than close — the editor shows whichever
    // limit the save will actually hit.
    expect(SCRIPT_FIELD_LIMITS.cta).toBe(500);
    expect(SCRIPT_FIELD_LIMITS.close).toBe(2200);
  });
});
