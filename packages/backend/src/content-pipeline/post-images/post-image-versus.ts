// packages/backend/src/content-pipeline/post-images/post-image-versus.ts
//
// The `versus` skeleton: a head-to-head of two markets, big score per panel,
// colored by MOMENTUM tone with a momentum chip (never an A/F letter grade — that
// conflates a confidence signal with a quality verdict, CLAUDE.md §9; this is the
// fix over Troy's source "Two Texas Metros" card, which badged 94→A / 2→F). Skins:
//   dark  → daily_card_versus  (navy Daily Card contrast)
//   cream → editorial_versus   (Source-Serif editorial contrast)
// Uses the first two grounding.markets. Names wrap; the scale ladder does the fit.

import {
  CREAM,
  DARK,
  escapeHtml,
  headlineFontSize,
  s,
  toneColor,
  truncateWords,
} from './post-image-shared';

/** Backstop cap for a versus panel market name after shortMarketName. */
const PANEL_NAME_MAX = 34;
import {
  accentBarHtml,
  footerHtml,
  headerRowHtml,
  momentumChipHtml,
} from './post-image-fragments';
import {
  PostImageContent,
  PostImageFamily,
  PostImageRow,
  SingleVariantEntry,
} from './post-image.types';

/** One head-to-head panel: market name, big score, momentum chip, "out of 99". */
function versusPanelHtml(family: PostImageFamily, row: PostImageRow): string {
  const dark = family === 'dark';
  const panelBg = dark ? DARK.rowFill : CREAM.panel;
  const panelBorder = dark ? DARK.rowStroke : CREAM.hairline;
  const nameColor = dark ? DARK.white : CREAM.ink;
  const mutedColor = dark ? DARK.lavender : CREAM.muted;
  return `<div style="flex:1;min-width:0;padding:${s(40)} ${s(26)};background:${panelBg};border:2px solid ${panelBorder};border-radius:28px;display:flex;flex-direction:column;align-items:center;gap:${s(18)};text-align:center;">
    <div style="font-size:${s(40)};font-weight:800;line-height:1.1;color:${nameColor};word-break:break-word;">${escapeHtml(truncateWords(row.name, PANEL_NAME_MAX))}</div>
    <div class="mono" style="font-size:${s(150)};font-weight:700;line-height:0.9;color:${toneColor(family, row.tone)};">${escapeHtml(row.score ?? '—')}</div>
    ${row.momentum ? momentumChipHtml(family, row.momentum, row.tone) : ''}
    <div style="font-size:${s(24)};color:${mutedColor};">out of 99</div>
  </div>`;
}

/** The two-panel body shared by both skins (VS connector between the panels). */
function versusBody(
  family: PostImageFamily,
  rows: PostImageRow[],
  vsColor: string,
): string {
  const [a, b] = rows;
  return `<div style="display:flex;align-items:center;gap:${s(18)};">
    ${a ? versusPanelHtml(family, a) : ''}
    <div class="mono" style="font-size:${s(56)};font-weight:800;color:${vsColor};flex-shrink:0;">VS</div>
    ${b ? versusPanelHtml(family, b) : ''}
  </div>`;
}

/** Dark: navy Daily Card head-to-head. */
function darkVersus(c: PostImageContent): string {
  const rows = (c.rows ?? []).slice(0, 2);
  const hSize = headlineFontSize(c.headline, 78, 52);
  return `${accentBarHtml('dark')}
    <div class="stage" style="padding:78px 64px 60px;">
      ${headerRowHtml(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${s(40)};margin-bottom:${s(24)};">
        <div>
          ${c.eyebrow ? `<div style="font-size:${s(26)};font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${DARK.lavender};margin-bottom:${s(18)};">${escapeHtml(c.eyebrow)}</div>` : ''}
          <div style="font-size:${s(hSize)};font-weight:800;line-height:1.06;color:${DARK.white};">${escapeHtml(c.headline)}</div>
        </div>
        ${versusBody('dark', rows, DARK.amber)}
        ${c.subhead ? `<div style="font-size:${s(32)};line-height:1.35;color:${DARK.lavender};text-align:center;">${escapeHtml(c.subhead)}</div>` : ''}
      </div>
      ${footerHtml('dark', c.asOf)}
    </div>`;
}

/** Cream: editorial head-to-head. */
function creamVersus(c: PostImageContent): string {
  const rows = (c.rows ?? []).slice(0, 2);
  const hSize = headlineFontSize(c.headline, 62, 44);
  return `<div class="stage" style="padding:72px 68px 60px;">
      ${headerRowHtml(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${s(36)};margin-bottom:${s(24)};">
        <div>
          ${c.eyebrow ? `<div style="font-size:${s(24)};font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${CREAM.terracotta};margin-bottom:${s(16)};">${escapeHtml(c.eyebrow)}</div>` : ''}
          <div class="serif" style="font-size:${s(hSize)};font-weight:700;line-height:1.1;color:${CREAM.ink};">${escapeHtml(c.headline)}</div>
        </div>
        ${versusBody('cream', rows, CREAM.gold)}
        ${c.subhead ? `<div style="font-size:${s(30)};line-height:1.4;color:${CREAM.slateSoft};text-align:center;">${escapeHtml(c.subhead)}</div>` : ''}
      </div>
      ${footerHtml('cream', c.asOf)}
    </div>`;
}

/** Registry entries for the versus skeleton (spread into SINGLE_VARIANT_REGISTRY). */
export const VERSUS_VARIANTS: SingleVariantEntry[] = [
  {
    id: 'daily_card_versus',
    family: 'dark',
    skeleton: 'versus',
    build: darkVersus,
  },
  {
    id: 'editorial_versus',
    family: 'cream',
    skeleton: 'versus',
    build: creamVersus,
  },
];
