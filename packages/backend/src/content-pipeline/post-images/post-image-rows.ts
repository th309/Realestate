// packages/backend/src/content-pipeline/post-images/post-image-rows.ts
//
// The `rows` skeleton: a market-row list where each row is a market name + its
// PropertyIQ score, colored by MOMENTUM tone (never an A/F letter grade — that is
// a confidence signal that reads as a quality verdict, CLAUDE.md §9). Two skins:
//   dark  → daily_card_rows   (Troy's "What's your market's score?" engagement card)
//   cream → editorial_ranking (numbered ranking list, Source-Serif headline)
// Real data only: rows come from grounding.markets (top movers) passed down by the
// feed. Names wrap instead of truncating; the renderer's scale ladder does the
// fitting. Row count is capped so the list can never crowd the footer.

import {
  CREAM,
  DARK,
  escapeHtml,
  headlineFontSize,
  s,
  toneColor,
  truncateWords,
} from './post-image-shared';
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

/** Max rows a card shows — keeps the list from crowding the footer at floor scale. */
const MAX_ROWS = 5;
/** Backstop cap for a market row name after shortMarketName (rarely triggers). */
const ROW_NAME_MAX = 32;

/** One market row: name (wraps, never truncates) + momentum chip + score. */
function marketRowHtml(
  family: PostImageFamily,
  row: PostImageRow,
  rank?: number,
): string {
  const dark = family === 'dark';
  const rowBg = dark ? DARK.rowFill : CREAM.panel;
  const rowBorder = dark ? DARK.rowStroke : CREAM.hairline;
  const nameColor = dark ? DARK.white : CREAM.ink;
  const rankColor = dark ? DARK.lavender : CREAM.muted;
  const scoreColor = toneColor(family, row.tone);
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:${s(20)};padding:${s(24)} ${s(32)};background:${rowBg};border:2px solid ${rowBorder};border-radius:20px;">
    <div style="display:flex;align-items:center;gap:${s(22)};min-width:0;flex:1;">
      ${rank != null ? `<span class="mono" style="font-size:${s(34)};font-weight:700;color:${rankColor};flex-shrink:0;">${rank}</span>` : ''}
      <span style="font-size:${s(38)};font-weight:800;line-height:1.1;color:${nameColor};word-break:break-word;">${escapeHtml(truncateWords(row.name, ROW_NAME_MAX))}</span>
    </div>
    <div style="display:flex;align-items:center;gap:${s(20)};flex-shrink:0;">
      ${row.momentum ? momentumChipHtml(family, row.momentum, row.tone) : ''}
      <span class="mono" style="font-size:${s(50)};font-weight:700;line-height:1;color:${scoreColor};">${escapeHtml(row.score ?? '—')}</span>
    </div>
  </div>`;
}

/** Dark: engagement / market-row list (question headline + rows + comment CTA). */
function darkRows(c: PostImageContent): string {
  const rows = (c.rows ?? []).slice(0, MAX_ROWS);
  const hSize = headlineFontSize(c.headline, 76, 50);
  return `${accentBarHtml('dark')}
    <div class="stage" style="padding:78px 64px 60px;">
      ${headerRowHtml(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${s(36)};margin-bottom:${s(24)};">
        <div>
          ${c.eyebrow ? `<div style="font-size:${s(26)};font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${DARK.lavender};margin-bottom:${s(18)};">${escapeHtml(c.eyebrow)}</div>` : ''}
          <div style="font-size:${s(hSize)};font-weight:800;line-height:1.06;color:${DARK.white};">${escapeHtml(c.headline)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:${s(18)};">
          ${rows.map((r) => marketRowHtml('dark', r)).join('')}
        </div>
        ${c.cta ? `<div style="font-size:${s(34)};font-weight:800;color:${DARK.green};text-align:center;">${escapeHtml(c.cta)}</div>` : ''}
      </div>
      ${footerHtml('dark', c.asOf)}
    </div>`;
}

/** Cream: numbered ranking list (editorial Source-Serif headline). */
function creamRanking(c: PostImageContent): string {
  const rows = (c.rows ?? []).slice(0, MAX_ROWS);
  const hSize = headlineFontSize(c.headline, 60, 42);
  return `<div class="stage" style="padding:72px 68px 60px;">
      ${headerRowHtml(c)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${s(32)};margin-bottom:${s(24)};">
        <div>
          ${c.eyebrow ? `<div style="font-size:${s(24)};font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${CREAM.terracotta};margin-bottom:${s(16)};">${escapeHtml(c.eyebrow)}</div>` : ''}
          <div class="serif" style="font-size:${s(hSize)};font-weight:700;line-height:1.1;color:${CREAM.ink};">${escapeHtml(c.headline)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:${s(14)};">
          ${rows.map((r, i) => marketRowHtml('cream', r, i + 1)).join('')}
        </div>
        ${c.subhead ? `<div style="font-size:${s(30)};line-height:1.4;color:${CREAM.slateSoft};">${escapeHtml(c.subhead)}</div>` : ''}
      </div>
      ${footerHtml('cream', c.asOf)}
    </div>`;
}

/** Registry entries for the rows skeleton (spread into SINGLE_VARIANT_REGISTRY). */
export const ROWS_VARIANTS: SingleVariantEntry[] = [
  { id: 'daily_card_rows', family: 'dark', skeleton: 'rows', build: darkRows },
  {
    id: 'editorial_ranking',
    family: 'cream',
    skeleton: 'rows',
    build: creamRanking,
  },
];
