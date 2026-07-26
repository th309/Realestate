// packages/backend/src/content-pipeline/post-images/post-image-templates.ts
//
// Selector + barrel for the post-image templates. Maps a post's copy JSON + real
// market grounding into concrete family/variant contents, then renders each to
// self-contained HTML. Principle: the LLM supplies the WORDS (hook/body/cta),
// the grounding supplies the NUMBERS (score/value/delta) — stat / rows / versus
// cards never show an invented number, and the selector falls back to a
// typographic look when the data a richer look needs is absent. Single-post
// selection + content building lives in post-image-content.ts; carousels are
// built here. video_script produces NO images (it is a suggestion, not a post).

import { buildCarouselInner } from './post-image-carousel';
import { buildSingleInner } from './post-image-single';
import { selectAndBuildSingle } from './post-image-content';
import { FIT, fitField, shell } from './post-image-shared';
import type { PostCopy } from '../posts/post.types';
import {
  PostImageContent,
  PostImageFamily,
  PostImageGrounding,
} from './post-image.types';

/** Full HTML for a single-post card at the given scale (1 = design size).
 *  `transparentBody` renders the card with no page background — used to capture
 *  the photo card's gradient+text as a transparent overlay for video compositing. */
export function buildSinglePostHtml(
  content: PostImageContent,
  scale = 1,
  opts?: { transparentBody?: boolean },
): string {
  return shell(
    content.family,
    'single_post',
    scale,
    buildSingleInner(content),
    opts,
  );
}

/** Full HTML for one carousel slide at the given scale. */
export function buildCarouselSlideHtml(
  content: PostImageContent,
  scale = 1,
): string {
  return shell(
    content.family,
    'carousel_slide',
    scale,
    buildCarouselInner(content),
  );
}

/** Stable dark/cream family pick for carousels (deterministic from the seed). */
function pickCarouselFamily(seed: string): PostImageFamily {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? 'dark' : 'cream';
}

type ImageItem = {
  template: 'single_post' | 'carousel_slide';
  content: PostImageContent;
};

/** Cover → content(s) → closer slides for a carousel post. */
function buildCarouselContents(
  copy: PostCopy,
  seed: string,
  grounding?: PostImageGrounding,
): ImageItem[] {
  const family = pickCarouselFamily(seed);
  const asOf = grounding?.asOf ?? null;
  const slides = (copy.slides ?? []).slice(0, 8);
  const hook = copy.hook?.trim() || slides[0]?.heading?.trim() || 'PropertyIQ';
  const cta = copy.cta?.trim() || 'See the full picture at propertyiq.app';
  const total = slides.length + 2; // cover + slides + closer

  const out: ImageItem[] = [
    {
      template: 'carousel_slide',
      content: {
        family,
        template: 'carousel_slide',
        variant: 'cover',
        headline: fitField(hook, FIT.hook, 'cover hook'),
        slideLabel: `1 / ${total}`,
        asOf,
      },
    },
  ];
  slides.forEach((slide, i) => {
    out.push({
      template: 'carousel_slide',
      content: {
        family,
        template: 'carousel_slide',
        variant: 'content',
        headline: fitField(
          slide.heading?.trim() || hook,
          FIT.slideHeading,
          'slide heading',
        ),
        body: fitField(slide.body, FIT.slideBody, 'slide body'),
        slideLabel: `${i + 2} / ${total}`,
        asOf,
      },
    });
  });
  out.push({
    template: 'carousel_slide',
    content: {
      family,
      template: 'carousel_slide',
      variant: 'closer',
      headline: fitField(hook, FIT.hook, 'closer hook'),
      cta: fitField(cta, FIT.cta, 'closer cta'),
      asOf,
    },
  });
  return out;
}

/**
 * Build the ordered image contents for a post. Carousels yield cover → content(s)
 * → closer; every other image post yields one card whose look the selector picks
 * from the data available (stat / rows / versus when grounding supplies numbers,
 * else a typographic hook / claim / quote). video_script yields none.
 */
export function copyToImageContents(
  postType: string,
  copy: PostCopy,
  grounding?: PostImageGrounding,
  seed = 'post',
): ImageItem[] {
  if (postType === 'video_script') return [];

  if (
    postType === 'carousel_copy' &&
    Array.isArray(copy.slides) &&
    copy.slides.length > 0
  ) {
    return buildCarouselContents(copy, seed, grounding);
  }

  return [selectAndBuildSingle(copy, grounding, seed)];
}
