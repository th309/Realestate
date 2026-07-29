/**
 * Pure narration helpers, shared between the backend synthesis pipeline and the
 * admin script editor. No Remotion, no React — safe in a Next.js bundle.
 *
 * NOTE: this package ships from `dist/`. Run `npm run build:cli -w
 * @propertyiq/video-template` (or `npm run build:libs`) after editing, or
 * consumers resolve stale output.
 */
export {
  segmentNarration,
  PARAGRAPH_BREAK_MS,
  SENTENCE_BREAK_MS,
  CLAUSE_BREAK_MS,
} from "./narration-segmenter";
export type { NarrationSegment } from "./narration-segmenter";

export {
  toSpokenText,
  toWrittenText,
  SPOKEN_SHORT_LINK,
  WRITTEN_SHORT_LINK,
} from "./spoken-text";
