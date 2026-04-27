import { PipelineStatus } from '../types';

// Every non-terminal state accepts `cancelled` so operators can abort a run
// at any point before the pipeline reaches a natural terminal. Terminal
// states (including `cancelled` itself) accept no further transitions —
// a cancelled run cannot be resumed; the operator creates a fresh run.
export const ALLOWED_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
  queued: ['fetching_data', 'cancelled'],
  fetching_data: ['scripting', 'failed', 'cancelled'],
  scripting: ['verifying_data', 'failed', 'cancelled'],
  verifying_data: ['linting_voice', 'ready_for_review', 'failed', 'cancelled'],
  // `scripting` is reachable from `linting_voice` via the script-repair loop:
  // when the brand-voice gate fails and the run still has retry budget,
  // ScriptRepairService transitions back to scripting with the violations
  // as feedback so the LLM can produce a corrected script.
  linting_voice: [
    'rendering_voice',
    'ready_for_review',
    'scripting',
    'failed',
    'cancelled',
  ],
  // `scripting` is reachable from `rendering_voice` via the script-repair
  // loop too: when the synthesized audio exceeds the format's audio budget
  // (script-too-long), ScriptRepairService transitions back to scripting
  // with the duration overflow as feedback. Same mechanism as voice-gate
  // repair; different trigger.
  rendering_voice: [
    'timing_captions',
    'rendering_video',
    'scripting',
    'failed',
    'cancelled',
  ],
  timing_captions: ['rendering_video', 'failed', 'cancelled'],
  rendering_video: ['publishing', 'ready_for_review', 'failed', 'cancelled'],
  ready_for_review: [
    'publishing',
    'linting_voice',
    'verifying_data',
    'rejected',
    'cancelled',
  ],
  publishing: ['published', 'published_partial', 'failed', 'cancelled'],
  published: [],
  published_partial: [],
  rejected: [],
  failed: ['queued'],
  cancelled: [],
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
  format?: string,
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
    case 'rendering_voice': {
      // Ranking layouts ALIGN row reveals to the actual VO word timings, so
      // they unconditionally need the captions step to run regardless of the
      // CAPTIONS_ENABLED env flag. Other formats remain gated until P2.
      const isRanking =
        format === 'top_10_ranking' || format === 'bottom_10_ranking';
      return isRanking || process.env.CAPTIONS_ENABLED === 'true'
        ? 'timing_captions'
        : 'rendering_video';
    }
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
