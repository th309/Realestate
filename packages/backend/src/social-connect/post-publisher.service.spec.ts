import { NotFoundException } from '@nestjs/common';
import { PostPublisherService } from './post-publisher.service';
import { LateApiError } from './late-client.types';
import { YOUTUBE_FAILURE_MESSAGE } from './post-publisher.helpers';
import type { PostRow } from '../content-pipeline/posts/post.types';
import type { SupabaseService } from '../supabase/supabase.service';
import type { SocialConnectService } from './social-connect.service';
import type { LateClientService } from './late-client.service';
import type { PostsService } from '../content-pipeline/posts/posts.service';

const isoAgo = (min: number) =>
  new Date(Date.now() - min * 60_000).toISOString();

function makePost(over: Partial<PostRow> = {}): PostRow {
  return {
    id: 'p1',
    brand_id: 'b1',
    platform: 'instagram',
    post_type: 'single',
    copy: { body: 'hi' },
    media_refs: [],
    status: 'scheduled',
    scheduled_at: isoAgo(1),
    published_at: null,
    platform_post_id: null,
    source: 'ai_generated',
    error: null,
    attempts: 0,
    created_at: isoAgo(60),
    updated_at: isoAgo(60),
    ...over,
  };
}

/**
 * Filter+range-aware in-memory `posts` stub. Models the atomic claim: an UPDATE
 * guarded by .eq('status', from) only mutates a row whose status still matches,
 * so `claimReturnsNull` simulates losing the race to a concurrent tick.
 */
function makeFakeSupabase(
  rows: PostRow[],
  opts: { claimReturnsNull?: boolean } = {},
) {
  function builder() {
    const eqs: Record<string, unknown> = {};
    const ranges: Array<{
      col: string;
      op: 'lte' | 'lt' | 'gte';
      val: string;
    }> = [];
    let mode: 'select' | 'update' = 'select';
    let patch: Record<string, unknown> = {};
    let lim = 1000;
    const matches = (row: PostRow): boolean => {
      const r = row as unknown as Record<string, unknown>;
      return (
        Object.entries(eqs).every(([c, v]) => r[c] === v) &&
        ranges.every((f) =>
          f.op === 'lte'
            ? (r[f.col] as string) <= f.val
            : f.op === 'lt'
              ? (r[f.col] as string) < f.val
              : (r[f.col] as string) >= f.val,
        )
      );
    };
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Record<string, unknown>) => {
        mode = 'update';
        patch = p;
        return b;
      },
      eq: (c: string, v: unknown) => {
        eqs[c] = v;
        return b;
      },
      lte: (c: string, v: string) => {
        ranges.push({ col: c, op: 'lte', val: v });
        return b;
      },
      lt: (c: string, v: string) => {
        ranges.push({ col: c, op: 'lt', val: v });
        return b;
      },
      gte: (c: string, v: string) => {
        ranges.push({ col: c, op: 'gte', val: v });
        return b;
      },
      order: () => b,
      limit: (n: number) => {
        lim = n;
        return b;
      },
      maybeSingle: async () => {
        // Only claims reach maybeSingle (an update). Model the guarded claim.
        if (opts.claimReturnsNull) return { data: null, error: null };
        const row = rows.find(matches);
        if (!row) return { data: null, error: null };
        Object.assign(row, patch);
        return { data: { ...row }, error: null };
      },
      then: (resolve: (v: unknown) => void) => {
        if (mode === 'update') {
          rows.filter(matches).forEach((r) => Object.assign(r, patch));
          resolve({ data: null, error: null });
        } else {
          resolve({ data: rows.filter(matches).slice(0, lim), error: null });
        }
      },
    };
    return b;
  }
  return {
    getClient: () => ({ from: () => builder() }),
  } as unknown as SupabaseService;
}

function makePostsMock(rows: PostRow[]) {
  return {
    updateStatus: jest.fn(
      async (id: string, to: string, extra?: { error?: string | null }) => {
        const row = rows.find((r) => r.id === id);
        if (row) {
          row.status = to as PostRow['status'];
          if (extra?.error !== undefined) row.error = extra.error;
        }
        return row;
      },
    ),
  } as unknown as PostsService;
}

function makeService(
  rows: PostRow[],
  overrides: {
    configured?: boolean;
    publish?: jest.Mock;
    claimReturnsNull?: boolean;
  } = {},
) {
  const late = {
    isConfigured: () => overrides.configured ?? true,
  } as unknown as LateClientService;
  const publish =
    overrides.publish ??
    jest
      .fn()
      .mockResolvedValue({ postId: 'x1', platformPostUrl: null, raw: {} });
  const socialConnect = {
    publishForBrandPlatform: publish,
  } as unknown as SocialConnectService;
  const posts = makePostsMock(rows);
  const service = new PostPublisherService(
    makeFakeSupabase(rows, { claimReturnsNull: overrides.claimReturnsNull }),
    socialConnect,
    late,
    posts,
  );
  return { service, publish, posts };
}

