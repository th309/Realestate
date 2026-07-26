// packages/backend/src/content-pipeline/post-images/post-image-content.ts
//
// Single-post variant SELECTION + content building. Given a post's copy + real
// grounding, pick one variant deterministically from a seed (so a feed shows a
// mix of looks and a regenerate cycles to a different one), gated by the data the
// look needs (stat needs a real number; rows/versus need >= 2-3 ranked markets),
// then map copy + grounding into the concrete PostImageContent the template
// renders. The LLM supplies the WORDS; grounding supplies the NUMBERS — a card
// never shows an invented figure.

import {
  FIT,
  fitField,
  formatCurrencyCompact,
  formatScore,
  leadingSentences,
  scoreTone,
  deltaTone,
} from './post-image-shared';
import {
  hashSeed,
  marketLine,
  pickEmphasis,
  titleCase,
  toRow,
  weekday,
} from './post-image-names';
import { SINGLE_VARIANT_REGISTRY } from './post-image-single';
import type { PostCopy } from '../posts/post.types';
import {
  PostImageContent,
  PostImageFamily,
  PostImageGrounding,
  PostImageRow,
  PostImageStat,
  SinglePostSkeleton,
  SinglePostVariant,
} from './post-image.types';

/** What real data each variant requires to be eligible for selection. */
const NEEDS: Record<
  SinglePostVariant,
  'markets2' | 'markets3' | 'stat' | 'any'
> = {
  daily_card_stat: 'stat',
  editorial_stat: 'stat',
  daily_card_hook: 'any',
  editorial_claim: 'any',
  quote_highlight: 'any',
  daily_card_rows: 'markets3',
  editorial_ranking: 'markets3',
  daily_card_versus: 'markets2',
  editorial_versus: 'markets2',
};

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

type BuildArgs = {
  id: SinglePostVariant;
  family: PostImageFamily;
  skeleton: SinglePostSkeleton;
  copy: PostCopy;
  grounding?: PostImageGrounding;
  derived: ReturnType<typeof deriveStat>;
  rows: PostImageRow[];
  asOf: string | null;
};

function buildContent(a: BuildArgs): PostImageContent {
  const { id, family, skeleton, copy, grounding, derived, rows, asOf } = a;
  const base = { family, template: 'single_post' as const, variant: id, asOf };
  const eyebrow = family === 'dark' ? weekday() : marketLine(grounding);
  const subhead = leadingSentences(copy.body, FIT.subhead) || undefined;

  if (skeleton === 'stat' && derived) {
    return {
      ...base,
      category: derived.category,
      eyebrow,
      headline: fitField(
        copy.hook?.trim() || 'PropertyIQ market intelligence',
        FIT.hook,
        'single hook',
      ),
      subhead: family === 'dark' ? undefined : subhead,
      cta: fitField(copy.cta, FIT.cta, 'single cta') || undefined,
      stat: derived.stat,
      scaleScore: derived.scaleScore,
    };
  }

  if (skeleton === 'rows') {
    return {
      ...base,
      category: 'Ranking',
      eyebrow:
        family === 'dark' ? weekday() : (marketLine(grounding) ?? 'PropertyIQ'),
      headline: fitField(
        copy.hook?.trim() || "This week's market scores",
        FIT.hook,
        'rows headline',
      ),
      rows: rows.slice(0, 5),
      cta:
        family === 'dark'
          ? fitField(
              copy.cta?.trim() || 'Where does your market land? Comment below.',
              FIT.cta,
              'rows cta',
            )
          : undefined,
      subhead: family === 'cream' ? subhead : undefined,
    };
  }

  if (skeleton === 'versus') {
    const pair = rows.slice(0, 2);
    const vsHeadline =
      copy.hook?.trim() ||
      (pair.length === 2
        ? `${pair[0].name} vs ${pair[1].name}`
        : 'Market contrast');
    return {
      ...base,
      category: 'Contrast',
      eyebrow,
      headline: fitField(vsHeadline, FIT.hook, 'versus headline'),
      rows: pair,
      subhead: fitField(
        copy.body?.trim()
          ? leadingSentences(copy.body, FIT.subhead)
          : 'Same data. Different demand signals.',
        FIT.subhead,
        'versus caption',
      ),
    };
  }

  if (skeleton === 'quote') {
    const headline = fitField(
      copy.hook?.trim() ||
        (copy.body?.trim()
          ? leadingSentences(copy.body, FIT.hook)
          : 'PropertyIQ market intelligence'),
      FIT.hook,
      'quote',
    );
    return {
      ...base,
      category: 'Insight',
      headline,
      emphasis: pickEmphasis(headline),
      attribution: marketLine(grounding),
    };
  }

  // hook / claim — typographic, copy-only.
  return {
    ...base,
    category: 'Market Signal',
    eyebrow,
    headline: fitField(
      copy.hook?.trim() || 'PropertyIQ market intelligence',
      FIT.hook,
      'single hook',
    ),
    subhead,
    cta: fitField(copy.cta, FIT.cta, 'single cta') || undefined,
  };
}

/**
 * Pick a single-post variant deterministically from `seed` among those the data
 * supports, then build its content. Regenerating a post with a different seed
 * cycles to a different eligible look.
 */
export function selectAndBuildSingle(
  copy: PostCopy,
  grounding: PostImageGrounding | undefined,
  seed: string,
): { template: 'single_post'; content: PostImageContent } {
  const asOf = grounding?.asOf ?? null;
  const derived = deriveStat(grounding);
  const rows = (grounding?.markets ?? []).map(toRow);

  const eligible = SINGLE_VARIANT_REGISTRY.filter((e) => {
    const need = NEEDS[e.id];
    if (need === 'markets2') return rows.length >= 2;
    if (need === 'markets3') return rows.length >= 3;
    if (need === 'stat') return derived != null;
    return true;
  });
  const pick = eligible[hashSeed(seed) % eligible.length];

  return {
    template: 'single_post',
    content: buildContent({
      id: pick.id,
      family: pick.family,
      skeleton: pick.skeleton,
      copy,
      grounding,
      derived,
      rows,
      asOf,
    }),
  };
}
