/**
 * Narration segmentation — splits a voice-over script into the clips that get
 * synthesized independently and re-joined with inserted silence.
 *
 * Why not SSML `<break>`? The python `edge-tts` CLI rejects SSML input (it
 * escapes whatever it is given and speaks the markup), so per-clip synthesis
 * plus generated silence IS the working equivalent of `<break time="350ms"/>`
 * for this stack. Azure's REST endpoint does take SSML, but narration must
 * sound identical whichever driver in the chain wins, so both go through the
 * same segmentation path.
 *
 * Secondary benefit: short per-segment texts keep the edge-tts argv well
 * under the Windows command-line length limit (see edge-tts-driver.ts — its
 * comment claims stdin piping but the code passes `--text`).
 *
 * WHY IT LIVES HERE RATHER THAN IN THE BACKEND
 * Two consumers need identical results. The backend synthesizes the audio whose
 * probed duration is enforced against the format's audio budget; the admin
 * script editor shows the operator a live duration estimate while they type, and
 * the inserted silence below is a material part of that total (fifteen short
 * sentences carry ~5.25s of pure pause). A round-trip to the backend per
 * keystroke is not viable, and a second implementation in the frontend would
 * drift the moment someone edits ABBREVIATIONS. So this stays one pure,
 * dependency-free function shared from `@propertyiq/video-template/narration`.
 *
 * The backend keeps a re-export at its original path, so nothing there had to
 * change. NOTE: this package ships from `dist/` — run `npm run build:cli -w
 * @propertyiq/video-template` (or `npm run build:libs`) after editing, or
 * consumers resolve stale output.
 */

export interface NarrationSegment {
  /** Text handed to the TTS driver as one synthesis request. */
  text: string;
  /** Silence inserted after this segment before the next one. */
  breakAfterMs: number;
}

export const PARAGRAPH_BREAK_MS = 500;
export const SENTENCE_BREAK_MS = 350;
export const CLAUSE_BREAK_MS = 200;

/** Scripts shorter than this are one breath — segmenting them adds nothing. */
const SHORT_INPUT_CHARS = 120;
/** Fragments below this get merged into a neighbor rather than clipped alone. */
const MIN_SEGMENT_CHARS = 40;
/** Above this a sentence is split at clause punctuation so prosody resets. */
const MAX_SEGMENT_CHARS = 280;

const TERMINATORS = ".!?";
const CLOSERS = "\"')]”’";
const DASHES = "—–";

/**
 * Words whose trailing period is not a sentence end. Over-merging (missing a
 * split) only makes a segment longer; under-merging puts a 350ms pause inside
 * "St. Louis", so the list errs toward keeping text together.
 */
const ABBREVIATIONS = new Set(
  "approx ave blvd ca co corp ct dr est fig inc jr lt ltd mr mrs ms mt no prof rd sq sr st vs".split(
    " ",
  ),
);

