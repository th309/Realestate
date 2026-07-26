import { PostImageRenderService } from '../post-image-render.service';
import { PostImageRenderer } from '../post-image-renderer.interface';
import type { PostRow } from '../../posts/post.types';

function makePost(overrides: Partial<PostRow>): PostRow {
  return {
    id: 'post-xyz',
    brand_id: 'brand-1',
    platform: 'linkedin',
    post_type: 'linkedin_post',
    copy: { hook: 'Seattle cooled fast' },
    media_refs: [],
    status: 'pending_review',
    scheduled_at: null,
    published_at: null,
    platform_post_id: null,
    source: 'ai_generated',
    error: null,
    attempts: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as PostRow;
}

describe('PostImageRenderService', () => {
  let uploads: Array<{ path: string; opts: unknown }>;
  let uploadError: { message: string } | null;
  let renderer: jest.Mocked<PostImageRenderer>;
  let supabase: { getClient: () => unknown };

  function makeService(): PostImageRenderService {
    return new PostImageRenderService(supabase as never, renderer);
  }

  beforeEach(() => {
    uploads = [];
    uploadError = null;
    renderer = {
      renderPng: jest.fn().mockResolvedValue(Buffer.from('png')),
      renderFitted: jest.fn().mockResolvedValue(Buffer.from('png-bytes')),
    };
    supabase = {
      getClient: () => ({
        storage: {
          from: () => ({
            upload: (path: string, _buf: Buffer, opts: unknown) => {
              uploads.push({ path, opts });
              return Promise.resolve({ error: uploadError });
            },
          }),
        },
      }),
    };
  });

  it('uploads one PNG and returns a storage_path media_ref for a single post', async () => {
    const refs = await makeService().renderForPost(
      makePost({ id: 'abc', post_type: 'linkedin_post' }),
      { marketName: 'Seattle', state: 'WA', score: 16, scoreLabel: 'weak' },
    );
    expect(refs).toEqual([
      {
        kind: 'image',
        bucket: 'content-pipeline',
        storage_path: 'posts/abc/0.png',
        width: 1080,
        height: 1350,
        order: 0,
      },
    ]);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].path).toBe('posts/abc/0.png');
    expect(uploads[0].opts).toMatchObject({
      contentType: 'image/png',
      upsert: true,
    });
  });

  it('uploads one PNG per carousel slide (cover + slides + closer)', async () => {
    const refs = await makeService().renderForPost(
      makePost({
        id: 'car',
        post_type: 'carousel_copy',
        copy: {
          hook: 'Three cooling markets',
          slides: [{ heading: 'Denver', body: 'Down 12' }],
        },
      }),
      null,
    );
    // cover + 1 slide + closer = 3 images
    expect(refs).toHaveLength(3);
    expect(refs.map((r) => r.storage_path)).toEqual([
      'posts/car/0.png',
      'posts/car/1.png',
      'posts/car/2.png',
    ]);
    expect(refs.map((r) => r.order)).toEqual([0, 1, 2]);
  });

  it('renders nothing for a video_script (no upload)', async () => {
    const refs = await makeService().renderForPost(
      makePost({
        post_type: 'video_script',
        copy: { title: 't', hook: 'h', body: 'b' },
      }),
      { marketName: 'Austin', score: 70 },
    );
    expect(refs).toEqual([]);
    expect(uploads).toHaveLength(0);
    expect(renderer.renderFitted).not.toHaveBeenCalled();
  });

  it('throws on upload failure so the feed can treat it as best-effort', async () => {
    uploadError = { message: 'storage down' };
    await expect(
      makeService().renderForPost(makePost({ id: 'e' }), null),
    ).rejects.toMatchObject({ message: 'storage down' });
  });
});
