// packages/backend/src/content-pipeline/feed/feed.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { BrandVoiceLinterService } from '../gates/brand-voice-linter.service';
import { PipelineSettingsService } from '../pipeline-settings.service';
import type {
  ScoreMoverGeo,
  ScoreMoverWindowDays,
} from '../data/score-mover-config';
import type { PostCopy } from '../posts/post.types';
import {
  FEED_POST_TYPES,
  FEED_POST_TYPE_PLATFORM,
  FeedGenerationOutcome,
} from './feed.types';
import { buildFeedUserPrompt } from './feed-prompts';
import {
  buildGrounding,
  flattenCopyForLint,
  usdFromUsage,
} from './feed-helpers';
import {
  assertNonEmptyCompletion,
  EmptyCompletionError,
  parseJsonObject,
} from './generation-guards';

const DEFAULT_TARGET_DRAFTS = 6;
const MAX_PER_CYCLE = 10;
/** Conservative per-post spend estimate for the pre-cycle budget check (DeepSeek). */
const EST_USD_PER_POST = 0.02;
const POST_MAX_TOKENS = 1200;
const FEED_GEO: ScoreMoverGeo = 'metro';
const FEED_WINDOW: ScoreMoverWindowDays = 90;

/**
 * Keeps N draft posts (status pending_review) queued for the feed UI. Each cycle:
 * counts pending posts, picks a mix of post types, grounds each in real score-mover
 * + snapshot data, generates copy via the DeepSeek `post_generation` purpose, runs
 * it through Gate B (brand-voice linter), then inserts a `posts` row. Respects the
 * pipeline pause flag and the CONTENT_PIPELINE_DAILY_USD_MAX budget (CostCapService).
 */
@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly ai: AiProviderService,
    private readonly brandKit: BrandKitService,
    private readonly posts: PostsService,
    private readonly contentData: ContentDataService,
    private readonly costCap: CostCapService,
    private readonly linter: BrandVoiceLinterService,
    private readonly settings: PipelineSettingsService,
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

    for (let i = 0; i < need; i++) {
      const postType = FEED_POST_TYPES[i % FEED_POST_TYPES.length];
      const mover = candidates[i % candidates.length];
      try {
        const snapshot = await this.contentData
          .getMarketSnapshot({
            geography: mover.geography,
            id: mover.id,
            canonical_name: mover.canonical_name,
          })
          .catch(() => null);
        const grounding = buildGrounding(mover, snapshot);
        const userPrompt = buildFeedUserPrompt(postType, grounding);

        const resp = await this.ai.complete('post_generation', {
          systemPrompt: preamble,
          userPrompt,
          maxTokens: POST_MAX_TOKENS,
          temperature: 0.8,
          responseFormat: 'json',
        });
        assertNonEmptyCompletion(
          resp.content,
          `${postType}/${mover.canonical_name}`,
        );
        spentUsd += usdFromUsage(resp.model, resp.usage);
        spentTokens += resp.usage?.totalTokens ?? 0;

        const copy = parseJsonObject<PostCopy>(
          resp.content,
          `${postType}/${mover.canonical_name}`,
        );

        const lint = await this.linter.lint(flattenCopyForLint(copy));
        if (!lint.passed) {
          outcomes.push({
            postType,
            marketName: mover.canonical_name,
            status: 'lint_failed',
            reason: `${lint.violations.length} violation(s)`,
          });
          continue;
        }

        const post = await this.posts.createPost({
          brandId: brand.id,
          platform: FEED_POST_TYPE_PLATFORM[postType],
          postType,
          copy,
          status: 'pending_review',
          source: 'ai_generated',
        });
        outcomes.push({
          postType,
          marketName: mover.canonical_name,
          status: 'inserted',
          postId: post.id,
        });
      } catch (err) {
        const empty = err instanceof EmptyCompletionError;
        this.logger.error(
          `feed generation failed (${postType}/${mover.canonical_name}): ${(err as Error).message}`,
        );
        outcomes.push({
          postType,
          marketName: mover.canonical_name,
          status: empty ? 'empty_completion' : 'error',
          reason: (err as Error).message,
        });
      }
    }

    if (spentUsd > 0) {
      await this.costCap.recordSpend([
        {
          provider: 'deepseek',
          amount_usd: spentUsd,
          units: spentTokens,
          unit_type: 'tokens_output',
        },
      ]);
    }

    const inserted = outcomes.filter((o) => o.status === 'inserted').length;
    this.logger.log(
      `feed top-up: inserted ${inserted}/${need} (spent ~$${spentUsd.toFixed(4)})`,
    );
    return outcomes;
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
