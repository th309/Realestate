// packages/backend/src/content-pipeline/feed/__tests__/feed-generation-test-helpers.ts
//
// Shared mock-dependency builder for FeedService and FeedTopUpService specs —
// both classes take the exact same 7-argument constructor, so this returns the
// mocks in that order plus the spies each spec asserts on. Kept separate from
// production code (feed-generation-shared.ts) since these are test doubles.

import { BrandKitService } from '../../brand-kit/brand-kit.service';
import { PostsService } from '../../posts/posts.service';
import { ContentDataService } from '../../data/content-data.service';
import { CostCapService } from '../../auto-ideation/cost-cap.service';
import { PipelineSettingsService } from '../../pipeline-settings.service';
import { FeedPostGeneratorService } from '../feed-post-generator.service';
import { StylePreferenceService } from '../../style-preferences/style-preference.service';
import type { FeedGenerationOutcome } from '../feed.types';

export type FeedTestOverrides = {
  paused?: boolean;
  pendingCount?: number;
  /** Total posts ever created for the brand (backs the rotation cursor). */
  totalCount?: number;
  budgetAllowed?: boolean;
  candidates?: number;
  /** Outcome status the mocked generator returns for each attempt. */
  genStatus?: FeedGenerationOutcome['status'];
};

export function mover(n: number) {
  return {
    id: `metro-${n}`,
    canonical_name: `Metro ${n}`,
    geography: 'metro' as const,
    current_score: 70 + n,
    previous_score: 60 + n,
    delta: 10,
    population: 1_000_000,
  };
}

/** Constructor-order deps for `new FeedService(...)` / `new FeedTopUpService(...)`, plus spies. */
export function buildFeedDeps(o: FeedTestOverrides = {}) {
  const recordSpend = jest.fn(() => Promise.resolve(undefined));
  const nCandidates = o.candidates ?? 2;
  const status = o.genStatus ?? 'inserted';

  // The generator is mocked: the service under test only orchestrates it. Each
  // call bills a little and returns the requested outcome (inserted by default).
  const generatePost = jest.fn(
    (
      _brand: unknown,
      _preamble: string,
      postType: FeedGenerationOutcome['postType'],
      mv: { canonical_name: string },
    ) =>
      Promise.resolve({
        outcome: {
          postType,
          marketName: mv.canonical_name,
          status,
          postId: status === 'inserted' ? 'post-new' : undefined,
        },
        post: status === 'inserted' ? { id: 'post-new' } : null,
        spentUsd: 0.005,
        spentTokens: 800,
      }),
  );

  const pending = Array.from({ length: o.pendingCount ?? 0 }, (_, i) => ({
    id: `p-${i}`,
  }));

  const brandKit = {
    getBrandProfile: jest.fn(() =>
      Promise.resolve({ id: 'brand-1', name: 'PropertyIQ' }),
    ),
    buildPromptPreamble: jest.fn(() => 'PREAMBLE'),
  } as unknown as BrandKitService;
  const posts = {
    listPosts: jest.fn(() => Promise.resolve(pending)),
    countAll: jest.fn(() =>
      Promise.resolve(o.totalCount ?? o.pendingCount ?? 0),
    ),
    // generateOnDemand re-reads the row to attach signed media URLs.
    withSignedMedia: jest.fn((p: unknown) =>
      Promise.resolve({ ...(p as object), mediaUrls: [] }),
    ),
  } as unknown as PostsService;
  const contentData = {
    getTopMovers: jest.fn(() =>
      Promise.resolve({
        window: {
          latestDate: '2026-07-01',
          priorDate: '2026-04-01',
          windowDays: 90,
          requestedGeo: 'metro',
        },
        qualifiedCount: nCandidates,
        up: Array.from({ length: nCandidates }, (_, i) => mover(i + 1)),
        down: [],
      }),
    ),
  } as unknown as ContentDataService;
  const costCap = {
    canEnqueue: jest.fn(() =>
      Promise.resolve({
        allowed: o.budgetAllowed ?? true,
        remainingUsd: 50,
        usdSpent: 0,
        usdCap: 50,
      }),
    ),
    recordSpend,
  } as unknown as CostCapService;
  const settings = {
    isPaused: jest.fn(() => o.paused ?? false),
  } as unknown as PipelineSettingsService;
  const generator = { generatePost } as unknown as FeedPostGeneratorService;
  // Phase 8: the system prompt comes from the style-preference service (brand
  // preamble + the brand's liked style references).
  const buildGenerationPreamble = jest.fn(() =>
    Promise.resolve('PREAMBLE\n\nSAVED STYLE PREFERENCES (…)'),
  );
  const stylePreferences = {
    buildGenerationPreamble,
  } as unknown as StylePreferenceService;

  return {
    args: [
      brandKit,
      posts,
      contentData,
      costCap,
      settings,
      generator,
      stylePreferences,
    ] as const,
    generatePost,
    recordSpend,
    buildGenerationPreamble,
  };
}
