import { FeedService } from './feed.service';
import { BrandKitService } from '../brand-kit/brand-kit.service';
import { PostsService } from '../posts/posts.service';
import { ContentDataService } from '../data/content-data.service';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { PipelineSettingsService } from '../pipeline-settings.service';
import { FeedPostGeneratorService } from './feed-post-generator.service';
import { StylePreferenceService } from '../style-preferences/style-preference.service';
import {
  makeBrandKitStub,
  makeSupabaseFake,
  styleRef,
} from '../style-preferences/__tests__/style-preference-test-helpers';
import { buildFeedDeps, mover } from './__tests__/feed-generation-test-helpers';
import type { FeedTestOverrides } from './__tests__/feed-generation-test-helpers';

function build(o: FeedTestOverrides = {}) {
  const deps = buildFeedDeps(o);
  const service = new FeedService(...deps.args);
  return { service, ...deps };
}

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

describe('FeedService feeds the preference-learned preamble to the generator', () => {
  it('passes the brand preamble plus the saved-style block on every path', async () => {
    const { service, generatePost, buildGenerationPreamble } = build({});
    await service.generateOnePost({ postType: 'facebook_post' });
    await service.generateOnDemand({ type: 'image_post' });

    expect(buildGenerationPreamble).toHaveBeenCalledTimes(2);
    expect(buildGenerationPreamble).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'brand-1' }),
    );
    for (const call of generatePost.mock.calls) {
      expect(call[1]).toContain('SAVED STYLE PREFERENCES');
    }
  });
});

describe('a liked style reference changes the system prompt FeedService sends', () => {
  /**
   * End-to-end through the REAL StylePreferenceService (only Supabase is faked),
   * so this proves the preference loop actually reaches the model rather than
   * just proving FeedService calls a mock.
   */
  function buildWithRealPreferences() {
    const { supabase } = makeSupabaseFake({
      styleReferences: [
        styleRef('ref-a', 'Bold metro poster', {
          palette: ['#0B1E3F'],
          summary: 'High contrast poster with an oversized numeral.',
        }),
      ],
    });
    const brandKit = makeBrandKitStub('brand-1');
    const stylePreferences = new StylePreferenceService(supabase, brandKit);

    // Params are declared so `generatePost.mock.calls[n][1]` is typed as the
    // preamble string under plain `tsc --noEmit` (which does check specs).
    const generatePost = jest.fn(
      (_brand: unknown, _preamble: string, ..._rest: unknown[]) =>
        Promise.resolve({
          outcome: {
            postType: 'linkedin_post',
            marketName: 'Metro 1',
            status: 'inserted',
          },
          post: { id: 'post-new' },
          spentUsd: 0,
          spentTokens: 0,
        }),
    );
    const service = new FeedService(
      brandKit,
      {
        listPosts: jest.fn(() => Promise.resolve([])),
      } as unknown as PostsService,
      {
        getTopMovers: jest.fn(() =>
          Promise.resolve({ up: [mover(1)], down: [], qualifiedCount: 1 }),
        ),
      } as unknown as ContentDataService,
      {
        canEnqueue: jest.fn(() =>
          Promise.resolve({
            allowed: true,
            remainingUsd: 50,
            usdSpent: 0,
            usdCap: 50,
          }),
        ),
        recordSpend: jest.fn(() => Promise.resolve(undefined)),
      } as unknown as CostCapService,
      { isPaused: jest.fn(() => false) } as unknown as PipelineSettingsService,
      { generatePost } as unknown as FeedPostGeneratorService,
      stylePreferences,
    );
    return { service, generatePost, stylePreferences };
  }

  it('sends the brand preamble alone before anything is liked', async () => {
    const { service, generatePost } = buildWithRealPreferences();
    await service.generateOnePost({ postType: 'linkedin_post' });
    expect(generatePost.mock.calls[0][1]).toBe('BRAND PREAMBLE');
  });

  it('adds the liked style to the prompt, keeping the brand rules', async () => {
    const { service, generatePost, stylePreferences } =
      buildWithRealPreferences();

    await service.generateOnePost({ postType: 'linkedin_post' });
    const before = generatePost.mock.calls[0][1];

    await stylePreferences.saveStyleRef('ref-a');
    await service.generateOnePost({ postType: 'linkedin_post' });
    const after = generatePost.mock.calls[1][1];

    expect(after).not.toBe(before);
    expect(after.startsWith('BRAND PREAMBLE')).toBe(true);
    expect(after).toContain('SAVED STYLE PREFERENCES');
    expect(after).toContain('Bold metro poster');
    expect(after).toContain('High contrast poster with an oversized numeral.');
  });

  it('drops the style back out of the prompt when the like is removed', async () => {
    const { service, generatePost, stylePreferences } =
      buildWithRealPreferences();
    await stylePreferences.saveStyleRef('ref-a');
    await service.generateOnePost({ postType: 'linkedin_post' });
    expect(generatePost.mock.calls[0][1]).toContain('SAVED STYLE PREFERENCES');

    await stylePreferences.unsaveStyleRef('ref-a');
    await service.generateOnePost({ postType: 'linkedin_post' });
    expect(generatePost.mock.calls[1][1]).toBe('BRAND PREAMBLE');
  });

  it('mutes the style block at signal weight 0 without unsaving it', async () => {
    const { service, generatePost, stylePreferences } =
      buildWithRealPreferences();
    await stylePreferences.saveStyleRef('ref-a');
    await stylePreferences.setSignalWeight(0);
    await service.generateOnePost({ postType: 'linkedin_post' });

    expect(generatePost.mock.calls[0][1]).toBe('BRAND PREAMBLE');
    expect(
      (await stylePreferences.getPreferences()).savedStyleRefs,
    ).toHaveLength(1);
  });
});
