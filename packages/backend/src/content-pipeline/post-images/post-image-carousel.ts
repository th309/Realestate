// packages/backend/src/content-pipeline/post-images/post-image-carousel.ts
//
// Carousel slides with distinct cover / content / closer treatments, in either
// family. Cover leads with the hook, content slides carry one idea each, the
// closer lands the CTA + disclaimer. Font sizes scale with --s for overflow fit.

import {
  CREAM,
  DARK,
  escapeHtml,
  footerHtml,
  headlineFontSize,
  markHtml,
} from './post-image-shared';
import { PostImageContent, PostImageFamily } from './post-image.types';

function s(px: number): string {
  return `calc(${px}px * var(--s))`;
}

function ink(family: PostImageFamily): string {
  return family === 'dark' ? DARK.white : CREAM.ink;
}
function muted(family: PostImageFamily): string {
  return family === 'dark' ? DARK.lavender : CREAM.muted;
}
function accent(family: PostImageFamily): string {
  return family === 'dark' ? DARK.green : CREAM.teal;
}
function serifClass(family: PostImageFamily): string {
  return family === 'cream' ? 'serif' : '';
}

/** Slide-position chip, e.g. "1 / 5". */
function slideChip(family: PostImageFamily, label: string): string {
  const border = family === 'dark' ? DARK.rowStroke : CREAM.hairline;
  return `<div style="border:2px solid ${border};color:${muted(family)};border-radius:999px;padding:8px 22px;font-size:22px;font-weight:700;letter-spacing:1px;align-self:flex-start;">${escapeHtml(label)}</div>`;
}

function accentBar(family: PostImageFamily): string {
  if (family !== 'dark') return '';
  return `<div style="position:absolute;top:0;left:0;right:0;height:10px;background:linear-gradient(90deg,${DARK.barFrom} 0%,${DARK.barTo} 100%);"></div>`;
}

/** Cover slide: brand mark, hook headline, slide count, swipe hint. */
function cover(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 86, 52);
  return `${accentBar(c.family)}
    <div class="stage" style="padding:78px 64px 60px;">
      ${markHtml(c.family)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div class="${serifClass(c.family)}" style="font-size:${s(hSize)};font-weight:800;line-height:1.06;color:${ink(c.family)};">${escapeHtml(c.headline)}</div>
        ${c.subhead ? `<div style="margin-top:34px;font-size:36px;line-height:1.35;color:${muted(c.family)};">${escapeHtml(c.subhead)}</div>` : ''}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:26px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${accent(c.family)};">Swipe →</div>
        ${c.slideLabel ? slideChip(c.family, c.slideLabel) : ''}
      </div>
    </div>`;
}

/** Content slide: one idea — heading + body. */
function content(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 62, 44);
  return `${accentBar(c.family)}
    <div class="stage" style="padding:78px 64px 60px;">
      ${c.slideLabel ? slideChip(c.family, c.slideLabel) : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div class="${serifClass(c.family)}" style="font-size:${s(hSize)};font-weight:800;line-height:1.1;color:${ink(c.family)};">${escapeHtml(c.headline)}</div>
        ${c.body ? `<div style="margin-top:32px;font-size:${s(38)};line-height:1.4;color:${muted(c.family)};">${escapeHtml(c.body)}</div>` : ''}
      </div>
      ${markHtml(c.family)}
    </div>`;
}

/** Closer slide: CTA + brand mark + disclaimer footer. */
function closer(c: PostImageContent): string {
  const hSize = headlineFontSize(c.headline, 72, 46);
  return `${accentBar(c.family)}
    <div class="stage" style="padding:78px 64px 60px;">
      ${markHtml(c.family)}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div class="${serifClass(c.family)}" style="font-size:${s(hSize)};font-weight:800;line-height:1.08;color:${ink(c.family)};">${escapeHtml(c.headline)}</div>
        ${c.cta ? `<div style="margin-top:36px;font-size:40px;font-weight:700;color:${accent(c.family)};">${escapeHtml(c.cta)}</div>` : ''}
      </div>
      ${footerHtml(c.family, c.asOf)}
    </div>`;
}

/** Dispatch a carousel slide content to its role treatment (returns .stage inner). */
export function buildCarouselInner(c: PostImageContent): string {
  switch (c.variant) {
    case 'cover':
      return cover(c);
    case 'closer':
      return closer(c);
    case 'content':
    default:
      return content(c);
  }
}
