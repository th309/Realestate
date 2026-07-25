/**
 * Parse a post's metrics out of Late's GET /analytics response.
 *
 * FORMULA (documented): reach = analytics.reach, falling back to impressions;
 * engagement = likes + comments + shares + saves (the interaction metrics Late
 * returns). engagementRate/clicks/views are intentionally not folded into
 * engagement — the frontend charts reach vs interaction counts.
 */
export interface PostMetrics {
  reach: number;
  engagement: number;
}

export function extractPostMetrics(raw: unknown): PostMetrics {
  const analytics =
    (raw as { analytics?: Record<string, unknown> } | null)?.analytics ?? {};
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

  const reach = num(analytics.reach) || num(analytics.impressions);
  const engagement =
    num(analytics.likes) +
    num(analytics.comments) +
    num(analytics.shares) +
    num(analytics.saves);
  return { reach, engagement };
}
