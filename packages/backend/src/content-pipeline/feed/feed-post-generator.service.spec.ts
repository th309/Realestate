import { FeedPostGeneratorService } from './feed-post-generator.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import { ContentDataService } from '../data/content-data.service';
import { BrandVoiceLinterService } from '../gates/brand-voice-linter.service';
import { PostsService } from '../posts/posts.service';
import { PostImageRenderService } from '../post-images/post-image-render.service';
import { MetroPhotoService } from '../media/metro-photo.service';
import type { BrandProfile } from '../brand-kit/brand-kit.types';
import type { ScoreMoverItem } from '../data/score-mover-context.queries';

const BRAND = { id: 'brand-1', name: 'PropertyIQ' } as unknown as BrandProfile;
const MOVER: ScoreMoverItem = {
  id: 'metro-1',
  canonical_name: 'Austin',
  geography: 'metro',
  current_score: 72,
  previous_score: 60,
  delta: 12,
  population: 2_000_000,
};

type Overrides = {
  completionContent?: string;
  lintPassed?: boolean;
  renderThrows?: boolean;
  /** null = no confident photo for this metro; 'throw' = lookup blew up. */
  skyline?: string | null | 'throw';
};

function build(o: Overrides = {}) {
  const createPost = jest.fn(() => Promise.resolve({ id: 'post-1' }));
  const updateMediaRefs = jest.fn(() => Promise.resolve({ id: 'post-1' }));
  const renderForPost = jest.fn(() =>
    o.renderThrows
      ? Promise.reject(new Error('puppeteer boom'))
      : Promise.resolve([
          {
            kind: 'image',
            bucket: 'content-pipeline',
            storage_path: 'posts/post-1/0.png',
            width: 1080,
            height: 1350,
            order: 0,
          },
        ]),
  );

  const complete = jest.fn(() =>
    Promise.resolve({
      content:
        o.completionContent ??
        JSON.stringify({
          hook: 'PropertyIQ Score is rising in Austin.',
          body: 'The data shows momentum. See the full picture on the map.',
          cta: 'Check your market free at propertyiq.app. No credit card required.',
          hashtags: ['#realestate'],
        }),
      model: 'deepseek-v4-pro',
      provider: 'deepseek' as const,
      usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
      durationMs: 10,
    }),
  );
  const ai = { complete } as unknown as AiProviderService;
  const contentData = {
    getMarketSnapshot: jest.fn(() => Promise.resolve(null)),
  } as unknown as ContentDataService;
  const linter = {
    lint: jest.fn(() =>
      Promise.resolve({
        passed: o.lintPassed ?? true,
        violations: o.lintPassed === false ? [{ reason: 'unmatched' }] : [],
      }),
    ),
  } as unknown as BrandVoiceLinterService;
  const posts = { createPost, updateMediaRefs } as unknown as PostsService;
  const postImages = { renderForPost } as unknown as PostImageRenderService;
  const getSkylineDataUri = jest.fn(() => {
    if (o.skyline === 'throw') return Promise.reject(new Error('pexels down'));
    if (o.skyline == null) return Promise.resolve(null);
    return Promise.resolve({
      dataUri: o.skyline,
      provenance: {
        provider: 'pexels' as const,
        optionId: 'pexels-1',
        sourceUrl: 'https://pexels.com/p/1',
      },
    });
  });
  const metroPhotos = {
    getSkylineDataUri,
  } as unknown as MetroPhotoService;

  const service = new FeedPostGeneratorService(
    ai,
    contentData,
    linter,
    posts,
    postImages,
    metroPhotos,
  );
  return {
    service,
    createPost,
    updateMediaRefs,
    renderForPost,
    getSkylineDataUri,
    complete,
  };
}

