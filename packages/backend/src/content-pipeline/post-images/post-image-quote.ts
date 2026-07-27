// packages/backend/src/content-pipeline/post-images/post-image-quote.ts
//
// The `quote` skeleton in the `white` family: a pure-white editorial quote card.
// Signature element = a hand-drawn GREEN HIGHLIGHTER STROKE behind the emphasized
// phrase, rendered as an inline-SVG data-URI background (deterministic, no external
// asset, self-contained for the CSP-strict renderer). Oversized brand-green quote
// glyph top-left, centered Source-Serif display, generous whitespace, minimal
// footer. Green (#00C853) is the CLAUDE.md §8 accent. Single-market or no-market —
// the words come from the post copy, no invented numbers.

import { WHITE, escapeHtml, headlineFontSize, s } from './post-image-shared';
import { categoryPillHtml, footerHtml, markHtml } from './post-image-fragments';
import { PostImageContent, SingleVariantEntry } from './post-image.types';

/**
 * A single marker swipe — a slightly irregular, rounded green band. Stretched
 * behind the emphasized phrase via `background-size:100% ...`, so it fits any
 * phrase width without measurement. URL-encoded once at module load.
 */
const HIGHLIGHTER_BRUSH =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" preserveAspectRatio="none"><path d="M6,52 C60,34 120,40 180,38 C240,36 290,40 314,48 C318,60 314,70 306,72 C250,80 150,74 96,72 C56,70 20,70 10,64 C2,60 2,58 6,52 Z" fill="${WHITE.green}" fill-opacity="0.30"/></svg>`,
  );

/**
 * Wrap the first (case-insensitive) occurrence of `emphasis` inside `text` in a
 * highlighter span; the rest is plain. Non-match / empty emphasis returns the
 * escaped text unchanged (no stroke) — the quote still reads cleanly.
 */
function highlightPhraseHtml(text: string, emphasis?: string): string {
  const full = text ?? '';
  const needle = (emphasis ?? '').trim();
  if (!needle) return escapeHtml(full);
  const at = full.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return escapeHtml(full);
  const before = full.slice(0, at);
  const match = full.slice(at, at + needle.length);
  const after = full.slice(at + needle.length);
  const span = `<span style="background-image:url('${HIGHLIGHTER_BRUSH}');background-repeat:no-repeat;background-size:100% 72%;background-position:0 68%;padding:0 0.08em;">${escapeHtml(match)}</span>`;
  return `${escapeHtml(before)}${span}${escapeHtml(after)}`;
}

/** White: serif quote with a green highlighter stroke behind the emphasized phrase. */
function whiteQuote(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 80, 46);
  const quote = highlightPhraseHtml(c.headline, c.emphasis);
  return `<div class="stage" style="padding:88px 80px 64px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        ${markHtml('white')}
        ${c.category ? categoryPillHtml('white', c.category) : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;margin-bottom:${s(24)};">
        <div class="serif" style="align-self:flex-start;font-size:${s(200)};font-weight:700;line-height:0.6;color:${WHITE.green};margin:${s(8)} 0 ${s(-8)} ${s(4)};">&ldquo;</div>
        <div class="serif" style="font-size:${s(hSize)};font-weight:600;line-height:1.2;color:${WHITE.ink};text-align:center;max-width:${s(900)};">${quote}</div>
        ${c.attribution ? `<div style="margin-top:${s(44)};font-size:${s(28)};font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${WHITE.muted};">${escapeHtml(c.attribution)}</div>` : ''}
      </div>
      ${footerHtml('white', c.asOf)}
    </div>`;
}

/** Registry entry for the quote skeleton (spread into SINGLE_VARIANT_REGISTRY). */
export const QUOTE_VARIANTS: SingleVariantEntry[] = [
  {
    id: 'quote_highlight',
    family: 'white',
    skeleton: 'quote',
    build: whiteQuote,
  },
];
