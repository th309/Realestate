// packages/backend/src/content-pipeline/post-images/post-image-single.ts
//
// The four single-post layouts. Two families, both brief-pinned:
//   dark  → daily_card_stat / daily_card_hook  (the proven navy Daily Card)
//   cream → editorial_stat / editorial_claim   (Source-Serif editorial infographic)
// Each returns the .stage inner HTML; buildSinglePostHtml wraps it in the shell.
// Font sizes use calc(px * var(--s)) so the renderer can step the whole card
// down on overflow without touching structure.

import {
  CREAM,
  DARK,
  categoryPillHtml,
  escapeHtml,
  footerHtml,
  headlineFontSize,
  markHtml,
  scaleBarHtml,
  toneColor,
} from './post-image-shared';
import {
  PostImageContent,
  PostImageFamily,
  SinglePostVariant,
} from './post-image.types';

/** px value that scales with --s (for text that must shrink to fit). */
function s(px: number): string {
  return `calc(${px}px * var(--s))`;
}

function darkAccentBar(): string {
  return `<div style="position:absolute;top:0;left:0;right:0;height:10px;background:linear-gradient(90deg,${DARK.barFrom} 0%,${DARK.barTo} 100%);"></div>`;
}

function headerRow(c: PostImageContent): string {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;">
    ${markHtml(c.family)}
    ${c.category ? categoryPillHtml(c.family, c.category) : ''}
  </div>`;
}

/** Dark: score/stat-forward Daily Card. */
function darkStat(c: PostImageContent): string {
  const stat = c.stat;
  const valueColor = stat ? toneColor('dark', stat.tone) : DARK.white;
  const hSize = headlineFontSize(c.headline, 64, 44);
  return `${darkAccentBar()}
    <div class="stage" style="padding:78px 64px 60px;">
      ${headerRow(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        ${c.eyebrow ? `<div style="font-size:26px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${DARK.lavender};">${escapeHtml(c.eyebrow)}</div>` : ''}
        <div style="margin-top:16px;font-size:${s(hSize)};font-weight:800;line-height:1.08;">${escapeHtml(c.headline)}</div>
        ${
          stat
            ? `<div style="display:flex;align-items:center;gap:32px;margin-top:52px;">
                <div class="mono" style="font-size:${s(200)};font-weight:700;line-height:0.9;color:${valueColor};">${escapeHtml(stat.value)}</div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                  ${stat.context ? `<div style="font-size:38px;font-weight:700;color:${DARK.white};">${escapeHtml(stat.context)}</div>` : ''}
                  <div style="font-size:26px;color:${DARK.lavender};">${escapeHtml(stat.label)}</div>
                </div>
              </div>`
            : ''
        }
        ${c.scaleScore != null ? `<div style="margin-top:44px;">${scaleBarHtml('dark', c.scaleScore)}</div>` : ''}
        ${c.subhead ? `<div style="margin-top:40px;font-size:34px;line-height:1.35;color:${DARK.lavender};">${escapeHtml(c.subhead)}</div>` : ''}
        ${c.cta ? `<div style="margin-top:40px;font-size:34px;font-weight:700;color:${DARK.green};">${escapeHtml(c.cta)}</div>` : ''}
      </div>
      ${footerHtml('dark', c.asOf)}
    </div>`;
}

/** Dark: typographic bold-claim (hook-led, no stat). */
function darkHook(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 92, 56);
  return `${darkAccentBar()}
    <div class="stage" style="padding:78px 64px 60px;">
      ${headerRow(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        ${c.eyebrow ? `<div style="font-size:26px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${DARK.lavender};margin-bottom:24px;">${escapeHtml(c.eyebrow)}</div>` : ''}
        <div style="font-size:${s(hSize)};font-weight:800;line-height:1.06;">${escapeHtml(c.headline)}</div>
        ${c.subhead ? `<div style="margin-top:36px;font-size:38px;line-height:1.35;color:${DARK.lavender};">${escapeHtml(c.subhead)}</div>` : ''}
        ${c.cta ? `<div style="margin-top:40px;font-size:34px;font-weight:700;color:${DARK.green};">${escapeHtml(c.cta)}</div>` : ''}
      </div>
      ${footerHtml('dark', c.asOf)}
    </div>`;
}

/** Cream: editorial infographic with a big mono stat. */
function creamStat(c: PostImageContent): string {
  const stat = c.stat;
  const valueColor = stat ? toneColor('cream', stat.tone) : CREAM.ink;
  const hSize = headlineFontSize(c.headline, 62, 42);
  return `<div class="stage" style="padding:72px 68px 60px;">
      ${headerRow(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        ${c.eyebrow ? `<div style="font-size:24px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${CREAM.terracotta};">${escapeHtml(c.eyebrow)}</div>` : ''}
        <div class="serif" style="margin-top:14px;font-size:${s(hSize)};font-weight:700;line-height:1.12;color:${CREAM.ink};">${escapeHtml(c.headline)}</div>
        ${
          stat
            ? `<div style="margin-top:48px;padding:36px 40px;background:${CREAM.panel};border:1px solid ${CREAM.hairline};border-radius:24px;display:flex;align-items:center;gap:32px;box-shadow:0 2px 10px rgba(35,37,43,0.06);">
                <div class="mono" style="font-size:${s(150)};font-weight:700;line-height:0.9;color:${valueColor};">${escapeHtml(stat.value)}</div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div style="font-size:32px;font-weight:700;color:${CREAM.ink};">${escapeHtml(stat.label)}</div>
                  ${stat.context ? `<div style="font-size:26px;color:${CREAM.muted};">${escapeHtml(stat.context)}</div>` : ''}
                </div>
              </div>`
            : ''
        }
        ${c.scaleScore != null ? `<div style="margin-top:40px;">${scaleBarHtml('cream', c.scaleScore)}</div>` : ''}
        ${c.subhead ? `<div style="margin-top:36px;font-size:32px;line-height:1.4;color:${CREAM.slateSoft};">${escapeHtml(c.subhead)}</div>` : ''}
        ${c.cta ? `<div style="margin-top:36px;font-size:32px;font-weight:700;color:${CREAM.teal};">${escapeHtml(c.cta)}</div>` : ''}
      </div>
      ${footerHtml('cream', c.asOf)}
    </div>`;
}

/** Cream: editorial claim (Source-Serif headline, no stat). */
function creamClaim(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 84, 50);
  return `<div class="stage" style="padding:72px 68px 60px;">
      ${headerRow(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        ${c.eyebrow ? `<div style="font-size:24px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${CREAM.terracotta};margin-bottom:24px;">${escapeHtml(c.eyebrow)}</div>` : ''}
        <div class="serif" style="font-size:${s(hSize)};font-weight:700;line-height:1.1;color:${CREAM.ink};">${escapeHtml(c.headline)}</div>
        ${c.subhead ? `<div style="margin-top:34px;font-size:36px;line-height:1.4;color:${CREAM.slateSoft};">${escapeHtml(c.subhead)}</div>` : ''}
        ${c.cta ? `<div style="margin-top:38px;font-size:32px;font-weight:700;color:${CREAM.teal};">${escapeHtml(c.cta)}</div>` : ''}
      </div>
      ${footerHtml('cream', c.asOf)}
    </div>`;
}

/**
 * One single-post layout. `skeleton` (stat/hook/claim) x `family` (dark/cream) is
 * the matrix the selector reasons over; adding a look is appending an entry here
 * plus its build fn — no dispatcher surgery.
 */
export interface SingleVariantEntry {
  id: SinglePostVariant;
  family: PostImageFamily;
  skeleton: 'stat' | 'hook' | 'claim';
  build: (c: PostImageContent) => string;
}

/** The single-post variant registry (the seam for the dozen-looks expansion). */
export const SINGLE_VARIANT_REGISTRY: SingleVariantEntry[] = [
  { id: 'daily_card_stat', family: 'dark', skeleton: 'stat', build: darkStat },
  { id: 'daily_card_hook', family: 'dark', skeleton: 'hook', build: darkHook },
  { id: 'editorial_stat', family: 'cream', skeleton: 'stat', build: creamStat },
  {
    id: 'editorial_claim',
    family: 'cream',
    skeleton: 'claim',
    build: creamClaim,
  },
];

const SINGLE_VARIANT_BY_ID = new Map(
  SINGLE_VARIANT_REGISTRY.map((entry) => [entry.id, entry]),
);

/** Dispatch a single-post content to its variant layout (returns .stage inner). */
export function buildSingleInner(c: PostImageContent): string {
  const entry = SINGLE_VARIANT_BY_ID.get(c.variant as SinglePostVariant);
  if (entry) return entry.build(c);
  return c.family === 'dark' ? darkHook(c) : creamClaim(c);
}
