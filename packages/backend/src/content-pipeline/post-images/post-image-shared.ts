// packages/backend/src/content-pipeline/post-images/post-image-shared.ts
//
// Design tokens + shared building blocks for the post-image templates. Two
// families, both pinned by the brief (never invented):
//  - `dark`  = the proven navy "Daily Card" already live on PropertyIQ socials.
//  - `cream` = the editorial infographic look (Source Serif display) Troy approved.
// Palette hexes are literal here because CSS needs literals; they mirror the
// Daily Card SVG source and CLAUDE.md §8. Accent-green (dark) / teal (cream) are
// reserved for genuinely positive metrics.

import { fontFaceCss } from './post-image-assets';
import {
  POST_IMAGE_DIMENSIONS,
  PostImageFamily,
  PostImageStat,
  PostImageTemplate,
} from './post-image.types';

/** Disclaimer every card carries (frozen wording — legal/positioning). */
export const DISCLAIMER = 'Market-level intelligence. Not property valuation.';
export const SITE = 'propertyiq.app';

export const DARK = {
  bgTop: '#212B86',
  bgBottom: '#191F6E',
  barFrom: '#3650A6',
  barTo: '#03C158',
  green: '#03C158',
  lavender: '#9AA0D4',
  rowFill: '#28328F',
  rowStroke: '#3C48A8',
  coral: '#FF6152',
  amber: '#FFB020',
  white: '#FFFFFF',
  inkOnChip: '#191F6E',
} as const;

export const CREAM = {
  surface: '#F5F0E4',
  panel: '#FFFDF7',
  ink: '#23252B',
  slateSoft: '#4A4E58',
  terracotta: '#C65B3C',
  gold: '#C99A2E',
  teal: '#2C7A6B',
  muted: '#8A8578',
  hairline: '#E0D8C4',
} as const;

/**
 * The quote-highlight look: pure white, near-black ink, brand accent green. The
 * signature is a translucent green marker stroke behind the emphasized phrase —
 * `greenWash` is that stroke fill. Green (#00C853) is the CLAUDE.md §8 accent.
 */
export const WHITE = {
  surface: '#FFFFFF',
  ink: '#1A1A2E',
  muted: '#6B7280',
  green: '#00C853',
  greenInk: '#0A7A38',
  greenWash: 'rgba(0, 200, 83, 0.30)',
  hairline: '#ECECEC',
} as const;

/** px value that scales with the renderer's --s fit variable (text that must shrink). */
export function s(px: number): string {
  return `calc(${px}px * var(--s))`;
}

/** Accent color for a stat tone, per family. Green/teal = positive only. */
export function toneColor(
  family: PostImageFamily,
  tone: PostImageStat['tone'],
): string {
  if (family === 'dark' || family === 'photo') {
    return tone === 'pos'
      ? DARK.green
      : tone === 'neg'
        ? DARK.coral
        : tone === 'warn'
          ? DARK.amber
          : DARK.white;
  }
  return tone === 'pos'
    ? CREAM.teal
    : tone === 'neg'
      ? CREAM.terracotta
      : tone === 'warn'
        ? CREAM.gold
        : CREAM.ink;
}

/** Momentum tone from a 1-99 score (never a quality grade). */
export function scoreTone(
  score: number | null | undefined,
): PostImageStat['tone'] {
  if (score == null || !Number.isFinite(score)) return 'neutral';
  if (score >= 60) return 'pos';
  if (score >= 50) return 'neutral';
  if (score >= 40) return 'warn';
  return 'neg';
}

