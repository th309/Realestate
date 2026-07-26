// packages/backend/src/content-pipeline/post-images/post-image-templates.ts
//
// Selector + barrel for the post-image templates. Maps a post's copy JSON + real
// market grounding into concrete family/variant contents, then renders each to
// self-contained HTML. Principle: the LLM supplies the WORDS (hook/body/cta),
// the grounding supplies the NUMBERS (score/value/delta) — stat cards never show
// an invented number, and fall back to a typographic variant when a number is
// missing. video_script produces NO images (it is a suggestion, not a post).

import { buildCarouselInner } from './post-image-carousel';
import { buildSingleInner } from './post-image-single';
import {
  deltaTone,
  fitField,
  formatCurrencyCompact,
  formatScore,
  leadingSentences,
  scoreTone,
  shell,
} from './post-image-shared';
import type { PostCopy } from '../posts/post.types';
import {
  PostImageContent,
  PostImageFamily,
  PostImageGrounding,
  PostImageStat,
} from './post-image.types';

/**
 * Per-region CHAR BUDGETS = how much copy each region holds at the renderer's
 * FLOOR scale (0.6). These are no-ops for legal feed copy (bounded by PostCopyDto)
 * — font step-down + the scale ladder do the real fitting; fitField only truncates
 * (+warns) genuinely pathological input. Where the DTO max exceeds what a 4:5 card
 * can hold (body 2200, slide body 1000), the budget is set to the measured floor
 * capacity and the overflow lives in the published caption, not the image.
 */
const FIT = {
  hook: 300, // = PostCopyDto.hook max
  cta: 500, // = PostCopyDto.cta max
  slideHeading: 200, // = PostCopyDto slide heading max
  slideBody: 600, // content-slide floor capacity (< DTO 1000)
  subhead: 260, // single-post supporting line (leading sentences of a long body)
} as const;

/** Full HTML for a single-post card at the given scale (1 = design size). */
export function buildSinglePostHtml(
  content: PostImageContent,
  scale = 1,
): string {
  return shell(content.family, 'single_post', scale, buildSingleInner(content));
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

/** Stable 0/1 family pick from a seed so a feed shows both looks (deterministic). */
function pickFamily(seed: string): PostImageFamily {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? 'dark' : 'cream';
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function marketLine(g: PostImageGrounding | undefined): string | undefined {
  if (!g?.marketName) return undefined;
  return g.state ? `${g.marketName}, ${g.state}` : g.marketName;
}

/**
 * Derive the hero stat from real grounding (score first, then home value). Returns
 * undefined when no usable number exists — the caller then uses a non-stat variant.
 */
function deriveStat(
  g: PostImageGrounding | undefined,
):
  | { stat: PostImageStat; scaleScore: number | null; category: string }
  | undefined {
  const score = formatScore(g?.score);
  if (g && score != null) {
    const momentum = g.scoreLabel ? titleCase(g.scoreLabel) : null;
    return {
      stat: {
        value: score,
        label: momentum ? `PropertyIQ Score · ${momentum}` : 'PropertyIQ Score',
        context: marketLine(g),
        tone: scoreTone(g.score),
      },
      scaleScore: g.score ?? null,
      category: 'PropertyIQ Score',
    };
  }
  const value = formatCurrencyCompact(g?.homeValue);
  if (g && value != null) {
    return {
      stat: {
        value,
        label: 'Median home value',
        context: marketLine(g),
        tone: deltaTone(g.homeValueYoyPct),
      },
      scaleScore: null,
      category: 'Home Values',
    };
  }
  return undefined;
}

function weekday(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();
}

/**
 * Build the ordered image contents for a post. Carousels yield cover → content(s)
 * → closer; every other image post yields one card (stat variant when grounding
 * has a number, else a typographic hook/claim). video_script yields none.
 */
export function copyToImageContents(
  postType: string,
  copy: PostCopy,
  grounding?: PostImageGrounding,
  seed = 'post',
): Array<{
  template: 'single_post' | 'carousel_slide';
  content: PostImageContent;
}> {
  if (postType === 'video_script') return [];

  const family = pickFamily(seed);
  const asOf = grounding?.asOf ?? null;

  if (
    postType === 'carousel_copy' &&
    Array.isArray(copy.slides) &&
    copy.slides.length > 0
  ) {
    const slides = copy.slides.slice(0, 8);
    const hook =
      copy.hook?.trim() || slides[0]?.heading?.trim() || 'PropertyIQ';
    const cta = copy.cta?.trim() || `See the full picture at propertyiq.app`;
    const total = slides.length + 2; // cover + slides + closer
    const out: Array<{
      template: 'single_post' | 'carousel_slide';
      content: PostImageContent;
    }> = [];
    out.push({
      template: 'carousel_slide',
      content: {
        family,
        template: 'carousel_slide',
        variant: 'cover',
        headline: fitField(hook, FIT.hook, 'cover hook'),
        slideLabel: `1 / ${total}`,
        asOf,
      },
    });
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

  // Single image post: stat variant when we have a real number, else typographic.
  const derived = deriveStat(grounding);
  const headline = fitField(
    copy.hook?.trim() || 'PropertyIQ market intelligence',
    FIT.hook,
    'single hook',
  );
  // Card subhead = complete leading sentences of the body (never a mid-word cut);
  // the full body stays in the published caption.
  const subhead = leadingSentences(copy.body, FIT.subhead) || undefined;
  const cta = fitField(copy.cta, FIT.cta, 'single cta') || undefined;

  const content: PostImageContent =
    derived != null
      ? {
          family,
          template: 'single_post',
          variant: family === 'dark' ? 'daily_card_stat' : 'editorial_stat',
          category: derived.category,
          eyebrow: family === 'dark' ? weekday() : marketLine(grounding),
          headline,
          subhead: family === 'dark' ? undefined : subhead,
          cta,
          stat: derived.stat,
          scaleScore: derived.scaleScore,
          asOf,
        }
      : {
          family,
          template: 'single_post',
          variant: family === 'dark' ? 'daily_card_hook' : 'editorial_claim',
          category: 'Market Signal',
          eyebrow: family === 'dark' ? weekday() : marketLine(grounding),
          headline,
          subhead,
          cta,
          asOf,
        };

  return [{ template: 'single_post', content }];
}
