/**
 * Groups word timings into short on-screen caption lines.
 *
 * Short-form captions read as a small group of words with the spoken word
 * highlighted, not as a continuously sliding ticker: the eye locks onto a
 * stable line and tracks one moving accent. That means we need explicit
 * line grouping rather than a time-window filter.
 *
 * Pure functions — no React, no Remotion — so the grouping is unit-testable
 * without rendering a frame.
 */

export interface CaptionWord {
  startMs: number;
  endMs: number;
  word: string;
}

export interface CaptionChunk {
  words: CaptionWord[];
  startMs: number;
  endMs: number;
}

export interface ChunkOptions {
  /** Hard cap on words per line — keeps type large enough to read on a phone. */
  maxWords: number;
  /** Cap on rendered characters, so long words don't overflow the safe area. */
  maxChars: number;
  /**
   * A silence longer than this ends the line. Natural pauses are sentence
   * boundaries far more often than not, so breaking there keeps lines
   * grammatical instead of splitting mid-phrase.
   */
  gapBreakMs: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxWords: 4,
  maxChars: 30,
  gapBreakMs: 500,
};

export function buildCaptionChunks(
  words: readonly CaptionWord[],
  options: Partial<ChunkOptions> = {},
): CaptionChunk[] {
  const { maxWords, maxChars, gapBreakMs } = {
    ...DEFAULT_CHUNK_OPTIONS,
    ...options,
  };
  const chunks: CaptionChunk[] = [];
  let current: CaptionWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({
      words: current,
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
    });
    current = [];
  };

  for (const word of words) {
    if (current.length > 0) {
      const prev = current[current.length - 1];
      const gap = word.startMs - prev.endMs;
      const charsIfAdded =
        current.reduce((n, w) => n + w.word.length + 1, 0) + word.word.length;
      if (
        gap > gapBreakMs ||
        current.length >= maxWords ||
        charsIfAdded > maxChars
      ) {
        flush();
      }
    }
    current.push(word);
  }
  flush();

  return chunks;
}

/**
 * The chunk on screen at `currentMs`, or null.
 *
 * A chunk stays up through the silence that follows it (until the next one
 * begins) so captions don't blink out between phrases — dropping to nothing
 * mid-sentence reads as a glitch.
 */
export function activeChunk(
  chunks: readonly CaptionChunk[],
  currentMs: number,
  leadInMs = 120,
): CaptionChunk | null {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const next = chunks[i + 1];
    const from = chunk.startMs - leadInMs;
    const to = next ? next.startMs - leadInMs : chunk.endMs + 400;
    if (currentMs >= from && currentMs < to) return chunk;
  }
  return null;
}

/** Index of the word being spoken within a chunk; -1 before the first. */
export function activeWordIndex(
  chunk: CaptionChunk,
  currentMs: number,
): number {
  let index = -1;
  for (let i = 0; i < chunk.words.length; i++) {
    if (currentMs >= chunk.words[i].startMs) index = i;
  }
  return index;
}
