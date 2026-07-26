// packages/backend/src/content-pipeline/post-images/post-image-fragments.ts
//
// Brand HTML fragments shared across the template families: the logo mark, the
// category pill, the footer (site + as-of + standing disclaimer), the 1-99 score
// scale bar, and the momentum chip. Each is family-aware across dark / cream /
// white. Split out of post-image-shared.ts to keep that module under the
// 300-line logic-file limit.

import {
  CREAM,
  DARK,
  DISCLAIMER,
  SITE,
  WHITE,
  escapeHtml,
  s,
  toneColor,
} from './post-image-shared';
import { logoNormalDataUri, logoReversedDataUri } from './post-image-assets';
import {
  PostImageContent,
  PostImageFamily,
  PostImageStat,
} from './post-image.types';

/** The dark family's top gradient accent bar (empty for light families). */
export function accentBarHtml(family: PostImageFamily): string {
  if (family !== 'dark') return '';
  return `<div style="position:absolute;top:0;left:0;right:0;height:10px;background:linear-gradient(90deg,${DARK.barFrom} 0%,${DARK.barTo} 100%);"></div>`;
}

/** Top row of a single-post card: brand mark on the left, category pill on the right. */
export function headerRowHtml(c: PostImageContent): string {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;">
    ${markHtml(c.family)}
    ${c.category ? categoryPillHtml(c.family, c.category) : ''}
  </div>`;
}

/** Primary ink color for a family. */
function inkOf(family: PostImageFamily): string {
  return family === 'dark'
    ? DARK.white
    : family === 'white'
      ? WHITE.ink
      : CREAM.ink;
}
/** Muted/secondary text color for a family. */
function mutedOf(family: PostImageFamily): string {
  return family === 'dark'
    ? DARK.lavender
    : family === 'white'
      ? WHITE.muted
      : CREAM.muted;
}
/** Hairline / divider color for a family. */
function ruleOf(family: PostImageFamily): string {
  return family === 'dark'
    ? DARK.rowStroke
    : family === 'white'
      ? WHITE.hairline
      : CREAM.hairline;
}

/** Brand mark: logomark chip + wordmark, colored for the family. */
export function markHtml(family: PostImageFamily): string {
  const logo = family === 'dark' ? logoReversedDataUri() : logoNormalDataUri();
  const chipBg =
    family === 'dark'
      ? DARK.white
      : family === 'white'
        ? WHITE.surface
        : CREAM.panel;
  const chipBorder =
    family === 'white' ? `border:1px solid ${WHITE.hairline};` : '';
  return `<div style="display:flex;align-items:center;gap:20px;">
    <div style="width:76px;height:76px;border-radius:18px;background:${chipBg};${chipBorder}display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
      <img src="${logo}" width="52" height="52" alt="PropertyIQ"/>
    </div>
    <div style="font-size:38px;font-weight:800;letter-spacing:0.5px;color:${inkOf(family)};">PropertyIQ</div>
  </div>`;
}

/** Outlined category pill (top-right of single posts). */
export function categoryPillHtml(
  family: PostImageFamily,
  text: string,
): string {
  return `<div style="border:2px solid ${ruleOf(family)};color:${mutedOf(family)};border-radius:999px;padding:12px 28px;font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;">${escapeHtml(text)}</div>`;
}

/** Footer: site + as-of + the standing disclaimer. */
export function footerHtml(
  family: PostImageFamily,
  asOf?: string | null,
): string {
  const muted = mutedOf(family);
  return `<div style="margin-top:auto;">
    <div style="height:2px;background:${ruleOf(family)};margin-bottom:22px;"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:30px;font-weight:700;color:${inkOf(family)};">${SITE}</div>
      <div style="text-align:right;">
        ${asOf ? `<div style="font-size:22px;color:${muted};">As of ${escapeHtml(asOf)}</div>` : ''}
        <div style="font-size:18px;color:${muted};margin-top:4px;">${DISCLAIMER}</div>
      </div>
    </div>
  </div>`;
}

/** 1-99 score scale bar with a marker at the score position (the score signature). */
export function scaleBarHtml(family: PostImageFamily, score: number): string {
  const pct = Math.max(2, Math.min(98, score));
  const endLabel = mutedOf(family);
  const marker = inkOf(family);
  const track =
    'linear-gradient(90deg,#B3261E 0%,#FF8F00 27%,#F3EFE3 50%,#5C6BC0 74%,#00C853 100%)';
  return `<div style="display:flex;align-items:center;gap:18px;">
    <span style="font-size:24px;font-weight:700;color:${endLabel};">1</span>
    <div style="position:relative;flex:1;height:14px;border-radius:999px;background:${track};">
      <div style="position:absolute;left:${pct}%;top:-7px;width:4px;height:28px;background:${marker};border-radius:2px;transform:translateX(-50%);box-shadow:0 0 0 3px rgba(0,0,0,0.15);"></div>
    </div>
    <span style="font-size:24px;font-weight:700;color:${endLabel};">99</span>
  </div>`;
}

/**
 * Momentum chip: the market's MOMENTUM word (rising/steady/weak) in its tone
 * color — never an A/B/C/F letter grade, which is a confidence signal and reads
 * as a quality verdict (CLAUDE.md §9). Scales with --s. Used by row + versus cards.
 */
export function momentumChipHtml(
  family: PostImageFamily,
  momentum: string,
  tone: PostImageStat['tone'],
): string {
  const c = toneColor(family, tone);
  return `<span style="display:inline-block;padding:${s(6)} ${s(16)};border-radius:999px;font-size:${s(21)};font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${c};border:2px solid ${c};white-space:nowrap;">${escapeHtml(momentum)}</span>`;
}
