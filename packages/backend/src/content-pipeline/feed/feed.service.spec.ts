import { FeedService } from './feed.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { BrandVoiceLinterService } from '../gates/brand-voice-linter.service';
import { PipelineSettingsService } from '../pipeline-settings.service';

type Overrides = {
  paused?: boolean;
  pendingCount?: number;
  budgetAllowed?: boolean;
  completionContent?: string;
  lintPassed?: boolean;
  candidates?: number;
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
  const createPost = jest.fn(async () => ({ id: 'post-new' }));
  const recordSpend = jest.fn(async () => undefined);
  const complete = jest.fn(async () => ({
    content:
      o.completionContent ??
      JSON.stringify({
        hook: 'PropertyIQ Score is rising in this metro.',
        body: 'The data shows momentum. See the full picture on the map.',
        cta: 'Check your market free at propertyiq.app. No credit card required.',
        hashtags: ['#realestate'],
      }),
    model: 'deepseek-v4-pro',
    provider: 'deepseek' as const,
    usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
    durationMs: 10,
  }));

  const pending = Array.from({ length: o.pendingCount ?? 0 }, (_, i) => ({
    id: `p-${i}`,
  }));
  const nCandidates = o.candidates ?? 2;

  const ai = { complete } as unknown as AiProviderService;
  const brandKit = {
    getBrandProfile: jest.fn(async () => ({
      id: 'brand-1',
      name: 'PropertyIQ',
    })),
    buildPromptPreamble: jest.fn(() => 'PREAMBLE'),
  } as unknown as BrandKitService;
  const posts = {
    listPosts: jest.fn(async () => pending),
    createPost,
  } as unknown as PostsService;
  const contentData = {
    getTopMovers: jest.fn(async () => ({
      window: {
        latestDate: '2026-07-01',
        priorDate: '2026-04-01',
        windowDays: 90,
        requestedGeo: 'metro',
      },
      qualifiedCount: nCandidates,
      up: Array.from({ length: nCandidates }, (_, i) => mover(i + 1)),
      down: [],
    })),
    getMarketSnapshot: jest.fn(async () => ({
      geo: { geography: 'metro', id: 'metro-1', canonical_name: 'Metro 1' },
      home_value: { value: 450000, yoy_pct: 5.2, period_date: '2026-07-01' },
      rent: { value: 2100, yoy_pct: 3.1, period_date: '2026-07-01' },
      demographics: null,
      economic: null,
      score: { propertyiq_score: 72, grade: 'B', confidence: 'B' },
    })),
  } as unknown as ContentDataService;
  const costCap = {
    canEnqueue: jest.fn(async () => ({
      allowed: o.budgetAllowed ?? true,
      remainingUsd: 50,
      usdSpent: 0,
      usdCap: 50,
    })),
    recordSpend,
  } as unknown as CostCapService;
  const linter = {
    lint: jest.fn(async () => ({
      passed: o.lintPassed ?? true,
      violations: o.lintPassed === false ? [{ reason: 'unmatched' }] : [],
    })),
  } as unknown as BrandVoiceLinterService;
  const settings = {
    isPaused: jest.fn(() => o.paused ?? false),
  } as unknown as PipelineSettingsService;

  const service = new FeedService(
    ai,
    brandKit,
    posts,
    contentData,
    costCap,
    linter,
    settings,
  );
  return { service, createPost, complete, recordSpend, linter };
}

describe('FeedService.topUp draft-topping logic', () => {
  const OLD_ENV = process.env.CONTENT_FEED_TARGET_DRAFTS;
  beforeEach(() => {
    process.env.CONTENT_FEED_TARGET_DRAFTS = '2';
  });
  afterAll(() => {
    if (OLD_ENV === undefined) delete process.env.CONTENT_FEED_TARGET_DRAFTS;
    else process.env.CONTENT_FEED_TARGET_DRAFTS = OLD_ENV;
  });

  it('generates posts until the target is reached', async () => {
    const { service, createPost, recordSpend } = build({ pendingCount: 0 });
    const outcomes = await service.topUp();
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(outcomes.filter((o) => o.status === 'inserted')).toHaveLength(2);
    expect(recordSpend).toHaveBeenCalledTimes(1);
  });

  it('no-ops when already at target', async () => {
    const { service, createPost, complete } = build({ pendingCount: 2 });
    const outcomes = await service.topUp();
    expect(outcomes).toHaveLength(0);
    expect(complete).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('skips when the pipeline is paused', async () => {
    const { service, complete } = build({ paused: true, pendingCount: 0 });
    const outcomes = await service.topUp();
    expect(outcomes).toHaveLength(0);
    expect(complete).not.toHaveBeenCalled();
  });

  it('skips when the daily budget is exhausted', async () => {
    const { service, complete } = build({
      pendingCount: 0,
      budgetAllowed: false,
    });
    const outcomes = await service.topUp();
    expect(complete).not.toHaveBeenCalled();
    expect(outcomes[0].status).toBe('skipped_budget');
  });

  it('does not insert copy that fails Gate B', async () => {
    const { service, createPost } = build({
      pendingCount: 0,
      lintPassed: false,
    });
    const outcomes = await service.topUp();
    expect(createPost).not.toHaveBeenCalled();
    expect(outcomes.every((o) => o.status === 'lint_failed')).toBe(true);
  });

  it('surfaces an empty completion as empty_completion without inserting', async () => {
    const { service, createPost } = build({
      pendingCount: 0,
      completionContent: '   ',
    });
    const outcomes = await service.topUp();
    expect(createPost).not.toHaveBeenCalled();
    expect(outcomes.every((o) => o.status === 'empty_completion')).toBe(true);
  });

  it('rejects valid-but-blank JSON as empty_completion (blank-fields guard)', async () => {
    const { service, createPost } = build({
      pendingCount: 0,
      completionContent: '{"hook":"","body":"","cta":"","hashtags":[]}',
    });
    const outcomes = await service.topUp();
    expect(createPost).not.toHaveBeenCalled();
    expect(outcomes.every((o) => o.status === 'empty_completion')).toBe(true);
  });

  it('still records spend when a generation fails (reasoning tokens bill regardless)', async () => {
    const { service, recordSpend } = build({
      pendingCount: 0,
      completionContent: '   ',
    });
    await service.topUp();
    // Spend is accumulated before the emptiness assertion, so a failed cycle
    // still records what DeepSeek billed.
    expect(recordSpend).toHaveBeenCalledTimes(1);
  });
});