/** Tone from a signed delta (up = positive momentum). */
export function deltaTone(
  delta: number | null | undefined,
): PostImageStat['tone'] {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return 'neutral';
  return delta > 0 ? 'pos' : 'neg';
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Word-safe truncation: cut on a word boundary and add an ellipsis, never mid-word. */
export function truncateWords(
  text: string | undefined,
  maxChars: number,
): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,.;:]+$/, '')}…`;
}

/**
 * Pass copy through UNTOUCHED up to a generous card-fit budget; truncate + warn
 * only as an absolute backstop (degenerate / far-over-DTO input). Font step-down
 * (headlineFontSize) and the renderer's scale ladder do the real fitting — so
 * legal feed copy is NEVER cut off. Budgets are set so the field fits at the
 * renderer's floor scale, per the "regions must fit legal copy" invariant.
 */
export function fitField(
  text: string | undefined,
  budget: number,
  label: string,
): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (t.length <= budget) return t;

  console.warn(
    `[post-image] backstop-truncated ${label}: ${t.length} > ${budget} chars`,
  );
  return truncateWords(t, budget);
}

/**
 * A card's supporting line drawn from a long body/caption: complete LEADING
 * SENTENCES up to a soft length, ending on a real sentence boundary — never a
 * mid-word ellipsis. The full body still lives in the published caption; the
 * card shows a clean, whole-sentence excerpt (so nothing reads as "cut off").
 *
 * The excerpt is ALWAYS a PREFIX of the body, because it is a slice taken at a
 * boundary index. It must never be assembled by joining the results of a global
 * `match`, which silently DROPS whatever the pattern skipped: a body opening
 * "dropped 22.6% year over year" yielded "6% year over year", because no
 * sentence could start at index 0 (that "." is followed by a digit, not a
 * space) so the engine resumed mid-number — and the card stated a figure its
 * own caption never made.
 */
export function leadingSentences(
  text: string | undefined,
  softMax: number,
): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (t.length <= softMax) return t;

  // A boundary is a terminator (plus any closing quote/bracket) followed by a
  // SPACE. A "." inside a decimal ("22.6") or an abbreviation is not one — a
  // digit or letter follows it. Keep the last boundary within the budget.
  const boundary = /[.!?]+["'”’)\]]?(?=\s)/g;
  let end = 0;
  for (let m = boundary.exec(t); m !== null; m = boundary.exec(t)) {
    const stop = m.index + m[0].length;
    if (stop > softMax) break;
    end = stop;
  }
  if (end > 0) return t.slice(0, end); // whole leading sentences, prefix-safe

  // The first sentence alone blows the budget (incl. a punctuation-less body):
  // word-safe backstop + warn — still a prefix, and visibly elided.
  return fitField(t, softMax, 'subhead (no sentence boundary)');
}

/**
 * Auto font-step-down: pick a headline size from character count so long hooks
 * shrink instead of overflowing. `base` is the size for a short hook; it steps
 * down toward `min` as length grows. Defensive first line; the renderer's
 * overflow re-render is the second.
 */
export function headlineFontSize(
  text: string,
  base: number,
  min: number,
): number {
  const len = (text ?? '').length;
  const over = Math.max(0, len - 24);
  const size = base - over * ((base - min) / 90);
  return Math.round(Math.max(min, Math.min(base, size)));
}

/**
 * Per-region CHAR BUDGETS = how much copy each region holds at the renderer's
 * FLOOR scale (0.6). These are no-ops for legal feed copy (bounded by PostCopyDto)
 * — font step-down + the scale ladder do the real fitting; fitField only truncates
 * (+warns) genuinely pathological input. Where the DTO max exceeds what a 4:5 card
 * can hold (body 2200, slide body 1000), the budget is set to the measured floor
 * capacity and the overflow lives in the published caption, not the image. Single
 * SSOT so both the carousel path and the single-post path budget identically.
 */
export const FIT = {
  hook: 300, // = PostCopyDto.hook max
  cta: 500, // = PostCopyDto.cta max
  slideHeading: 200, // = PostCopyDto slide heading max
  slideBody: 600, // content-slide floor capacity (< DTO 1000)
  subhead: 260, // single-post supporting line (leading sentences of a long body)
} as const;

// Real-data value formatters live in post-image-format.ts; re-exported so the
// templates keep importing them from post-image-shared.
export {
  formatScore,
  formatCurrencyCompact,
  formatPercent,
  formatDelta,
} from './post-image-format';

// ---- shared HTML fragments --------------------------------------------------

/** The <html> shell with embedded fonts, reset, fixed canvas, and a --s scale hook.
 *  `transparentBody` makes the page background transparent (for capturing the
 *  gradient+text as a video overlay to composite over b-roll — no card bg). */
export function shell(
  family: PostImageFamily,
  template: PostImageTemplate,
  scale: number,
  inner: string,
  opts?: { transparentBody?: boolean },
): string {
  const { width, height } = POST_IMAGE_DIMENSIONS[template];
  const bg = opts?.transparentBody
    ? 'transparent'
    : family === 'dark'
      ? `linear-gradient(180deg, ${DARK.bgTop} 0%, ${DARK.bgBottom} 100%)`
      : family === 'photo'
        ? DARK.bgBottom // dark fallback behind the full-bleed skyline
        : family === 'white'
          ? WHITE.surface
          : CREAM.surface;
  const color =
    family === 'dark' || family === 'photo'
      ? DARK.white
      : family === 'white'
        ? WHITE.ink
        : CREAM.ink;
  const bodyFont = `'Roboto', 'Helvetica Neue', Arial, sans-serif`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    ${fontFaceCss()}
    *{margin:0;padding:0;box-sizing:border-box;}
    :root{--s:${scale};}
    html,body{width:${width}px;height:${height}px;}
    body{font-family:${bodyFont};background:${bg};color:${color};overflow:hidden;position:relative;}
    .mono{font-family:'Roboto Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;}
    .serif{font-family:'Source Serif 4',Georgia,serif;}
    .stage{position:absolute;inset:0;display:flex;flex-direction:column;}
  </style></head><body>${inner}</body></html>`;
}

// Brand HTML fragments (mark, category pill, footer, scale bar, momentum chip)
// live in post-image-fragments.ts to keep this tokens/text module under the
// 300-line logic-file limit.
