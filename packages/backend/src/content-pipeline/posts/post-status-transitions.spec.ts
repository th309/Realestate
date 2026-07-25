import { isAllowedPostStatusTransition } from './post.types';

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
