import { ContentPipelineQueriesService } from './content-pipeline-queries.service';
import type { PostRow } from './posts/post.types';

/** Minimal chainable Supabase stub for the content_runs query in getReviewQueue. */
function fakeSupabase(runs: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = () => builder;
  builder.limit = () => Promise.resolve({ data: runs });
  return { getClient: () => ({ from: () => builder }) };
}

function post(
  id: string,
  createdAt: string,
  postType = 'linkedin_post',
): PostRow {
  return {
    id,
    brand_id: 'b1',
    platform: 'linkedin',
    post_type: postType,
    copy: { hook: `hook ${id}` },
    media_refs: [],
    status: 'pending_review',
    scheduled_at: null,
    published_at: null,
    platform_post_id: null,
    source: 'ai_generated',
    error: null,
    attempts: 0,
    created_at: createdAt,
    updated_at: createdAt,
  } as PostRow;
}

function makeService(runs: unknown[], posts: PostRow[]) {
  const postsService = {
    listPosts: jest.fn().mockResolvedValue(posts),
    withSignedMedia: jest
      .fn()
      .mockImplementation((p: PostRow) =>
        Promise.resolve({ ...p, mediaUrls: [`https://signed/${p.id}.png`] }),
      ),
  };
  const service = new ContentPipelineQueriesService(
    fakeSupabase(runs) as never,
    {} as never,
    {} as never,
    postsService as never,
  );
  return { service, postsService };
}

describe('ContentPipelineQueriesService.getReviewQueue', () => {
  it('returns pending_review POSTS even when there are no runs (the bug)', async () => {
    const { service } = makeService(
      [],
      [post('p1', '2026-07-25T23:30:00Z'), post('p2', '2026-07-25T23:31:00Z')],
    );
    const { items } = await service.getReviewQueue();
    expect(items).toHaveLength(2); // NOT [] — posts flow regardless of runs
    expect(items.every((i) => (i as { kind: string }).kind === 'post')).toBe(
      true,
    );
    expect((items[0] as { mediaUrls: string[] }).mediaUrls).toEqual([
      'https://signed/p1.png',
    ]);
    expect(items[0]).toMatchObject({
      kind: 'post',
      id: 'p1',
      post_type: 'linkedin_post',
      platform: 'linkedin',
      status: 'pending_review',
    });
  });

  it('merges runs (kind:run) and posts (kind:post), sorted created_at ascending', async () => {
    const runs = [
      {
        id: 'r1',
        status: 'ready_for_review',
        created_at: '2026-07-25T23:30:30Z',
      },
    ];
    const { service } = makeService(runs, [
      post('p1', '2026-07-25T23:30:00Z'),
      post('p2', '2026-07-25T23:31:00Z'),
    ]);
    const { items } = await service.getReviewQueue();
    expect(items.map((i) => (i as { kind: string }).kind)).toEqual([
      'post', // 23:30:00
      'run', // 23:30:30
      'post', // 23:31:00
    ]);
    const run = items.find((i) => (i as { kind: string }).kind === 'run');
    expect(run).toMatchObject({ id: 'r1', kind: 'run' });
  });
});
