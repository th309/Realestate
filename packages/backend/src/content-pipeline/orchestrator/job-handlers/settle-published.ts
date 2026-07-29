import { Logger } from '@nestjs/common';
import { RunOrchestratorService } from '../run-orchestrator.service';

/** `transitionTo` throws with this prefix when the state machine rejects a move. */
const INVALID_TRANSITION_PREFIX = 'Invalid transition from';

/**
 * Mark a run published after a platform post has already succeeded.
 *
 * Publishing fans out, and every per-platform handler calls this on success —
 * so several of them race for one terminal status, and all but the first arrive
 * to find the run already terminal. `ALLOWED_TRANSITIONS` has no edges out of
 * `published` / `published_partial` / `cancelled` / `failed`-to-`published`, so
 * the losers' transition is REJECTED.
 *
 * That rejection must not be treated as a publish failure. The post already
 * happened — it is live on someone's feed. Letting the error propagate makes
 * the handler record its own success as a `status:'failed'` platform_posts row
 * and then throw into its queue, corrupting the audit trail for a video that
 * published perfectly.
 *
 * Reachable whenever the run went terminal first, which is not exotic:
 *   - a sibling platform failed and drove the run to `failed`
 *   - the operator cancelled mid-publish (`cancelled` is terminal)
 *   - the reconciler re-dispatched a dropped platform on an already-`published`
 *     run (see reconcile-publish-gaps.cron.ts)
 *
 * Only invalid-transition rejections are absorbed. Anything else — a missing
 * run, a failed write — is a real problem and still propagates.
 */
export async function settlePublished(
  orchestrator: RunOrchestratorService,
  logger: Logger,
  runId: string,
  platform: string,
): Promise<void> {
  try {
    await orchestrator.transitionTo(runId, 'published', {
      enqueueNext: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith(INVALID_TRANSITION_PREFIX)) throw err;
    logger.log(
      `[PIPE] publish-${platform} run=${runId} posted successfully; run was already terminal so its status is unchanged (${message})`,
    );
  }
}
