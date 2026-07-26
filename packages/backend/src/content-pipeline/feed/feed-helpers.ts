// packages/backend/src/content-pipeline/feed/feed-helpers.ts
//
// Pure helpers for the feed generator: build the market grounding from real
// data, momentum labels (never quality words), flatten generated copy for Gate
// B linting, and estimate USD spend from token usage.

import { MODEL_PRICING } from '../../ai-provider/ai-provider.types';
import type {
  MarketSnapshot,
  ResolvedMarket,
} from '../data/content-data.types';
import type { ScoreMoverItem } from '../data/score-mover-context.queries';
import type { PostCopy } from '../posts/post.types';
import { isContentFormat } from '../dto/content-format';
import {
  FeedMarketGrounding,
  FeedPostType,
  GroundingTarget,
} from './feed.types';

/**
 * Momentum label for a score (CLAUDE.md §9 table). Momentum only, never quality
 * words. Kept here so the feed never imports the frontend scoring util.
 *
 * DRIFT GUARD: this table MUST stay identical to getScoreLabel() in
 * packages/frontend/app/components/scoring/ScoreDisplay.tsx. The backend cannot
 * import from the frontend, so feed-helpers.spec.ts asserts the exact 8-band
 * table verbatim. If you change a band or label here, change ScoreDisplay.tsx
 * (and this spec) too, or stale momentum language leaks into generated posts.
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

/** Combine a grounding target (score-mover or resolved market) + snapshot into the prompt grounding. */
export function buildGrounding(
  target: GroundingTarget,
  snapshot: MarketSnapshot | null,
): FeedMarketGrounding {
  const score =
    snapshot?.score?.propertyiq_score ?? target.current_score ?? null;
  return {
    geoLevel: target.geography,
    geoId: target.id,
    marketName: target.canonical_name,
    state: target.state ?? null,
    score,
    scoreLabel: scoreMomentumLabel(score),
    confidence: snapshot?.score?.confidence ?? null,
    previousScore: target.previous_score ?? null,
    scoreDelta: target.delta ?? null,
    homeValue: snapshot?.home_value?.value ?? null,
    homeValueYoyPct: snapshot?.home_value?.yoy_pct ?? null,
    rent: snapshot?.rent?.value ?? null,
    rentYoyPct: snapshot?.rent?.yoy_pct ?? null,
  };
}

/** Flatten a generated post's copy JSON into one string for Gate B linting. */
export function flattenCopyForLint(copy: PostCopy): string {
  const parts: string[] = [];
  if (typeof copy.title === 'string') parts.push(copy.title);
  if (typeof copy.hook === 'string') parts.push(copy.hook);
  if (typeof copy.body === 'string') parts.push(copy.body);
  if (typeof copy.close === 'string') parts.push(copy.close);
  if (typeof copy.sceneDirection === 'string') parts.push(copy.sceneDirection);
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

/**
 * Sanitize a generated video_script copy in place: drop an invalid suggestedFormat
 * (the model may hallucinate an id) rather than failing the post, and clamp
 * durationSeconds to a sane 5-600s. Other post types pass through untouched.
 */
export function coerceVideoScriptCopy(copy: PostCopy): PostCopy {
  if (
    copy.suggestedFormat != null &&
    !isContentFormat(String(copy.suggestedFormat))
  ) {
    delete copy.suggestedFormat;
  }
  if (copy.durationSeconds != null) {
    const n = Number(copy.durationSeconds);
    copy.durationSeconds = Number.isFinite(n)
      ? Math.min(600, Math.max(5, Math.round(n)))
      : undefined;
  }
  return copy;
}

/** Map an on-demand Create type + platform to a feed post type. */
export function mapGenerateTypeToPostType(
  type: 'image_post' | 'carousel' | 'from_topic' | 'video_script',
  platform: string | undefined,
): FeedPostType {
  if (type === 'carousel') return 'carousel_copy';
  if (type === 'video_script') return 'video_script';
  // image_post + from_topic → one card; LinkedIn gets the LinkedIn voice.
  return platform === 'linkedin' ? 'linkedin_post' : 'facebook_post';
}

/**
 * Turn resolveMarket() results into a grounding target: the first non-state
 * match (getMarketSnapshot fills the real score). Returns null when nothing
 * usable resolved, so the caller can fall back to a candidate mover.
 */
export function resolveMarketTarget(
  resolved: ResolvedMarket[],
): GroundingTarget | null {
  const m = resolved.find((r) => r.geography !== 'state');
  if (!m) return null;
  return {
    id: m.id,
    canonical_name: m.canonical_name,
    geography: m.geography as 'metro' | 'county' | 'zip',
    state: m.state ?? null,
  };
}

/** Pick the grounding mover for an on-demand request: match the query by name, else the top mover. */
export function pickMoverForQuery(
  candidates: ScoreMoverItem[],
  query?: string,
): ScoreMoverItem {
  const q = query?.trim().toLowerCase();
  if (q) {
    const match = candidates.find((c) =>
      c.canonical_name?.toLowerCase().includes(q),
    );
    if (match) return match;
  }
  return candidates[0];
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
