// packages/backend/src/content-pipeline/post-images/post-image-shared.ts
//
// Design tokens + shared building blocks for the post-image templates. Two
// families, both pinned by the brief (never invented):
//  - `dark`  = the proven navy "Daily Card" already live on PropertyIQ socials.
//  - `cream` = the editorial infographic look (Source Serif display) Troy approved.
// Palette hexes are literal here because CSS needs literals; they mirror the
// Daily Card SVG source and CLAUDE.md §8. Accent-green (dark) / teal (cream) are
// reserved for genuinely positive metrics.

import {
  fontFaceCss,
  logoNormalDataUri,
  logoReversedDataUri,
} from './post-image-assets';
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

/** Accent color for a stat tone, per family. Green/teal = positive only. */
export function toneColor(
  family: PostImageFamily,
  tone: PostImageStat['tone'],
): string {
  if (family === 'dark') {
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

// ---- real-data formatters (only emit for finite numbers) --------------------

export function formatScore(n: number | null | undefined): string | null {
  return n != null && Number.isFinite(n) ? String(Math.round(n)) : null;
}

export function formatCurrencyCompact(
  n: number | null | undefined,
): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

export function formatPercent(
  n: number | null | undefined,
  signed = true,
): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function formatDelta(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  const sign = n > 0 ? '+' : '−'; // real minus sign
  return `${sign}${Math.abs(Math.round(n))}`;
}

// ---- shared HTML fragments --------------------------------------------------

/** The <html> shell with embedded fonts, reset, fixed canvas, and a --s scale hook. */
export function shell(
  family: PostImageFamily,
  template: PostImageTemplate,
  scale: number,
  inner: string,
): string {
  const { width, height } = POST_IMAGE_DIMENSIONS[template];
  const bg =
    family === 'dark'
      ? `linear-gradient(180deg, ${DARK.bgTop} 0%, ${DARK.bgBottom} 100%)`
      : CREAM.surface;
  const color = family === 'dark' ? DARK.white : CREAM.ink;
  const bodyFont =
    family === 'dark'
      ? `'Roboto', 'Helvetica Neue', Arial, sans-serif`
      : `'Roboto', 'Helvetica Neue', Arial, sans-serif`;
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

/** Brand mark: logomark + wordmark, colored for the family. */
export function markHtml(family: PostImageFamily): string {
  const logo = family === 'dark' ? logoReversedDataUri() : logoNormalDataUri();
  const color = family === 'dark' ? DARK.white : CREAM.ink;
  const chip = family === 'dark' ? DARK.white : CREAM.panel;
  return `<div style="display:flex;align-items:center;gap:20px;">
    <div style="width:76px;height:76px;border-radius:18px;background:${chip};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
      <img src="${logo}" width="52" height="52" alt="PropertyIQ"/>
    </div>
    <div style="font-size:38px;font-weight:800;letter-spacing:0.5px;color:${color};">PropertyIQ</div>
  </div>`;
}

/** Outlined category pill (top-right of single posts). */
export function categoryPillHtml(
  family: PostImageFamily,
  text: string,
): string {
  const stroke = family === 'dark' ? DARK.rowStroke : CREAM.hairline;
  const color = family === 'dark' ? DARK.lavender : CREAM.muted;
  return `<div style="border:2px solid ${stroke};color:${color};border-radius:999px;padding:12px 28px;font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;">${escapeHtml(text)}</div>`;
}

/** Footer: site + as-of + the standing disclaimer. */
export function footerHtml(
  family: PostImageFamily,
  asOf?: string | null,
): string {
  const rule = family === 'dark' ? DARK.rowStroke : CREAM.hairline;
  const site = family === 'dark' ? DARK.white : CREAM.ink;
  const muted = family === 'dark' ? DARK.lavender : CREAM.muted;
  return `<div style="margin-top:auto;">
    <div style="height:2px;background:${rule};margin-bottom:22px;"></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:30px;font-weight:700;color:${site};">${SITE}</div>
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
  const endLabel = family === 'dark' ? DARK.lavender : CREAM.muted;
  const marker = family === 'dark' ? DARK.white : CREAM.ink;
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
