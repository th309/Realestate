// packages/backend/src/content-pipeline/feed/feed-topup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { PipelineSettingsService } from '../pipeline-settings.service';
import { FeedPostGeneratorService } from './feed-post-generator.service';
import { StylePreferenceService } from '../style-preferences/style-preference.service';
import {
  pickCandidateMarkets,
  recordFeedSpend,
} from './feed-generation-shared';
import { FEED_POST_TYPES, FeedGenerationOutcome } from './feed.types';

const DEFAULT_TARGET_DRAFTS = 6;
const MAX_PER_CYCLE = 10;
/** Conservative per-post spend estimate for the budget guards (DeepSeek). */
const EST_USD_PER_POST = 0.02;

/**
 * The cron half of the content feed: keeps N pending_review drafts queued.
 * Split out of FeedService (which keeps the on-demand /generate paths) to stay
 * under the file-size limit — see feed.service.ts for the on-demand paths and
 * feed-generation-shared.ts for the logic both share.
 *
 * Every generation takes its system prompt from
 * StylePreferenceService.buildGenerationPreamble, which is the brand voice plus
 * the brand's liked style references (Phase 8 preference learning).
 */
@Injectable()
export class FeedTopUpService {
  private readonly logger = new Logger(FeedTopUpService.name);

  constructor(
    private readonly brandKit: BrandKitService,
    private readonly posts: PostsService,
    private readonly contentData: ContentDataService,
    private readonly costCap: CostCapService,
    private readonly settings: PipelineSettingsService,
    private readonly generator: FeedPostGeneratorService,
    private readonly stylePreferences: StylePreferenceService,
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
    // Cursor for varying post-type/market picks across separate topUp() calls
    // (see the loop below). Deliberately NOT pending.length: queue depth can
    // return to the same value on every cron tick under a steady review
    // cadence, which would re-freeze the "always picks index 0" bug in a new
    // shape. Total-ever-created only ever grows, so the offset always advances.
    const rotationCursor = await this.posts.countAll(brand.id);
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

    const candidates = await pickCandidateMarkets(this.contentData);
    if (candidates.length === 0) {
      this.logger.warn('feed top-up: no candidate markets available');
      return [];
    }

    const preamble = await this.stylePreferences.buildGenerationPreamble(brand);
    const outcomes: FeedGenerationOutcome[] = [];
    let spentUsd = 0;
    let spentTokens = 0;

    try {
      for (let i = 0; i < need; i++) {
        // Offset by rotationCursor, not just `i`: `i` alone resets to 0 on
        // every cron tick, and a typical top-up only needs 1-2 posts, so it
        // would almost always land on index 0 and starve the later entries
        // (observed live: 7 linkedin_post / 2 facebook_post / 1 carousel_copy
        // / 0 video_script out of the first 10 posts ever generated). Same
        // fix applied to candidate-market selection: getTopMovers() only
        // changes on the monthly rescore, so `i % candidates.length` alone
        // would draft the same top mover on every tick for weeks.
        const postType =
          FEED_POST_TYPES[(rotationCursor + i) % FEED_POST_TYPES.length];
        const mover = candidates[(rotationCursor + i) % candidates.length];

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
          { movers: candidates },
        );
        spentUsd += r.spentUsd;
        spentTokens += r.spentTokens;
        outcomes.push(r.outcome);
      }
    } finally {
      await recordFeedSpend(this.costCap, this.logger, spentUsd, spentTokens);
    }

    const inserted = outcomes.filter((o) => o.status === 'inserted').length;
    this.logger.log(
      `feed top-up: inserted ${inserted}/${need} (spent ~$${spentUsd.toFixed(4)})`,
    );
    return outcomes;
  }
}
