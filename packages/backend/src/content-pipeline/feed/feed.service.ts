// packages/backend/src/content-pipeline/feed/feed.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService, PostWithMedia } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { PipelineSettingsService } from '../pipeline-settings.service';
import { FeedPostGeneratorService } from './feed-post-generator.service';
import {
  mapGenerateTypeToPostType,
  pickMoverForQuery,
  resolveMarketTarget,
} from './feed-helpers';
import type {
  ScoreMoverGeo,
  ScoreMoverWindowDays,
} from '../data/score-mover-config';
import type { PostRow } from '../posts/post.types';
import {
  FEED_POST_TYPES,
  FeedGenerationOutcome,
  FeedPostType,
  GroundingTarget,
} from './feed.types';

const DEFAULT_TARGET_DRAFTS = 6;
const MAX_PER_CYCLE = 10;
/** Conservative per-post spend estimate for the budget guards (DeepSeek). */
const EST_USD_PER_POST = 0.02;
const FEED_GEO: ScoreMoverGeo = 'metro';
const FEED_WINDOW: ScoreMoverWindowDays = 90;

/**
 * Orchestrates the content feed: keeps N pending_review drafts queued (cron) and
 * generates one post on demand (/generate). Grounding + DeepSeek generation +
 * Gate B + insert + image render live in FeedPostGeneratorService; this service
 * owns the pause gate, candidate selection, and the CONTENT_PIPELINE_DAILY_USD_MAX
 * budget (re-checked per post against real running spend).
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
  ) {}

  private targetDrafts(): number {
    const env = Number(process.env.CONTENT_FEED_TARGET_DRAFTS);
    return Number.isFinite(env) && env > 0
      ? Math.floor(env)
      : DEFAULT_TARGET_DRAFTS;
  }

  /**
   * Top up pending_review drafts to the target. Returns an outcome per attempt.
   * No-ops when paused, already at target, or the daily budget is exhausted.
   */
  async topUp(): Promise<FeedGenerationOutcome[]> {
    if (this.settings.isPaused()) {
      this.logger.log('feed top-up skipped: pipeline paused');
      return [];
    }

    const brand = await this.brandKit.getBrandProfile();
    const pending = await this.posts.listPosts({
      brandId: brand.id,
      status: 'pending_review',
      limit: 500,
    });
    const target = this.targetDrafts();
    const need = Math.min(target - pending.length, MAX_PER_CYCLE);
    if (need <= 0) {
      this.logger.log(
        `feed at target (${pending.length}/${target} pending); nothing to generate`,
      );
      return [];
    }

    const budget = await this.costCap.canEnqueue(need * EST_USD_PER_POST);
    if (!budget.allowed) {
      this.logger.warn(
        `feed top-up skipped: daily budget exhausted (spent $${budget.usdSpent} / cap $${budget.usdCap})`,
      );
      return [
        { postType: 'linkedin_post', marketName: '', status: 'skipped_budget' },
      ];
    }

    const candidates = await this.pickCandidateMarkets();
    if (candidates.length === 0) {
      this.logger.warn('feed top-up: no candidate markets available');
      return [];
    }

    const preamble = this.brandKit.buildPromptPreamble(brand);
    const outcomes: FeedGenerationOutcome[] = [];
    let spentUsd = 0;
    let spentTokens = 0;

    try {
      for (let i = 0; i < need; i++) {
        const postType = FEED_POST_TYPES[i % FEED_POST_TYPES.length];
        const mover = candidates[i % candidates.length];

        // Per-post budget guard against REAL running spend, not just the
        // pre-cycle estimate — stop before billing a post we can't afford.
        if (budget.usdSpent + spentUsd + EST_USD_PER_POST > budget.usdCap) {
          this.logger.warn(
            `feed top-up: budget cap reached mid-cycle (spent ~$${(budget.usdSpent + spentUsd).toFixed(4)} / cap $${budget.usdCap})`,
          );
          outcomes.push({
            postType,
            marketName: mover.canonical_name,
            status: 'skipped_budget',
          });
          break;
        }

        const r = await this.generator.generatePost(
          brand,
          preamble,
          postType,
          mover,
        );
        spentUsd += r.spentUsd;
        spentTokens += r.spentTokens;
        outcomes.push(r.outcome);
      }
    } finally {
      await this.recordSpend(spentUsd, spentTokens);
    }

    const inserted = outcomes.filter((o) => o.status === 'inserted').length;
    this.logger.log(
      `feed top-up: inserted ${inserted}/${need} (spent ~$${spentUsd.toFixed(4)})`,
    );
    return outcomes;
  }

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
      return {
        outcome: {
          postType,
          marketName: '',
          status: 'skipped_budget',
          reason: 'pipeline paused',
        },
        post: null,
      };
    }
    const brand = await this.brandKit.getBrandProfile(input.brandId);
    const budget = await this.costCap.canEnqueue(EST_USD_PER_POST);
    if (!budget.allowed) {
      return {
        outcome: { postType, marketName: '', status: 'skipped_budget' },
        post: null,
      };
    }
    const candidates = await this.pickCandidateMarkets();
    if (candidates.length === 0) {
      return {
        outcome: {
          postType,
          marketName: '',
          status: 'error',
          reason: 'no candidate markets available',
        },
        post: null,
      };
    }
    const preamble = this.brandKit.buildPromptPreamble(brand);
    const r = await this.generator.generatePost(
      brand,
      preamble,
      postType,
      candidates[0],
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
      return {
        outcome: {
          postType,
          marketName: '',
          status: 'skipped_budget',
          reason: 'pipeline paused',
        },
        post: null,
      };
    }
    const brand = await this.brandKit.getBrandProfile(input.brandId);
    const budget = await this.costCap.canEnqueue(EST_USD_PER_POST);
    if (!budget.allowed) {
      return {
        outcome: { postType, marketName: '', status: 'skipped_budget' },
        post: null,
      };
    }
    // User-directed grounding: an explicit marketQuery resolves a specific
    // market; otherwise pick a top mover (matched to the query/topic if any).
    const query = input.marketQuery?.trim();
    let target: GroundingTarget | null = query
      ? resolveMarketTarget(
          await this.contentData.resolveMarket(query).catch(() => []),
        )
      : null;
    if (!target) {
      const candidates = await this.pickCandidateMarkets();
      target = candidates.length
        ? pickMoverForQuery(candidates, query ?? input.topic)
        : null;
    }
    if (!target) {
      return {
        outcome: {
          postType,
          marketName: '',
          status: 'error',
          reason: 'no market to ground on',
        },
        post: null,
      };
    }
    const preamble = this.brandKit.buildPromptPreamble(brand);
    const r = await this.generator.generatePost(
      brand,
      preamble,
      postType,
      target,
      {
        // video_script routes to the youtube video pipeline; keep its own platform.
        platform: input.type === 'video_script' ? undefined : input.platform,
        brief: input.type === 'from_topic' ? input.topic : undefined,
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
    if (spentUsd <= 0) return;
    try {
      await this.costCap.recordSpend([
        {
          provider: 'deepseek',
          amount_usd: spentUsd,
          units: spentTokens,
          unit_type: 'tokens_output',
        },
      ]);
    } catch (e) {
      this.logger.error(
        `feed recordSpend failed (spent ~$${spentUsd.toFixed(4)}): ${(e as Error).message}`,
      );
    }
  }

  /**
   * Candidate markets to ground posts in: score movers (up first for positive
   * stories, then down) over the feed window. Filtered to real qualified movers.
   */
  private async pickCandidateMarkets() {
    const movers = await this.contentData.getTopMovers(
      FEED_GEO,
      FEED_WINDOW,
      25,
    );
    return [...movers.up, ...movers.down];
  }
}
