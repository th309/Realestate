import { canTransition, nextStateOnSuccess } from './pipeline-state';

describe('pipeline-state', () => {
  it('allows queued to fetching_data', () => {
    expect(canTransition('queued', 'fetching_data')).toBe(true);
  });

  it('disallows queued to rendering_video', () => {
    expect(canTransition('queued', 'rendering_video')).toBe(false);
  });

  it('allows verifying_data to ready_for_review (gate A fail)', () => {
    expect(canTransition('verifying_data', 'ready_for_review')).toBe(true);
  });

  it('allows ready_for_review back to linting_voice on script edit', () => {
    expect(canTransition('ready_for_review', 'linting_voice')).toBe(true);
  });

  it('rendering_video goes to publishing for auto mode', () => {
    expect(nextStateOnSuccess('rendering_video', 'auto')).toBe('publishing');
  });

  it('rendering_video goes to ready_for_review for review mode', () => {
    expect(nextStateOnSuccess('rendering_video', 'review')).toBe(
      'ready_for_review',
    );
  });

  it('published is terminal', () => {
    expect(canTransition('published', 'fetching_data')).toBe(false);
    expect(canTransition('published', 'queued')).toBe(false);
  });

  it('failed can be retried back to queued', () => {
    expect(canTransition('failed', 'queued')).toBe(true);
  });
});
