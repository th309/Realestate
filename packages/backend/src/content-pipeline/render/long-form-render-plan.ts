/**
 * Aligns long-form Remotion sequences to narration using caption word timings
 * and emit_script sceneBreakdown chapters. Keep duration logic aligned with
 * `calculateLongFormMetadata` in packages/video-template.
 */

const FPS = 30;
const AUDIO_START_FRAME = 60;
const BRAND_TAIL_FRAMES = 120;

export type LongFormSegmentKind =
  | 'intro'
  | 'stats'
  | 'score'
  | 'trend'
  | 'chapter_beat'
  | 'outro'
  | 'brand_padding';

export interface LongFormSegment {
  kind: LongFormSegmentKind;
  fromFrame: number;
  durationInFrames: number;
  sceneKey?: string;
  excerpt?: string;
}

export interface LongFormRenderPlan {
  durationInFrames: number;
  segments: LongFormSegment[];
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function audioFrameAtMs(ms: number): number {
  return AUDIO_START_FRAME + Math.max(0, Math.round((ms / 1000) * FPS));
}

function charOffsetToWordIndex(
  normalizedScript: string,
  charOffset: number,
): number {
  const prefix = normalizedScript.slice(0, charOffset);
  if (!prefix.trim()) return 0;
  return prefix.trim().split(/\s+/).length;
}

function findChapterStartWordIndex(
  normalizedScript: string,
  chapterText: string,
  minCharIndex: number,
): number | null {
  const needle = normalizeWs(chapterText).slice(0, 280);
  if (!needle.length) return null;
  const idx = normalizedScript.indexOf(needle, minCharIndex);
  if (idx === -1) return null;
  return charOffsetToWordIndex(normalizedScript, idx);
}

function chapterOrderKey(sceneKey: string): number {
  const m = sceneKey.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Builds per-segment frame ranges from chapter boundaries in captions.
 * Visual order matches narrative: hook → context stats → score → trend →
 * chapter 4 beat → close → brand tail.
 */
export function buildLongFormRenderPlan(input: {
  fullText: string;
  sceneBreakdown: Array<{ sceneKey: string; text: string }>;
  captionWords: Array<{ startMs: number; endMs: number; word: string }>;
}): LongFormRenderPlan | null {
  const { fullText, sceneBreakdown, captionWords } = input;
  if (!captionWords.length || sceneBreakdown.length < 5) return null;

  const norm = normalizeWs(fullText);
  const chapters = [...sceneBreakdown].sort(
    (a, b) => chapterOrderKey(a.sceneKey) - chapterOrderKey(b.sceneKey),
  );

  const wordIndices: number[] = [];
  let minChar = 0;
  for (const ch of chapters) {
    const wi = findChapterStartWordIndex(norm, ch.text, minChar);
    if (wi === null) return null;
    wordIndices.push(wi);
    const needle = normalizeWs(ch.text).slice(0, 280);
    const idx = norm.indexOf(needle, minChar);
    if (idx === -1) return null;
    minChar = idx + needle.length;
  }

  const clampWi = (w: number) =>
    Math.max(0, Math.min(w, captionWords.length - 1));

  const wordToMs = (wi: number) => captionWords[clampWi(wi)].startMs;

  const w1 = wordIndices[0];
  const w2 = wordIndices[1];
  const w3 = wordIndices[2];
  const w4 = wordIndices[3];
  const w5 = wordIndices[4];

  const t1 = wordToMs(w1);
  const t2 = wordToMs(w2);
  const t3 = wordToMs(w3);
  const t4 = wordToMs(w4);
  const t5 = wordToMs(w5);
  const lastMs = captionWords[captionWords.length - 1].endMs;

  const mid34ms = (t3 + t4) / 2;

  const f1 = audioFrameAtMs(t1);
  const f2 = audioFrameAtMs(t2);
  const f3 = audioFrameAtMs(t3);
  const f34 = audioFrameAtMs(mid34ms);
  const f4 = audioFrameAtMs(t4);
  const f5 = audioFrameAtMs(t5);
  const fEnd = audioFrameAtMs(lastMs);

  const introDur = Math.max(1, f2 - f1);
  const statsDur = Math.max(1, f3 - f2);
  const scoreDur = Math.max(1, f34 - f3);
  const trendDur = Math.max(1, f4 - f34);
  const beatDur = Math.max(1, f5 - f4);
  const outroDur = Math.max(1, fEnd - f5);

  const ch4 = chapters.find((c) => /chapter[_\s]*4/i.test(c.sceneKey));

  const segments: LongFormSegment[] = [
    { kind: 'intro', fromFrame: f1, durationInFrames: introDur },
    { kind: 'stats', fromFrame: f2, durationInFrames: statsDur },
    { kind: 'score', fromFrame: f3, durationInFrames: scoreDur },
    { kind: 'trend', fromFrame: f34, durationInFrames: trendDur },
    {
      kind: 'chapter_beat',
      fromFrame: f4,
      durationInFrames: beatDur,
      sceneKey: ch4?.sceneKey ?? 'chapter_4',
      excerpt: ch4?.text?.slice(0, 420),
    },
    { kind: 'outro', fromFrame: f5, durationInFrames: outroDur },
    {
      kind: 'brand_padding',
      fromFrame: fEnd,
      durationInFrames: BRAND_TAIL_FRAMES,
    },
  ];

  const durationInFrames = fEnd + BRAND_TAIL_FRAMES;

  return { durationInFrames, segments };
}
