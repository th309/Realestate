import { describe, it, expect } from "@jest/globals";
import {
  activeChunk,
  activeWordIndex,
  buildCaptionChunks,
  type CaptionWord,
} from "../src/lib/caption-chunks";

const w = (word: string, startMs: number, endMs: number): CaptionWord => ({
  word,
  startMs,
  endMs,
});

describe("buildCaptionChunks", () => {
  it("caps a line at maxWords so type stays large", () => {
    const words = [
      w("one", 0, 100),
      w("two", 100, 200),
      w("three", 200, 300),
      w("four", 300, 400),
      w("five", 400, 500),
    ];
    const chunks = buildCaptionChunks(words, { maxWords: 4, maxChars: 999 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].words.map((x) => x.word)).toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
    expect(chunks[1].words.map((x) => x.word)).toEqual(["five"]);
  });

  it("breaks the line on a speech pause", () => {
    const words = [
      w("Cleveland", 0, 400),
      w("jumped", 420, 800),
      // 900ms of silence — a sentence boundary, not a mid-phrase gap.
      w("this", 1700, 1900),
      w("month", 1920, 2200),
    ];
    const chunks = buildCaptionChunks(words, { gapBreakMs: 500 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].words.map((x) => x.word)).toEqual(["Cleveland", "jumped"]);
    expect(chunks[1].words.map((x) => x.word)).toEqual(["this", "month"]);
  });

  it("breaks before a line overflows the safe width", () => {
    const words = [w("extraordinarily", 0, 100), w("comprehensive", 110, 200)];
    const chunks = buildCaptionChunks(words, { maxChars: 20 });
    expect(chunks).toHaveLength(2);
  });

  it("carries chunk bounds from its first and last word", () => {
    const chunks = buildCaptionChunks([w("a", 100, 200), w("b", 210, 500)]);
    expect(chunks[0].startMs).toBe(100);
    expect(chunks[0].endMs).toBe(500);
  });

  it("returns nothing for no words", () => {
    expect(buildCaptionChunks([])).toEqual([]);
  });
});

describe("activeChunk", () => {
  const chunks = buildCaptionChunks([
    w("first", 1000, 1400),
    w("line", 1420, 1800),
    w("second", 3000, 3400),
    w("line", 3420, 3800),
  ]);

  it("holds a line through the silence after it, so captions never blink out", () => {
    // 1800ms -> 3000ms is a gap; the first line must stay up.
    expect(activeChunk(chunks, 2400)?.words[0].word).toBe("first");
  });

  it("shows nothing before the first word", () => {
    expect(activeChunk(chunks, 0)).toBeNull();
  });

  it("swaps to the next line just before it is spoken", () => {
    expect(activeChunk(chunks, 2950)?.words[0].word).toBe("second");
  });
});

describe("activeWordIndex", () => {
  const [chunk] = buildCaptionChunks([
    w("alpha", 1000, 1400),
    w("beta", 1420, 1800),
  ]);

  it("is -1 before the first word lands", () => {
    expect(activeWordIndex(chunk, 900)).toBe(-1);
  });

  it("advances as each word is spoken", () => {
    expect(activeWordIndex(chunk, 1100)).toBe(0);
    expect(activeWordIndex(chunk, 1500)).toBe(1);
  });

  it("stays on the last word after it finishes", () => {
    expect(activeWordIndex(chunk, 5000)).toBe(1);
  });
});
