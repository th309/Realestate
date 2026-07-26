import { FeedService } from './feed.service';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { PipelineSettingsService } from '../pipeline-settings.service';
import { FeedPostGeneratorService } from './feed-post-generator.service';
import type { FeedGenerationOutcome } from './feed.types';

type Overrides = {
  paused?: boolean;
  pendingCount?: number;
  budgetAllowed?: boolean;
  candidates?: number;
  /** Outcome status the mocked generator returns for each attempt. */
  genStatus?: FeedGenerationOutcome['status'];
};

function mover(n: number) {
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

function build(o: Overrides = {}) {
  const recordSpend = jest.fn(() => Promise.resolve(undefined));
  const nCandidates = o.candidates ?? 2;
  const status = o.genStatus ?? 'inserted';

  // The generator is mocked: FeedService only orchestrates it. Each call bills a
  // little and returns the requested outcome (inserted by default).
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

  const service = new FeedService(
    brandKit,
    posts,
    contentData,
    costCap,
    settings,
    generator,
  );
  return { service, generatePost, recordSpend };
}

describe('FeedService.topUp orchestration', () => {
  const OLD = process.env.CONTENT_FEED_TARGET_DRAFTS;
  beforeEach(() => {
    process.env.CONTENT_FEED_TARGET_DRAFTS = '2';
  });
  afterAll(() => {
    if (OLD === undefined) delete process.env.CONTENT_FEED_TARGET_DRAFTS;
    else process.env.CONTENT_FEED_TARGET_DRAFTS = OLD;
  });

  it('delegates one generation per needed draft and records spend once', async () => {
    const { service, generatePost, recordSpend } = build({ pendingCount: 0 });
    const outcomes = await service.topUp();
    expect(generatePost).toHaveBeenCalledTimes(2);
    expect(outcomes.filter((o) => o.status === 'inserted')).toHaveLength(2);
    expect(recordSpend).toHaveBeenCalledTimes(1);
  });

  it('no-ops when already at target', async () => {
    const { service, generatePost } = build({ pendingCount: 2 });
    const outcomes = await service.topUp();
    expect(outcomes).toHaveLength(0);
    expect(generatePost).not.toHaveBeenCalled();
  });

  it('skips when the pipeline is paused', async () => {
    const { service, generatePost } = build({ paused: true, pendingCount: 0 });
    const outcomes = await service.topUp();
    expect(outcomes).toHaveLength(0);
    expect(generatePost).not.toHaveBeenCalled();
  });

  it('skips when the daily budget is exhausted', async () => {
    const { service, generatePost } = build({
      pendingCount: 0,
      budgetAllowed: false,
    });
    const outcomes = await service.topUp();
    expect(generatePost).not.toHaveBeenCalled();
    expect(outcomes[0].status).toBe('skipped_budget');
  });
});

describe('FeedService.generateOnePost', () => {
  const OLD = process.env.CONTENT_FEED_TARGET_DRAFTS;
  afterAll(() => {
    if (OLD === undefined) delete process.env.CONTENT_FEED_TARGET_DRAFTS;
    else process.env.CONTENT_FEED_TARGET_DRAFTS = OLD;
  });

  it('generates one post and records spend', async () => {
    const { service, generatePost, recordSpend } = build({});
    const { outcome, post } = await service.generateOnePost({
      postType: 'facebook_post',
    });
    expect(generatePost).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe('inserted');
    expect(post).toEqual({ id: 'post-new' });
    expect(recordSpend).toHaveBeenCalledTimes(1);
  });

  it('skips (no generation) when paused', async () => {
    const { service, generatePost } = build({ paused: true });
    const { outcome } = await service.generateOnePost({});
    expect(generatePost).not.toHaveBeenCalled();
    expect(outcome.status).toBe('skipped_budget');
    expect(outcome.reason).toMatch(/paused/);
  });

  it('skips when the budget is exhausted', async () => {
    const { service, generatePost } = build({ budgetAllowed: false });
    const { outcome } = await service.generateOnePost({});
    expect(generatePost).not.toHaveBeenCalled();
    expect(outcome.status).toBe('skipped_budget');
  });
});