describe('PostPublisherService', () => {
  it('no-ops (never publishes) when LATE_API_KEY is missing', async () => {
    const rows = [makePost()];
    const { service, publish } = makeService(rows, { configured: false });
    const res = await service.runOnce();
    expect(res).toEqual({ claimed: 0, published: 0, failed: 0 });
    expect(publish).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('scheduled');
  });

  it('claims and publishes a due Late post with the post id as idempotency key', async () => {
    const rows = [
      makePost({ media_refs: [{ kind: 'image', url: 'https://cdn/a.png' }] }),
    ];
    const publish = jest
      .fn()
      .mockResolvedValue({ postId: 'x1', platformPostUrl: 'https://ig/x1' });
    const { service, posts } = makeService(rows, { publish });

    const res = await service.runOnce();

    expect(res.published).toBe(1);
    expect(publish).toHaveBeenCalledWith(
      'b1',
      'instagram',
      expect.objectContaining({
        brandId: 'b1',
        platform: 'instagram',
        copy: 'hi',
        mediaUrls: ['https://cdn/a.png'],
      }),
      { idempotencyKey: 'p1' },
    );
    expect(posts.updateStatus).toHaveBeenCalledWith('p1', 'published', {});
    expect(rows[0].platform_post_id).toBe('https://ig/x1');
    expect(rows[0].attempts).toBe(1);
  });

  it('does not publish when the claim loses the race (concurrent tick already claimed)', async () => {
    const rows = [makePost()];
    const { service, publish } = makeService(rows, { claimReturnsNull: true });
    const res = await service.runOnce();
    expect(res.claimed).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('scheduled');
  });

  it('fails YouTube posts honestly without calling the publisher', async () => {
    const rows = [makePost({ platform: 'youtube_shorts' })];
    const { service, publish, posts } = makeService(rows);
    const res = await service.runOnce();
    expect(res.failed).toBe(1);
    expect(publish).not.toHaveBeenCalled();
    expect(posts.updateStatus).toHaveBeenCalledWith('p1', 'failed', {
      error: YOUTUBE_FAILURE_MESSAGE,
    });
  });

  it('fails an unsupported platform with a clear message', async () => {
    const rows = [makePost({ platform: 'pinterest' })];
    const { service, publish, posts } = makeService(rows);
    const res = await service.runOnce();
    expect(res.failed).toBe(1);
    expect(publish).not.toHaveBeenCalled();
    expect(posts.updateStatus).toHaveBeenCalledWith(
      'p1',
      'failed',
      expect.objectContaining({
        error: expect.stringContaining('Unsupported'),
      }),
    );
  });

  it('leaves a post in publishing on a transient failure with attempts remaining', async () => {
    const rows = [makePost()];
    const publish = jest.fn().mockRejectedValue(new LateApiError(503, 'down'));
    const { service, posts } = makeService(rows, { publish });

    const res = await service.runOnce();

    expect(res).toEqual({ claimed: 1, published: 0, failed: 0 });
    expect(posts.updateStatus).not.toHaveBeenCalled();
    expect(rows[0].status).toBe('publishing');
    expect(rows[0].attempts).toBe(1);
  });

  it('recovers a stuck publishing post and fails it once attempts are exhausted', async () => {
    // attempts=2, stuck 10 min → recovery re-claims to attempts=3 then fails.
    const rows = [
      makePost({ status: 'publishing', attempts: 2, updated_at: isoAgo(10) }),
    ];
    const publish = jest.fn().mockRejectedValue(new LateApiError(503, 'down'));
    const { service, posts } = makeService(rows, { publish });

    const res = await service.runOnce();

    expect(res.failed).toBe(1);
    expect(rows[0].attempts).toBe(3);
    expect(posts.updateStatus).toHaveBeenCalledWith('p1', 'failed', {
      error: 'down',
    });
  });

  it('fails immediately on a permanent error (no connected account)', async () => {
    const rows = [makePost()];
    const publish = jest
      .fn()
      .mockRejectedValue(
        new NotFoundException('No connected instagram account'),
      );
    const { service, posts } = makeService(rows, { publish });

    const res = await service.runOnce();

    expect(res.failed).toBe(1);
    expect(posts.updateStatus).toHaveBeenCalledWith(
      'p1',
      'failed',
      expect.objectContaining({
        error: expect.stringContaining('No connected'),
      }),
    );
  });
});
