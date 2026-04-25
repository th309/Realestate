import { Injectable, Logger } from '@nestjs/common';

export interface DiscoveredVideo {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
}

interface YouTubeSearchResponse {
  items?: Array<{
    id: { videoId: string };
    snippet: { channelId: string; channelTitle: string; title: string };
  }>;
  nextPageToken?: string;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string;
    snippet: {
      channelId: string;
      channelTitle: string;
      title: string;
      description: string;
      publishedAt: string;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
    contentDetails?: { duration?: string };
  }>;
}

/**
 * Discover top-performing real-estate videos on YouTube and rank them
 * with a weighted rank-sum (1.5 × view_rank + 1.0 × like_rank + 0.5 ×
 * comment_rank) — replaces the hard cascade in earlier plan drafts so
 * a video with crazy comments but mediocre views still surfaces.
 *
 * Uses the YouTube Data API v3 search.list + videos.list endpoints.
 * Quota cost: search.list = 100 units, videos.list = 1 unit. Default
 * 50 query terms × 1 page each = 5050 units (well under the 10k daily
 * quota for a free Cloud project).
 */
@Injectable()
export class YouTubeDiscoveryService {
  private readonly logger = new Logger(YouTubeDiscoveryService.name);

  isConfigured(): boolean {
    return !!process.env.YOUTUBE_DATA_API_KEY;
  }

  /**
   * Run a single discovery pass for the given query terms. Returns the
   * top N videos by weighted rank-sum across views/likes/comments.
   */
  async discover(args: {
    queries: string[];
    maxPerQuery?: number;
    topN?: number;
    publishedAfter?: Date;
  }): Promise<DiscoveredVideo[]> {
    if (!this.isConfigured()) {
      throw new Error('YOUTUBE_DATA_API_KEY required for discovery');
    }
    const apiKey = process.env.YOUTUBE_DATA_API_KEY!;
    const maxPerQuery = args.maxPerQuery ?? 25;
    const publishedAfter =
      args.publishedAfter?.toISOString() ??
      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // 1. search.list per query → flatten to a unique videoId set
    const ids = new Set<string>();
    for (const q of args.queries) {
      const url =
        'https://www.googleapis.com/youtube/v3/search' +
        `?part=snippet&type=video&maxResults=${maxPerQuery}` +
        `&order=viewCount&publishedAfter=${encodeURIComponent(publishedAfter)}` +
        `&q=${encodeURIComponent(q)}` +
        `&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(
          `[DISCO] search failed q="${q}" status=${res.status} — skipping`,
        );
        continue;
      }
      const json = (await res.json()) as YouTubeSearchResponse;
      for (const item of json.items ?? []) {
        if (item.id?.videoId) ids.add(item.id.videoId);
      }
    }
    this.logger.log(
      `[DISCO] search complete queries=${args.queries.length} unique_videos=${ids.size}`,
    );

    if (ids.size === 0) return [];

    // 2. videos.list (batch up to 50 per call) for view/like/comment stats
    const idArray = Array.from(ids);
    const enriched: DiscoveredVideo[] = [];
    for (let i = 0; i < idArray.length; i += 50) {
      const batch = idArray.slice(i, i + 50);
      const url =
        'https://www.googleapis.com/youtube/v3/videos' +
        `?part=snippet,statistics,contentDetails` +
        `&id=${batch.join(',')}` +
        `&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(
          `[DISCO] videos.list batch failed status=${res.status} — skipping batch`,
        );
        continue;
      }
      const json = (await res.json()) as YouTubeVideosResponse;
      for (const v of json.items ?? []) {
        enriched.push({
          videoId: v.id,
          channelId: v.snippet.channelId,
          channelTitle: v.snippet.channelTitle,
          title: v.snippet.title,
          description: v.snippet.description,
          publishedAt: v.snippet.publishedAt,
          viewCount: parseInt(v.statistics?.viewCount ?? '0', 10),
          likeCount: parseInt(v.statistics?.likeCount ?? '0', 10),
          commentCount: parseInt(v.statistics?.commentCount ?? '0', 10),
          durationSeconds: parseISO8601Duration(
            v.contentDetails?.duration ?? 'PT0S',
          ),
        });
      }
    }

    // 3. weighted rank-sum: lower combined rank = higher position
    return rankByWeightedSum(enriched, args.topN ?? 100);
  }
}

/**
 * Weighted rank-sum: each video gets ranked by viewCount, likeCount,
 * commentCount independently (1 = best). Combined score =
 *   1.5*viewRank + 1.0*likeRank + 0.5*commentRank
 * Lowest combined score wins. The 1.5/1.0/0.5 weights came from the
 * plan revision (commit fc9b009f) — views matter most, comments are
 * tie-breakers for niche channels.
 */
function rankByWeightedSum(
  videos: DiscoveredVideo[],
  topN: number,
): DiscoveredVideo[] {
  if (videos.length === 0) return [];
  const byView = [...videos].sort((a, b) => b.viewCount - a.viewCount);
  const byLike = [...videos].sort((a, b) => b.likeCount - a.likeCount);
  const byComment = [...videos].sort((a, b) => b.commentCount - a.commentCount);

  const viewRank = new Map(byView.map((v, i) => [v.videoId, i + 1]));
  const likeRank = new Map(byLike.map((v, i) => [v.videoId, i + 1]));
  const commentRank = new Map(byComment.map((v, i) => [v.videoId, i + 1]));

  return [...videos]
    .map((v) => ({
      v,
      score:
        1.5 * (viewRank.get(v.videoId) ?? 0) +
        1.0 * (likeRank.get(v.videoId) ?? 0) +
        0.5 * (commentRank.get(v.videoId) ?? 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, topN)
    .map((entry) => entry.v);
}

function parseISO8601Duration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? '0', 10) * 3600 +
    parseInt(m[2] ?? '0', 10) * 60 +
    parseInt(m[3] ?? '0', 10)
  );
}
