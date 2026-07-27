// packages/backend/src/content-pipeline/orchestrator/job-handlers/youtube-publish-metadata.ts
import { buildYouTubeShortsMeta } from '../youtube-tags';

function resolveShortLink(text: string): string {
  return text.replace(/\{\{SHORT_LINK\}\}/g, 'propertyiq.app');
}

/**
 * Title, description and tags for a YouTube upload. The long-form lane reuses
 * the Shorts tag builder but drops #Shorts, which would otherwise make YouTube
 * classify a deep-dive as a Short.
 */
export function buildYouTubePublishMetadata(opts: {
  runId: string;
  canonicalName: string;
  score: number | undefined;
  script: { hook: string; body: string; cta: string };
  lane: 'shorts' | 'long';
}): { title: string; description: string; tags: string[] } {
  const { runId, canonicalName, score, script, lane } = opts;
  const { hashtags, tags } = buildYouTubeShortsMeta({
    runId,
    resolvedMarket: { canonical_name: canonicalName },
    score,
  });

  const laneHashtags =
    lane === 'long' ? hashtags.filter((h) => h !== '#Shorts') : hashtags;

  const title =
    lane === 'long'
      ? `${canonicalName} Market Deep Dive | PropertyIQ`
      : `${canonicalName} PropertyIQ Score`;

  const descriptionBody = [
    resolveShortLink(script.hook),
    resolveShortLink(script.body),
    resolveShortLink(script.cta),
  ].join('\n\n');

  return {
    title,
    description: `${descriptionBody}\n\n${laneHashtags.join(' ')}`,
    tags,
  };
}
