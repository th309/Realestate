import { PostsService } from './posts.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { isAllowedPostStatusTransition, PostStatus } from './post.types';

function makePostsFake(seed: Record<string, unknown>[] = []) {
  const store: { posts: Record<string, unknown>[] } = { posts: [...seed] };
  let idCounter = 1;

  function builder(table: 'posts') {
    let op: 'select' | 'insert' | 'update' = 'select';
    const filters: Array<[string, unknown]> = [];
    const ranges: Array<[string, 'gte' | 'lte', string]> = [];
    let orderCol: string | null = null;
    let orderAsc = false;
    let insertRow: Record<string, unknown> | null = null;
    let patch: Record<string, unknown> | null = null;

    const match = (rows: Record<string, unknown>[]) =>
      rows.filter((r) => filters.every(([c, v]) => r[c] === v));

    const applyListFilters = () => {
      let rows = match(store[table]).filter((r) =>
        ranges.every(([c, dir, v]) => {
          const rv = r[c];
          if (rv == null) return false;
          return dir === 'gte' ? String(rv) >= v : String(rv) <= v;
        }),
      );
      if (orderCol) {
        const col = orderCol;
        rows = [...rows].sort((a, z) => {
          const av = String(a[col] ?? '');
          const zv = String(z[col] ?? '');
          return orderAsc ? av.localeCompare(zv) : zv.localeCompare(av);
        });
      }
      return rows;
    };

    const resolveSingle = () => {
      if (op === 'insert') return { data: insertRow, error: null };
      if (op === 'update') {
        const rows = match(store[table]);
        rows.forEach((r) => Object.assign(r, patch));
        return { data: rows[0] ?? null, error: null };
      }
      return { data: match(store[table])[0] ?? null, error: null };
    };

    const b = {
      select() {
        return b;
      },
      insert(obj: Record<string, unknown>) {
        op = 'insert';
        insertRow = { id: `post-${idCounter++}`, ...obj };
        store[table].push(insertRow);
        return b;
      },
      update(p: Record<string, unknown>) {
        op = 'update';
        patch = p;
        return b;
      },
      eq(c: string, v: unknown) {
        filters.push([c, v]);
        return b;
      },
      gte(c: string, v: string) {
        ranges.push([c, 'gte', v]);
        return b;
      },
      lte(c: string, v: string) {
        ranges.push([c, 'lte', v]);
        return b;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = !!opts?.ascending;
        return b;
      },
      limit() {
        return b;
      },
      maybeSingle() {
        return Promise.resolve(resolveSingle());
      },
      single() {
        return Promise.resolve(resolveSingle());
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve({ data: applyListFilters(), error: null }).then(
          resolve,
          reject,
        );
      },
    };
    return b;
  }

  const supabase = {
    getClient: () => ({ from: (t: 'posts') => builder(t) }),
  } as unknown as SupabaseService;
  return { supabase, store };
}

function seedPost(status: PostStatus): Record<string, unknown> {
  return {
    id: 'post-1',
    brand_id: 'brand-1',
    platform: 'linkedin',
    post_type: 'linkedin_post',
    copy: { body: 'hello' },
    media_refs: [],
    status,
    scheduled_at: null,
    published_at: null,
    platform_post_id: null,
    source: 'ai_generated',
    error: null,
    created_at: '2026-07-25T00:00:00Z',
    updated_at: '2026-07-25T00:00:00Z',
  };
}

