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

  it('allows ready_for_review back to verifying_data after Gate A failure edit', () => {
    expect(canTransition('ready_for_review', 'verifying_data')).toBe(true);
  });

  it('rendering_video goes to publishing for auto mode', () => {
    expect(nextStateOnSuccess('rendering_video', 'auto')).toBe('publishing');
  });

  it('rendering_video goes to ready_for_review for review mode', () => {
    expect(nextStateOnSuccess('rendering_video', 'review')).toBe(
      'ready_for_review',
    );
  });

  it('rendering_video goes to publishing for draft mode (publishers branch on postMode)', () => {
    expect(nextStateOnSuccess('rendering_video', 'draft')).toBe('publishing');
  });

  it('canTransition pins rendering_video → ready_for_review in the table (independent of nextStateOnSuccess)', () => {
    // Locks the table-level edge so a regression in ALLOWED_TRANSITIONS is caught
    // even if no caller exercises handleStepSuccess for this branch.
    expect(canTransition('rendering_video', 'ready_for_review')).toBe(true);
  });

  it('ready_for_review transitions to publishing on review approve', () => {
    expect(nextStateOnSuccess('ready_for_review', 'review')).toBe('publishing');
  });

  it('published is terminal', () => {
    expect(canTransition('published', 'fetching_data')).toBe(false);
    expect(canTransition('published', 'queued')).toBe(false);
  });

  it('failed can be retried back to queued', () => {
    expect(canTransition('failed', 'queued')).toBe(true);
  });

  it('any non-terminal state can transition to cancelled', () => {
    const nonTerminal = [
      'queued',
      'fetching_data',
      'scripting',
      'verifying_data',
      'linting_voice',
      'rendering_voice',
      'timing_captions',
      'rendering_video',
      'ready_for_review',
      'publishing',
    ] as const;
    for (const s of nonTerminal) {
      expect(canTransition(s, 'cancelled')).toBe(true);
    }
  });

  it('cancelled is terminal — no further transitions allowed', () => {
    expect(canTransition('cancelled', 'queued')).toBe(false);
    expect(canTransition('cancelled', 'fetching_data')).toBe(false);
    expect(canTransition('cancelled', 'failed')).toBe(false);
  });

  it('published cannot be cancelled', () => {
    expect(canTransition('published', 'cancelled')).toBe(false);
    expect(canTransition('published_partial', 'cancelled')).toBe(false);
    expect(canTransition('rejected', 'cancelled')).toBe(false);
    expect(canTransition('failed', 'cancelled')).toBe(false);
  });
});
