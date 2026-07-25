// packages/backend/src/content-pipeline/feed/feed-helpers.ts
//
// Pure helpers for the feed generator: build the market grounding from real
// data, momentum labels (never quality words), flatten generated copy for Gate
// B linting, and estimate USD spend from token usage.

import { MODEL_PRICING } from '../../ai-provider/ai-provider.types';
import type { MarketSnapshot } from '../data/content-data.types';
import type { ScoreMoverItem } from '../data/score-mover-context.queries';
import type { PostCopy } from '../posts/post.types';
import { FeedMarketGrounding } from './feed.types';

/**
 * Momentum label for a score (CLAUDE.md §9 table). Momentum only, never quality
 * words. Kept here so the feed never imports the frontend scoring util.
 */
export function scoreMomentumLabel(
  score: number | null | undefined,
): string | null {
  if (score == null) return null;
  if (score >= 90) return 'very strong';
  if (score >= 80) return 'strong';
  if (score >= 70) return 'rising';
  if (score >= 60) return 'firming';
  if (score >= 50) return 'steady';
  if (score >= 40) return 'easing';
  if (score >= 20) return 'weak';
  return 'very weak';
}

/** Combine a score-mover row + market snapshot into the prompt grounding. */
export function buildGrounding(
  mover: ScoreMoverItem,
  snapshot: MarketSnapshot | null,
): FeedMarketGrounding {
  const score =
    snapshot?.score?.propertyiq_score ?? mover.current_score ?? null;
  return {
    geoLevel: mover.geography,
    geoId: mover.id,
    marketName: mover.canonical_name,
    state: null,
    score,
    scoreLabel: scoreMomentumLabel(score),
    confidence: snapshot?.score?.confidence ?? null,
    previousScore: mover.previous_score ?? null,
    scoreDelta: mover.delta ?? null,
    homeValue: snapshot?.home_value?.value ?? null,
    homeValueYoyPct: snapshot?.home_value?.yoy_pct ?? null,
    rent: snapshot?.rent?.value ?? null,
    rentYoyPct: snapshot?.rent?.yoy_pct ?? null,
  };
}

/** Flatten a generated post's copy JSON into one string for Gate B linting. */
export function flattenCopyForLint(copy: PostCopy): string {
  const parts: string[] = [];
  if (typeof copy.hook === 'string') parts.push(copy.hook);
  if (typeof copy.body === 'string') parts.push(copy.body);
  if (Array.isArray(copy.slides)) {
    for (const s of copy.slides) {
      if (s && typeof s.heading === 'string') parts.push(s.heading);
      if (s && typeof s.body === 'string') parts.push(s.body);
    }
  }
  if (typeof copy.cta === 'string') parts.push(copy.cta);
  if (Array.isArray(copy.hashtags)) parts.push(copy.hashtags.join(' '));
  return parts.join('\n\n');
}

/** Estimate USD spend for a completion from its token usage. 0 if unpriced. */
export function usdFromUsage(
  model: string,
  usage: { promptTokens: number; completionTokens: number } | undefined,
): number {
  if (!usage) return 0;
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (usage.promptTokens * pricing.input +
      usage.completionTokens * pricing.output) /
    1_000_000
  );
}