export function segmentNarration(text: string): NarrationSegment[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length < SHORT_INPUT_CHARS) {
    return [{ text: collapseWhitespace(normalized), breakAfterMs: 0 }];
  }

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map(collapseWhitespace)
    .filter(Boolean);

  const segments: NarrationSegment[] = [];
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const sentences = mergeShortFragments(splitSentences(paragraph));
    const isLastParagraph = paragraphIndex === paragraphs.length - 1;
    sentences.forEach((sentence, sentenceIndex) => {
      const endsParagraph = sentenceIndex === sentences.length - 1;
      const sentenceBreakMs =
        endsParagraph && !isLastParagraph
          ? PARAGRAPH_BREAK_MS
          : SENTENCE_BREAK_MS;
      const chunks = splitLongSentence(sentence);
      chunks.forEach((chunk, chunkIndex) => {
        segments.push({
          text: chunk,
          breakAfterMs:
            chunkIndex === chunks.length - 1
              ? sentenceBreakMs
              : CLAUSE_BREAK_MS,
        });
      });
    });
  });

  if (segments.length === 0) return [];
  segments[segments.length - 1].breakAfterMs = 0;
  return segments;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function splitSentences(paragraph: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < paragraph.length; i++) {
    const ch = paragraph[i];
    if (!TERMINATORS.includes(ch)) continue;

    // Absorb terminator runs ("...", "?!") and any closing quote or bracket.
    let end = i;
    while (
      end + 1 < paragraph.length &&
      TERMINATORS.includes(paragraph[end + 1])
    )
      end++;
    let close = end;
    while (
      close + 1 < paragraph.length &&
      CLOSERS.includes(paragraph[close + 1])
    )
      close++;

    const rest = paragraph.slice(close + 1);
    // Mid-token dot: decimals like "3.2", domains like "propertyiq.app".
    if (rest.length > 0 && !/^\s/.test(rest)) {
      i = close;
      continue;
    }
    if (
      ch === "." &&
      end === i &&
      endsWithAbbreviation(paragraph.slice(start, i))
    ) {
      i = close;
      continue;
    }
    // Real boundaries are followed by something that opens a new sentence.
    const opener = /^\s+(\S)/.exec(rest);
    if (opener && !/[A-Z0-9"'“‘([]/.test(opener[1])) {
      i = close;
      continue;
    }

    const sentence = paragraph.slice(start, close + 1).trim();
    if (sentence) out.push(sentence);
    start = close + 1;
    i = close;
  }
  const tail = paragraph.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function endsWithAbbreviation(textBeforeDot: string): boolean {
  // Initialisms: "U.S", "e.g" — single letters chained by dots.
  if (/(?:^|[^A-Za-z.])(?:[A-Za-z]\.)+[A-Za-z]$/.test(textBeforeDot))
    return true;
  const word = /([A-Za-z]+)$/.exec(textBeforeDot);
  return !!word && ABBREVIATIONS.has(word[1].toLowerCase());
}

function mergeShortFragments(sentences: string[]): string[] {
  if (sentences.length <= 1) return sentences;
  const out: string[] = [];
  for (const sentence of sentences) {
    const previous = out[out.length - 1];
    if (previous !== undefined && previous.length < MIN_SEGMENT_CHARS) {
      out[out.length - 1] = `${previous} ${sentence}`;
    } else {
      out.push(sentence);
    }
  }
  if (out.length > 1 && out[out.length - 1].length < MIN_SEGMENT_CHARS) {
    const orphan = out.pop() as string;
    out[out.length - 1] = `${out[out.length - 1]} ${orphan}`;
  }
  return out;
}

function splitLongSentence(sentence: string): string[] {
  if (sentence.length <= MAX_SEGMENT_CHARS) return [sentence];

  const clauses: string[] = [];
  let start = 0;
  for (let i = 0; i < sentence.length; i++) {
    const ch = sentence[i];
    const isDash = DASHES.includes(ch);
    if (!isDash && ch !== "," && ch !== ";" && ch !== ":") continue;
    // "1,200" and "3:30" are not clause boundaries; an em dash always is.
    const next = sentence[i + 1];
    if (!isDash && next !== undefined && !/\s/.test(next)) continue;
    const clause = trimTrailingDash(sentence.slice(start, i + 1));
    if (clause) clauses.push(clause);
    start = i + 1;
  }
  const tail = sentence.slice(start).trim();
  if (tail) clauses.push(tail);
  if (clauses.length < 2) return [sentence];

  // Pack clauses back up to the cap so we clip on breath groups, not commas.
  const chunks: string[] = [];
  for (const clause of clauses) {
    const previous = chunks[chunks.length - 1];
    if (
      previous !== undefined &&
      `${previous} ${clause}`.length <= MAX_SEGMENT_CHARS
    ) {
      chunks[chunks.length - 1] = `${previous} ${clause}`;
    } else {
      chunks.push(clause);
    }
  }
  if (
    chunks.length > 1 &&
    chunks[chunks.length - 1].length < MIN_SEGMENT_CHARS
  ) {
    const orphan = chunks.pop() as string;
    chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${orphan}`;
  }
  return chunks;
}

function trimTrailingDash(clause: string): string {
  return clause.trim().replace(/[—–]$/, "").trim();
}
