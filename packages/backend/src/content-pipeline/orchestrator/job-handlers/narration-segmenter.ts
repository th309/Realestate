/**
 * Re-export shim. The segmenter itself moved to
 * `packages/video-template/src/narration/narration-segmenter.ts` so the admin
 * script editor can compute the same pause totals the synthesis step will
 * produce — see that file's header for why one shared implementation matters.
 *
 * This path is kept so backend importers (and the colocated spec) are
 * unchanged. Nothing here should grow; add to the shared module instead.
 */
// Imported by dist path, not the `./narration` exports subpath: this package
// compiles with `moduleResolution: node`, which predates and ignores `exports`.
// The frontend (bundler resolution) uses `@propertyiq/video-template/narration`.
// Resolving video-template by dist path is the established convention here —
// see the note in that package's package.json about `./dist/*` being
// load-bearing for the backend renderer.
export {
  segmentNarration,
  PARAGRAPH_BREAK_MS,
  SENTENCE_BREAK_MS,
  CLAUSE_BREAK_MS,
} from '@propertyiq/video-template/dist/narration/narration-segmenter';
export type { NarrationSegment } from '@propertyiq/video-template/dist/narration/narration-segmenter';
export {
  toSpokenText,
  toWrittenText,
  SPOKEN_SHORT_LINK,
  WRITTEN_SHORT_LINK,
} from '@propertyiq/video-template/dist/narration/spoken-text';
