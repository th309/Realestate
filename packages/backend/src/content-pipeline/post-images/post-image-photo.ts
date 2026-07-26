// packages/backend/src/content-pipeline/post-images/post-image-photo.ts
//
// The `photo` family: a market skyline photo (embedded as a data URI so Puppeteer
// stays offline) behind a dark gradient, with the card design language on top.
// The gradient is bottom-weighted (heaviest where headline/score/footer sit) with
// a lighter top scrim so the brand mark stays legible — text is ALWAYS on a
// darkened zone (contrast non-negotiable, esp. the disclaimer). Styled like the
// dark family (white text). Two looks: photo_hero_stat (score) / photo_hero_hook.

import {
  DARK,
  escapeHtml,
  headlineFontSize,
  s,
  toneColor,
} from './post-image-shared';
import { footerHtml, headerRowHtml } from './post-image-fragments';
import { PostImageContent, SingleVariantEntry } from './post-image.types';

/** Full-bleed skyline + dark gradient overlay (top scrim + bottom weight). */
function backdrop(c: PostImageContent): string {
  const img = c.photoDataUri
    ? `<img src="${c.photoDataUri}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" alt=""/>`
    : '';
  const gradient =
    'linear-gradient(180deg, rgba(10,12,35,0.72) 0%, rgba(10,12,35,0.10) 24%, rgba(10,12,35,0.24) 52%, rgba(10,12,35,0.97) 100%)';
  return `${img}<div style="position:absolute;inset:0;background:${gradient};"></div>`;
}

function eyebrowHtml(text: string | undefined): string {
  if (!text) return '';
  return `<div style="font-size:${s(26)};font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${DARK.lavender};margin-bottom:${s(14)};">${escapeHtml(text)}</div>`;
}

function ctaHtml(text: string | undefined): string {
  if (!text) return '';
  return `<div style="margin-top:${s(32)};font-size:${s(34)};font-weight:700;color:${DARK.green};">${escapeHtml(text)}</div>`;
}

/** Photo card with a hero score (bottom-anchored over the gradient). */
function photoHeroStat(c: PostImageContent): string {
  const stat = c.stat;
  const hSize = headlineFontSize(c.headline, 72, 48);
  return `${backdrop(c)}
    <div class="stage" style="padding:78px 64px 60px;">
      ${headerRowHtml(c)}
      <div style="flex:1;"></div>
      <div style="margin-bottom:${s(20)};">
        ${eyebrowHtml(c.eyebrow)}
        <div style="font-size:${s(hSize)};font-weight:800;line-height:1.06;color:${DARK.white};">${escapeHtml(c.headline)}</div>
        ${
          stat
            ? `<div style="display:flex;align-items:center;gap:${s(24)};margin-top:${s(28)};">
                <div class="mono" style="font-size:${s(120)};font-weight:700;line-height:0.9;color:${toneColor('photo', stat.tone)};">${escapeHtml(stat.value)}</div>
                <div style="font-size:${s(28)};font-weight:600;color:${DARK.lavender};max-width:${s(420)};">${escapeHtml(stat.label)}</div>
              </div>`
            : ''
        }
        ${ctaHtml(c.cta)}
      </div>
      ${footerHtml('photo', c.asOf)}
    </div>`;
}

/** Photo card, headline-led (no score) — a bold statement over the skyline. */
function photoHeroHook(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 92, 54);
  return `${backdrop(c)}
    <div class="stage" style="padding:78px 64px 60px;">
      ${headerRowHtml(c)}
      <div style="flex:1;"></div>
      <div style="margin-bottom:${s(20)};">
        ${eyebrowHtml(c.eyebrow)}
        <div style="font-size:${s(hSize)};font-weight:800;line-height:1.05;color:${DARK.white};">${escapeHtml(c.headline)}</div>
        ${c.subhead ? `<div style="margin-top:${s(28)};font-size:${s(34)};line-height:1.35;color:${DARK.lavender};">${escapeHtml(c.subhead)}</div>` : ''}
        ${ctaHtml(c.cta)}
      </div>
      ${footerHtml('photo', c.asOf)}
    </div>`;
}

/** Registry entries for the photo skeleton (spread into SINGLE_VARIANT_REGISTRY). */
export const PHOTO_VARIANTS: SingleVariantEntry[] = [
  {
    id: 'photo_hero_stat',
    family: 'photo',
    skeleton: 'photo',
    build: photoHeroStat,
  },
  {
    id: 'photo_hero_hook',
    family: 'photo',
    skeleton: 'photo',
    build: photoHeroHook,
  },
];
