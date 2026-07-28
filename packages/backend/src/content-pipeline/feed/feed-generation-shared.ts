// packages/backend/src/content-pipeline/feed/feed-generation-shared.ts
//
// Small orchestration helpers shared by FeedService (on-demand generation) and
// FeedTopUpService (the cron top-up loop) — split out so neither file has to
// duplicate them and both stay under the file-size limit. Unlike feed-helpers.ts
// these take a live NestJS dependency, so they are not pure functions.

import { Logger } from '@nestjs/common';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import type {
  ScoreMoverGeo,
  ScoreMoverWindowDays,
} from '../data/score-mover-config';

const FEED_GEO: ScoreMoverGeo = 'metro';
const FEED_WINDOW: ScoreMoverWindowDays = 90;

/**
 * Candidate markets to ground posts in: score movers (up first for positive
 * stories, then down) over the feed window. Filtered to real qualified movers.
 */
export async function pickCandidateMarkets(contentData: ContentDataService) {
  const movers = await contentData.getTopMovers(FEED_GEO, FEED_WINDOW, 25);
  return [...movers.up, ...movers.down];
}

/** Record accumulated DeepSeek spend against the daily cap (best-effort). */
export async function recordFeedSpend(
  costCap: CostCapService,
  logger: Logger,
  spentUsd: number,
  spentTokens: number,
): Promise<void> {
  if (spentUsd <= 0) return;
  try {
    await costCap.recordSpend([
      {
        provider: 'deepseek',
        amount_usd: spentUsd,
        units: spentTokens,
        unit_type: 'tokens_output',
      },
    ]);
  } catch (e) {
    logger.error(
      `feed recordSpend failed (spent ~$${spentUsd.toFixed(4)}): ${(e as Error).message}`,
    );
  }
}
