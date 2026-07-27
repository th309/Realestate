import { isAllowedPostStatusTransition } from './post.types';
import { PostsService } from './posts.service';
import type { SupabaseService } from '../../supabase/supabase.service';
import type { PostStatus } from './post.types';

/**
 * Build a PostsService whose getById reports `from` and whose update captures
 * the patch, so the un-fail reset can be asserted without a database.
 */
function buildService(from: PostStatus) {
  const patches: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => {
          const row = {
            data: { id: 'p1', status: from, attempts: 3, error: 'boom' },
            error: null,
          };
          return { maybeSingle: async () => row, single: async () => row };
        },
      }),
      update: (patch: Record<string, unknown>) => {
        patches.push(patch);
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: 'p1', ...patch },
                error: null,
              }),
            }),
          }),
        };
      },
    }),
  };
  const service = new PostsService({
    getClient: () => client,
  } as unknown as SupabaseService);
  return { service, patches };
}

/**
 * Characterization tests for the Phase 5 'publishing' transitions added to the
 * posts status map. Kept in a dedicated file (not posts.service.spec.ts) to
 * avoid colliding with the Phase 2 agent's concurrent edits to that spec.
 */
describe('post status transitions — publishing (Phase 5)', () => {
  it('allows scheduled -> publishing (the atomic claim)', () => {
    expect(isAllowedPostStatusTransition('scheduled', 'publishing')).toBe(true);
  });

  it('allows publishing -> published (successful publish)', () => {
    expect(isAllowedPostStatusTransition('publishing', 'published')).toBe(true);
  });

  it('allows publishing -> failed (permanent failure / attempts exhausted)', () => {
    expect(isAllowedPostStatusTransition('publishing', 'failed')).toBe(true);
  });

  it('rejects draft -> publishing (only scheduled posts are claimed)', () => {
    expect(isAllowedPostStatusTransition('draft', 'publishing')).toBe(false);
  });
});

describe('un-failing a post resets its retry budget', () => {
  it('clears attempts and error on failed -> pending_review', async () => {
    const { service, patches } = buildService('failed');
    await service.updateStatus('p1', 'pending_review');
    expect(patches[0].attempts).toBe(0);
    expect(patches[0].error).toBeNull();
  });

  it('clears attempts and error on failed -> scheduled', async () => {
    const { service, patches } = buildService('failed');
    await service.updateStatus('p1', 'scheduled', {
      scheduledAt: '2026-08-01T12:00:00Z',
    });
    expect(patches[0].attempts).toBe(0);
    expect(patches[0].error).toBeNull();
    expect(patches[0].scheduled_at).toBe('2026-08-01T12:00:00Z');
  });

  it('leaves attempts alone on failed -> skipped (not a retry)', async () => {
    const { service, patches } = buildService('failed');
    await service.updateStatus('p1', 'skipped');
    expect(patches[0].attempts).toBeUndefined();
    expect(patches[0].error).toBeUndefined();
  });

  it('leaves attempts alone when the post was not failed', async () => {
    const { service, patches } = buildService('pending_review');
    await service.updateStatus('p1', 'approved');
    expect(patches[0].attempts).toBeUndefined();
    expect(patches[0].error).toBeUndefined();
  });

  it('still honours an explicit error passed alongside the reset', async () => {
    const { service, patches } = buildService('failed');
    await service.updateStatus('p1', 'pending_review', { error: null });
    expect(patches[0].attempts).toBe(0);
    expect(patches[0].error).toBeNull();
  });
});