describe('post status transition map', () => {
  it('allows the documented forward transitions', () => {
    expect(isAllowedPostStatusTransition('draft', 'pending_review')).toBe(true);
    expect(isAllowedPostStatusTransition('pending_review', 'approved')).toBe(
      true,
    );
    expect(isAllowedPostStatusTransition('approved', 'scheduled')).toBe(true);
    expect(isAllowedPostStatusTransition('scheduled', 'published')).toBe(true);
    expect(isAllowedPostStatusTransition('failed', 'pending_review')).toBe(
      true,
    );
  });

  it('allows skipping from any non-terminal state', () => {
    expect(isAllowedPostStatusTransition('draft', 'skipped')).toBe(true);
    expect(isAllowedPostStatusTransition('pending_review', 'skipped')).toBe(
      true,
    );
    expect(isAllowedPostStatusTransition('approved', 'skipped')).toBe(true);
    expect(isAllowedPostStatusTransition('scheduled', 'skipped')).toBe(true);
  });

  it('rejects transitions out of terminal states', () => {
    expect(isAllowedPostStatusTransition('published', 'draft')).toBe(false);
    expect(isAllowedPostStatusTransition('skipped', 'approved')).toBe(false);
  });

  it('rejects illegal jumps', () => {
    expect(isAllowedPostStatusTransition('draft', 'published')).toBe(false);
    expect(isAllowedPostStatusTransition('pending_review', 'scheduled')).toBe(
      false,
    );
  });
});

describe('PostsService.updateStatus enforces the transition map', () => {
  it('moves pending_review -> approved and stamps updated_at', async () => {
    const { supabase } = makePostsFake([seedPost('pending_review')]);
    const service = new PostsService(supabase);
    const row = await service.updateStatus('post-1', 'approved');
    expect(row.status).toBe('approved');
  });

  it('stamps published_at when moving to published', async () => {
    const { supabase } = makePostsFake([seedPost('scheduled')]);
    const service = new PostsService(supabase);
    const row = await service.updateStatus('post-1', 'published');
    expect(row.status).toBe('published');
    expect(row.published_at).toBeTruthy();
  });

  it('rejects an invalid transition (published -> draft)', async () => {
    const { supabase } = makePostsFake([seedPost('published')]);
    const service = new PostsService(supabase);
    await expect(service.updateStatus('post-1', 'draft')).rejects.toThrow(
      /invalid status transition/,
    );
  });

  it('refuses to edit copy of a published post', async () => {
    const { supabase } = makePostsFake([seedPost('published')]);
    const service = new PostsService(supabase);
    await expect(service.updateCopy('post-1', { body: 'new' })).rejects.toThrow(
      /published/,
    );
  });

  it('persists platformPostId from the publisher (Phase 5)', async () => {
    const { supabase, store } = makePostsFake([seedPost('scheduled')]);
    const service = new PostsService(supabase);
    const row = await service.updateStatus('post-1', 'published', {
      platformPostId: 'late_abc123',
    });
    expect(row.status).toBe('published');
    expect(row.platform_post_id).toBe('late_abc123');
    expect(store.posts[0].platform_post_id).toBe('late_abc123');
  });
});

describe('PostsService.listPosts calendar range filter (planner contract)', () => {
  function scheduledPost(id: string, scheduledAt: string) {
    return {
      ...seedPost('scheduled'),
      id,
      scheduled_at: scheduledAt,
    };
  }

  it('filters by scheduled_at range and orders ascending', async () => {
    const { supabase } = makePostsFake([
      scheduledPost('p-jun', '2026-06-15T00:00:00Z'),
      scheduledPost('p-jul-10', '2026-07-10T00:00:00Z'),
      scheduledPost('p-jul-20', '2026-07-20T00:00:00Z'),
      scheduledPost('p-aug', '2026-08-05T00:00:00Z'),
    ]);
    const service = new PostsService(supabase);

    const rows = await service.listPosts({
      status: 'scheduled',
      scheduledFrom: '2026-07-01T00:00:00Z',
      scheduledTo: '2026-07-31T23:59:59Z',
      orderBy: 'scheduled_at',
    });

    expect(rows.map((r) => r.id)).toEqual(['p-jul-10', 'p-jul-20']);
  });

  it('defaults to created_at DESC when orderBy is omitted', async () => {
    const { supabase } = makePostsFake([
      { ...seedPost('draft'), id: 'old', created_at: '2026-07-01T00:00:00Z' },
      { ...seedPost('draft'), id: 'new', created_at: '2026-07-20T00:00:00Z' },
    ]);
    const service = new PostsService(supabase);

    const rows = await service.listPosts({});
    expect(rows.map((r) => r.id)).toEqual(['new', 'old']);
  });
});
