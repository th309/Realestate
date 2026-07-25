// packages/backend/src/content-pipeline/feed/feed-prompts.ts
//
// Pure prompt assembly for feed generation. Each builder combines the brand
// preamble (from BrandKitService.buildPromptPreamble) with a compact real
// market-data grounding, and asks the model to return strict JSON. The feed
// service routes these through the DeepSeek generation purposes.

import { FeedMarketGrounding, FeedPostType } from './feed.types';

function groundingLines(g: FeedMarketGrounding): string {
  const parts: string[] = [];
  parts.push(
    `Market: ${g.marketName}${g.state ? `, ${g.state}` : ''} (${g.geoLevel}).`,
  );
  if (g.score != null) {
    parts.push(
      `PropertyIQ Score: ${g.score}${g.scoreLabel ? ` (${g.scoreLabel})` : ''}, confidence ${g.confidence ?? 'unknown'}.`,
    );
  }
  if (g.previousScore != null && g.scoreDelta != null) {
    const dir = g.scoreDelta > 0 ? 'up' : g.scoreDelta < 0 ? 'down' : 'flat';
    parts.push(
      `Score moved ${dir} ${Math.abs(g.scoreDelta)} points from ${g.previousScore}.`,
    );
  }
  if (g.homeValue != null) {
    parts.push(
      `Median home value: $${Math.round(g.homeValue).toLocaleString()}${
        g.homeValueYoyPct != null
          ? ` (${g.homeValueYoyPct.toFixed(1)}% YoY)`
          : ''
      }.`,
    );
  }
  if (g.rent != null) {
    parts.push(
      `Median rent: $${Math.round(g.rent).toLocaleString()}${
        g.rentYoyPct != null ? ` (${g.rentYoyPct.toFixed(1)}% YoY)` : ''
      }.`,
    );
  }
  return parts.join('\n');
}

/** JSON shape instructions per post type. */
const OUTPUT_SHAPE: Record<FeedPostType, string> = {
  linkedin_post:
    'Return JSON: {"hook": string, "body": string, "cta": string, "hashtags": string[]}. body is 2 to 4 short paragraphs. 3 to 5 hashtags.',
  facebook_post:
    'Return JSON: {"hook": string, "body": string, "cta": string, "hashtags": string[]}. Warmer, plain-language tone for a broad audience. 1 to 2 short paragraphs. 2 to 4 hashtags.',
  carousel_copy:
    'Return JSON: {"hook": string, "slides": [{"heading": string, "body": string}], "cta": string}. 4 to 6 slides, declarative and sparse (Apple-keynote tone, not clickbait).',
  video_script:
    'Return JSON: {"hook": string, "body": string, "cta": string}. A 30 to 45 second spoken script. hook is the first line. Close with "Learn more at propertyiq.app".',
};

const INTENT: Record<FeedPostType, string> = {
  linkedin_post:
    'Write one LinkedIn post that teaches a real, data-backed insight about this market, aimed at real estate investors and agents. Lead with the number.',
  facebook_post:
    'Write one Facebook post that helps a first-time buyer or local reader understand what is happening in this market. Lead with a concrete number.',
  carousel_copy:
    'Write a LinkedIn carousel that reveals this market as a finding, one idea per slide, ending on the takeaway.',
  video_script:
    'Write a short-form video script (YouTube Short / Reel) that reveals this market score as a finding and points to the site for the full picture.',
};

/**
 * Build the full user prompt for one post. The brand preamble goes in the system
 * prompt; this returns the user-facing generation instruction with grounding.
 */
export function buildFeedUserPrompt(
  postType: FeedPostType,
  grounding: FeedMarketGrounding,
): string {
  return [
    INTENT[postType],
    '',
    'GROUND EVERY CLAIM IN THIS DATA (do not invent numbers):',
    groundingLines(grounding),
    '',
    "Tie the call to action to what you just showed (this market's report or score), mention the free tier, and link to propertyiq.app.",
    '',
    OUTPUT_SHAPE[postType],
    'Output ONLY the JSON object, no preamble or code fences.',
  ].join('\n');
}