describe('FeedPostGeneratorService.generatePost', () => {
  it('generates, passes Gate B, inserts, and renders images', async () => {
    const { service, createPost, updateMediaRefs, renderForPost } = build();
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    expect(r.outcome.status).toBe('inserted');
    expect(createPost).toHaveBeenCalledTimes(1);
    expect(renderForPost).toHaveBeenCalledTimes(1);
    expect(updateMediaRefs).toHaveBeenCalledTimes(1);
    expect(r.spentUsd).toBeGreaterThan(0);
  });

  it('leaves the draft alive when image rendering fails (best-effort)', async () => {
    const { service, createPost, updateMediaRefs } = build({
      renderThrows: true,
    });
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    // Post still created + outcome inserted; render failure swallowed.
    expect(r.outcome.status).toBe('inserted');
    expect(createPost).toHaveBeenCalledTimes(1);
    expect(updateMediaRefs).not.toHaveBeenCalled();
  });

  it('does not insert or render when Gate B fails', async () => {
    const { service, createPost, renderForPost } = build({ lintPassed: false });
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    expect(r.outcome.status).toBe('lint_failed');
    expect(createPost).not.toHaveBeenCalled();
    expect(renderForPost).not.toHaveBeenCalled();
  });

  it('surfaces an empty completion and still bills the spend', async () => {
    const { service, createPost } = build({ completionContent: '   ' });
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    expect(r.outcome.status).toBe('empty_completion');
    expect(createPost).not.toHaveBeenCalled();
    // Spend accrues before the emptiness assertion.
    expect(r.spentUsd).toBeGreaterThan(0);
  });

  it('rejects valid-but-blank JSON as empty_completion', async () => {
    const { service, createPost } = build({
      completionContent: '{"hook":"","body":"","cta":""}',
    });
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    expect(r.outcome.status).toBe('empty_completion');
    expect(createPost).not.toHaveBeenCalled();
  });
});

const SKYLINE = 'data:image/jpeg;base64,QUJD';

/** The grounding the renderer actually received. */
function renderedGrounding(renderForPost: jest.Mock) {
  return renderForPost.mock.calls[0][1] as { photoDataUri?: string };
}

describe('FeedPostGeneratorService skyline photos', () => {
  it('attaches the metro skyline so photo-hero variants become eligible', async () => {
    const { service, renderForPost, getSkylineDataUri } = build({
      skyline: SKYLINE,
    });
    await service.generatePost(BRAND, 'PREAMBLE', 'linkedin_post', MOVER);

    expect(getSkylineDataUri).toHaveBeenCalledWith('metro-1', 'Austin');
    expect(renderedGrounding(renderForPost).photoDataUri).toBe(SKYLINE);
  });

  it('renders without a photo when no confident match exists', async () => {
    const { service, renderForPost, updateMediaRefs } = build({
      skyline: null,
    });
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    // No media beats wrong media — the post still ships, typographic.
    expect(r.outcome.status).toBe('inserted');
    expect(renderedGrounding(renderForPost).photoDataUri).toBeUndefined();
    expect(updateMediaRefs).toHaveBeenCalledTimes(1);
  });

  it('survives a skyline lookup that throws', async () => {
    const { service, renderForPost, updateMediaRefs } = build({
      skyline: 'throw',
    });
    const r = await service.generatePost(
      BRAND,
      'PREAMBLE',
      'linkedin_post',
      MOVER,
    );
    expect(r.outcome.status).toBe('inserted');
    expect(renderedGrounding(renderForPost).photoDataUri).toBeUndefined();
    expect(updateMediaRefs).toHaveBeenCalledTimes(1);
  });

  it('never looks up a skyline for non-metro geographies', async () => {
    const { service, getSkylineDataUri } = build({ skyline: SKYLINE });
    await service.generatePost(BRAND, 'PREAMBLE', 'linkedin_post', {
      ...MOVER,
      geography: 'zip',
    });
    expect(getSkylineDataUri).not.toHaveBeenCalled();
  });

  it('keeps the photo out of the generation prompt', async () => {
    const { service, complete } = build({ skyline: SKYLINE });
    await service.generatePost(BRAND, 'PREAMBLE', 'linkedin_post', MOVER);
    // The prompt is built before the render path attaches the photo. A data URI
    // reaching the model would be a large, pointless token bill.
    const sentToModel = JSON.stringify(complete.mock.calls);
    expect(sentToModel).not.toContain('base64');
    expect(sentToModel).not.toContain(SKYLINE);
  });
});
