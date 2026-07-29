import { describe, expect, it } from "vitest";
import {
  computeScriptBudget,
  countWords,
  estimateSpeechSeconds,
  sumPauseSeconds,
  type NarrationSegmentLike,
} from "../script-budget";

function seg(text: string, breakAfterMs = 0): NarrationSegmentLike {
  return { text, breakAfterMs };
}

describe("countWords splits on whitespace and ignores padding", () => {
  it("returns 0 for empty and whitespace-only input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n  ")).toBe(0);
  });

  it("collapses runs of whitespace rather than counting them", () => {
    expect(countWords("Charlotte   is    moving")).toBe(3);
  });
});

describe("sumPauseSeconds converts inserted silence exactly", () => {
  it("totals the segmenter's break values", () => {
    // 500 (paragraph) + 350 (sentence) + 0 (last segment) = 850ms
    expect(sumPauseSeconds([seg("a", 500), seg("b", 350), seg("c", 0)])).toBe(
      0.85,
    );
  });

  it("is zero for a single unbroken segment", () => {
    expect(sumPauseSeconds([seg("one breath", 0)])).toBe(0);
  });
});

describe("estimateSpeechSeconds weights numeric tokens by spoken length", () => {
  it("counts a plain word as one spoken word", () => {
    // 140 words at 140 wpm = 60s, so 1 word = 60/140 s.
    expect(estimateSpeechSeconds([seg("Charlotte")], 140)).toBeCloseTo(
      60 / 140,
      5,
    );
  });

  it("charges a percentage for its digits plus point plus percent", () => {
    // "34.2%" speaks as "thirty four point two percent" = 5 words.
    expect(estimateSpeechSeconds([seg("34.2%")], 140)).toBeCloseTo(
      (5 / 140) * 60,
      5,
    );
  });

  it("charges currency for its digits plus the unit", () => {
    // "$1,240" -> 4 digits + "dollars" = 5.
    expect(estimateSpeechSeconds([seg("$1,240")], 140)).toBeCloseTo(
      (5 / 140) * 60,
      5,
    );
  });

  it("charges an abbreviated magnitude for its suffix", () => {
    // "$499K" -> 3 digits + "dollars" + "thousand" = 5.
    expect(estimateSpeechSeconds([seg("$499K")], 140)).toBeCloseTo(
      (5 / 140) * 60,
      5,
    );
  });

  it("reports a data-dense line as longer than its word count implies", () => {
    const line = "Charlotte is up 34.2% to $499K";
    // countWords sees 6 tokens; spoken cost is 1+1+1+5+1+5 = 14.
    expect(countWords(line)).toBe(6);
    expect(estimateSpeechSeconds([seg(line)], 140)).toBeCloseTo(
      (14 / 140) * 60,
      5,
    );
  });

  it("costs {{SHORT_LINK}} as the four words TTS actually speaks", () => {
    // synthesize-audio.handler.ts swaps the token for "Property IQ dot app"
    // before synthesis. Counting the stored token as one word under-reports
    // every script that ends with a call to action — which is nearly all of
    // them — and the meter would show spare time on a script that overflows.
    expect(estimateSpeechSeconds([seg("{{SHORT_LINK}}")], 140)).toBeCloseTo(
      (4 / 140) * 60,
      5,
    );
  });

  it("costs a full CTA line including the substituted link", () => {
    // "Learn more at" = 3, "{{SHORT_LINK}}" -> 4. Total 7.
    expect(
      estimateSpeechSeconds([seg("Learn more at {{SHORT_LINK}}")], 140),
    ).toBeCloseTo((7 / 140) * 60, 5);
  });

  it("splits hyphenated compounds spoken as separate words", () => {
    // "3-bed" is "three bed" = 2 words, not 1.
    expect(estimateSpeechSeconds([seg("3-bed")], 140)).toBeCloseTo(
      (2 / 140) * 60,
      5,
    );
  });

  it("charges a ratio for its spoken connector", () => {
    // "1:4" is "one to four" = 3 words.
    expect(estimateSpeechSeconds([seg("1:4")], 140)).toBeCloseTo(
      (3 / 140) * 60,
      5,
    );
  });

  it("costs a year by its digits", () => {
    // "2026" -> 4. Spoken "twenty twenty six" is 3, so this leans slightly
    // long on years; documented rather than special-cased.
    expect(estimateSpeechSeconds([seg("2026")], 140)).toBeCloseTo(
      (4 / 140) * 60,
      5,
    );
  });

  it("costs a ZIP code by its digits", () => {
    // "28202" -> 5, matching "two eight two zero two" digit-by-digit reading.
    expect(estimateSpeechSeconds([seg("28202")], 140)).toBeCloseTo(
      (5 / 140) * 60,
      5,
    );
  });

  it("sums across segments", () => {
    const total = estimateSpeechSeconds([seg("one two"), seg("three")], 140);
    expect(total).toBeCloseTo((3 / 140) * 60, 5);
  });

  it("returns zero for no segments", () => {
    expect(estimateSpeechSeconds([], 140)).toBe(0);
  });

  it("rejects a non-positive pace rather than dividing by zero", () => {
    expect(() => estimateSpeechSeconds([seg("x")], 0)).toThrow(
      /naturalWpm must be positive/,
    );
  });
});

describe("computeScriptBudget reports overflow against the format cap", () => {
  it("counts inserted pauses toward the total, not just speech", () => {
    // 14 words at 140wpm = 6s of speech, plus 0.85s of inserted silence.
    const segments = [
      seg("one two three four five six seven", 500),
      seg("eight nine ten eleven twelve thirteen fourteen", 350),
    ];
    const budget = computeScriptBudget(segments, 140, 30);
    expect(budget.speechSeconds).toBeCloseTo(6, 5);
    expect(budget.pauseSeconds).toBeCloseTo(0.85, 5);
    expect(budget.estimatedSeconds).toBeCloseTo(6.85, 5);
    expect(budget.overBySeconds).toBe(0);
    expect(budget.segmentCount).toBe(2);
  });

  it("reports how far past the cap an over-budget script runs", () => {
    // 70 words at 140wpm = 30s of speech against a 28s cap.
    const words = Array.from({ length: 70 }, () => "word").join(" ");
    const budget = computeScriptBudget([seg(words, 0)], 140, 28);
    expect(budget.estimatedSeconds).toBeCloseTo(30, 5);
    expect(budget.overBySeconds).toBeCloseTo(2, 5);
  });

  it("never reports negative overflow for a script that fits", () => {
    const budget = computeScriptBudget([seg("short", 0)], 140, 30);
    expect(budget.overBySeconds).toBe(0);
  });

  it("counts pause-only overflow — the case a word count alone would clear", () => {
    // 14 sentences of 4 words = 56 words = 24s at 140wpm, under a 25s cap.
    // But 13 sentence breaks add 4.55s, pushing the real total to 28.55s.
    const segments = Array.from({ length: 14 }, (_, i) =>
      seg("one two three four", i === 13 ? 0 : 350),
    );
    const budget = computeScriptBudget(segments, 140, 25);
    expect(budget.speechSeconds).toBeCloseTo(24, 5);
    expect(budget.pauseSeconds).toBeCloseTo(4.55, 5);
    expect(budget.overBySeconds).toBeGreaterThan(0);
  });
});
