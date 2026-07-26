// packages/backend/src/content-pipeline/orchestrator/job-handlers/record-driver-spend.ts
import { Logger } from '@nestjs/common';
import { CostCapService } from '../../auto-ideation/cost-cap.service';
import { DriverCost } from '../../drivers/driver-cost.types';

/**
 * Charge a pipeline step's driver cost against the daily USD cap that
 * content-runs.service checks before enqueuing a run. Without this, video runs
 * read the ledger but never write to it, so the cap only ever reflected feed
 * post spend.
 *
 * Best-effort by design: the paid API call already happened, so a ledger write
 * failure is logged rather than failing the run. Zero-cost drivers (local
 * Remotion renders, Edge TTS) are skipped, matching the feed lane.
 */
export async function recordDriverSpend(
  costCap: CostCapService,
  logger: Logger,
  step: string,
  runId: string,
  cost: DriverCost | undefined,
): Promise<void> {
  const amountUsd = Number(cost?.amount_usd ?? 0);
  if (!cost || !(amountUsd > 0)) return;
  try {
    await costCap.recordSpend([cost]);
  } catch (e) {
    logger.error(
      `[PIPE] ${step} recordSpend failed run=${runId} (spent ~$${amountUsd.toFixed(4)} via ${cost.provider}): ${(e as Error).message}`,
    );
  }
}
