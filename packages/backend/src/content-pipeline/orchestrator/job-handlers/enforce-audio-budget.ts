/**
 * Audio-budget enforcement for the synthesize-audio step — extracted from the
 * handler to keep it under the file-size limit. Behavior is unchanged: the
 * probed narration length is compared against the format's
 * (duration - buffer) cap, an overflow first goes through the script-repair
 * loop (same mechanism as gate_b_voice), and only an exhausted repair budget
 * fails the run.
 */
import { Logger } from '@nestjs/common';
import { ScriptRepairService } from '../script-repair.service';

export interface AudioBudgetInput {
  runId: string;
  format: string;
  spokenText: string;
  audioDurationMs: number;
  audioBudgetMs: number;
  durationSeconds: number;
  audioBufferSeconds: number;
}

/**
 * @returns true when a repair retry was queued and the handler must stop.
 * @throws when the narration is over budget and repairs are exhausted.
 */
export async function enforceAudioBudget(
  scriptRepair: ScriptRepairService,
  logger: Logger,
  input: AudioBudgetInput,
): Promise<boolean> {
  const { audioDurationMs, audioBudgetMs, runId, spokenText } = input;
  if (audioDurationMs <= audioBudgetMs) return false;

  const overSec = (audioDurationMs - audioBudgetMs) / 1000;
  const overSecStr = overSec.toFixed(1);
  const audioSecStr = (audioDurationMs / 1000).toFixed(1);
  const capSecStr = (audioBudgetMs / 1000).toFixed(1);
  // Approximate words to cut at ~140 wpm narration pace.
  const cutWords = Math.max(1, Math.ceil(overSec * (140 / 60)));

  const overflowMessage = `voice-over is ${audioSecStr}s but ${input.format} video is ${input.durationSeconds}s with a ${input.audioBufferSeconds}s buffer (cap ${capSecStr}s). Over by ${overSecStr}s.`;

  // Try the script-repair loop first — same mechanism as gate_b_voice.
  // The script generator gets the overflow as feedback and produces a
  // shorter script that fits the budget on retry.
  const repairing = await scriptRepair.attemptRepair(runId, 'audio_duration', [
    {
      quote:
        spokenText.length > 240 ? `${spokenText.slice(0, 240)}…` : spokenText,
      issue: `${overflowMessage} Cut at least ${cutWords} words from the script — favor tightening the hook and outro before touching the row VOs. Row count and rank order MUST be preserved.`,
    },
  ]);
  if (repairing) {
    logger.warn(
      `[PIPE] synthesize-audio run=${runId} over budget by ${overSecStr}s — repair-loop triggered`,
    );
    return true;
  }

  // Repair budget exhausted — fail with the original descriptive message so
  // the operator can see what happened.
  throw new Error(
    `${overflowMessage} Edit the script to be shorter and retry.`,
  );
}
