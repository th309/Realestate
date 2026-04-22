import { PipelineStatus } from '../types';

export const ALLOWED_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  queued: ['fetching_data'],
  fetching_data: ['scripting', 'failed'],
  scripting: ['verifying_data', 'failed'],
  verifying_data: ['linting_voice', 'ready_for_review'],
  linting_voice: ['rendering_voice', 'ready_for_review'],
  rendering_voice: ['timing_captions', 'rendering_video', 'failed'],
  timing_captions: ['rendering_video', 'failed'],
  rendering_video: ['publishing', 'ready_for_review', 'failed'],
  ready_for_review: ['publishing', 'linting_voice', 'rejected'],
  publishing: ['published', 'published_partial', 'failed'],
  published: [],
  published_partial: [],
  rejected: [],
  failed: ['queued'],
};

export function canTransition(
  from: PipelineStatus,
  to: PipelineStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStateOnSuccess(
  current: PipelineStatus,
  approvalMode: 'auto' | 'review' | 'draft',
): PipelineStatus | null {
  switch (current) {
    case 'queued':
      return 'fetching_data';
    case 'fetching_data':
      return 'scripting';
    case 'scripting':
      return 'verifying_data';
    case 'verifying_data':
      return 'linting_voice';
    case 'linting_voice':
      return 'rendering_voice';
    case 'rendering_voice':
      // Captions feature is P2. Until CAPTIONS_ENABLED=true is set and a
      // time-captions handler is wired to the render-captions queue, skip
      // directly to rendering_video so P1 runs complete without stalling.
      return process.env.CAPTIONS_ENABLED === 'true'
        ? 'timing_captions'
        : 'rendering_video';
    case 'timing_captions':
      return 'rendering_video';
    case 'rendering_video':
      return approvalMode === 'review' ? 'ready_for_review' : 'publishing';
    case 'ready_for_review':
      return 'publishing';
    case 'publishing':
      return 'published';
    default:
      return null;
  }
}
