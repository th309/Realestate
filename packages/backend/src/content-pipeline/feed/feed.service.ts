// packages/backend/src/content-pipeline/feed/feed.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService, PostWithMedia } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { PipelineSettingsService } from '../pipeline-settings.service';
import { FeedPostGeneratorService } from './feed-post-generator.service';
import { StylePreferenceService } from '../style-preferences/style-preference.service';
import {
  pickCandidateMarkets,
  recordFeedSpend,
} from './feed-generation-shared';
import {
  mapGenerateTypeToPostType,
  noPostOutcome,
  pickMoverForQuery,
  resolveMarketTarget,
} from './feed-helpers';
import type { PostRow } from '../posts/post.types';
import {
  FEED_POST_TYPES,
  FeedGenerationOutcome,
  FeedPostType,
  GroundingTarget,
} from './feed.types';

/** Conservative per-post spend estimate for the budget guards (DeepSeek). */
const EST_USD_PER_POST = 0.02;

/**
 * Orchestrates on-demand content generation (/generate, Create cards). The
 * cron top-up loop that keeps the review queue full lives in
 * FeedTopUpService (split out to stay under the file-size limit); both share
 * candidate-market selection and spend recording via feed-generation-shared.ts.
 * Grounding + DeepSeek generation + Gate B + insert + image render live in
 * FeedPostGeneratorService.
 *
 * Every generation path takes its system prompt from
 * StylePreferenceService.buildGenerationPreamble, which is the brand voice plus
 * the brand's liked style references (Phase 8 preference learning).
 */
@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly brandKit: BrandKitService,
    private readonly posts: PostsService,
    private readonly contentData: ContentDataService,
    private readonly costCap: CostCapService,
    private readonly settings: PipelineSettingsService,
    private readonly generator: FeedPostGeneratorService,
    private readonly stylePreferences: StylePreferenceService,
  ) {}

  /**
   * Generate one post on demand (the manual counterpart to the cron): same
   * grounding, DeepSeek generation, Gate B, insert, and image render.
   */
  async generateOnePost(input: {
    postType?: FeedPostType;
    brandId?: string;
  }): Promise<{ outcome: FeedGenerationOutcome; post: PostRow | null }> {
    const postType = input.postType ?? FEED_POST_TYPES[0];
    if (this.settings.isPaused()) {
      return noPostOutcome(postType, 'skipped_budget', 'pipeline paused');
    }
    const brand = await this.brandKit.getBrandProfile(input.brandId);
    const budget = await this.costCap.canEnqueue(EST_USD_PER_POST);
    if (!budget.allowed) {
      return noPostOutcome(postType, 'skipped_budget');
    }
    const candidates = await pickCandidateMarkets(this.contentData);
    if (candidates.length === 0) {
      return noPostOutcome(postType, 'error', 'no candidate markets available');
    }
    const preamble = await this.stylePreferences.buildGenerationPreamble(brand);
    const r = await this.generator.generatePost(
      brand,
      preamble,
      postType,
      candidates[0],
      { movers: candidates },
    );
    await this.recordSpend(r.spentUsd, r.spentTokens);
    return { outcome: r.outcome, post: r.post };
  }

  /**
   * Generate one post on demand from the Create cards. Maps the request type to a
   * feed post type + platform, grounds it in a real market (matched to marketQuery
   * / topic when given, else the top mover), and runs the standard generation path
   * (grounding + DeepSeek + Gate B + insert + image render). video_script produces
   * a suggestion (no image, routed to the video pipeline), so it keeps the youtube
   * platform and ignores the social platform hint.
   */
  async generateOnDemand(input: {
    type: 'image_post' | 'carousel' | 'from_topic' | 'video_script';
    platform?: string;
    topic?: string;
    marketQuery?: string;
    brandId?: string;
  }): Promise<{ outcome: FeedGenerationOutcome; post: PostWithMedia | null }> {
    const postType = mapGenerateTypeToPostType(input.type, input.platform);
    if (this.settings.isPaused()) {
      return noPostOutcome(postType, 'skipped_budget', 'pipeline paused');
    }
    const brand = await this.brandKit.getBrandProfile(input.brandId);
    const budget = await this.costCap.canEnqueue(EST_USD_PER_POST);
    if (!budget.allowed) {
      return noPostOutcome(postType, 'skipped_budget');
    }
    // User-directed grounding: an explicit marketQuery resolves a specific
    // market; otherwise pick a top mover (matched to the query/topic if any).
    const query = input.marketQuery?.trim();
    let target: GroundingTarget | null = query
      ? resolveMarketTarget(
          await this.contentData.resolveMarket(query).catch(() => []),
        )
      : null;
    // A user-resolved single market stays single (no ranking); only the mover
    // fallback carries the candidate list down for a list / head-to-head look.
    let movers: GroundingTarget[] | undefined;
    if (!target) {
      const candidates = await pickCandidateMarkets(this.contentData);
      movers = candidates;
      target = candidates.length
        ? pickMoverForQuery(candidates, query ?? input.topic)
        : null;
    }
    if (!target) {
      return noPostOutcome(postType, 'error', 'no market to ground on');
    }
    const preamble = await this.stylePreferences.buildGenerationPreamble(brand);
    const r = await this.generator.generatePost(
      brand,
      preamble,
      postType,
      target,
      {
        // video_script routes to the youtube video pipeline; keep its own platform.
        platform: input.type === 'video_script' ? undefined : input.platform,
        brief: input.type === 'from_topic' ? input.topic : undefined,
        movers,
      },
    );
    await this.recordSpend(r.spentUsd, r.spentTokens);
    // Re-read + sign so the response carries the freshly-rendered media.
    const post = r.post ? await this.posts.withSignedMedia(r.post) : null;
    return { outcome: r.outcome, post };
  }

  /** Record accumulated DeepSeek spend against the daily cap (best-effort). */
  private async recordSpend(
    spentUsd: number,
    spentTokens: number,
  ): Promise<void> {
    await recordFeedSpend(this.costCap, this.logger, spentUsd, spentTokens);
  }
}
