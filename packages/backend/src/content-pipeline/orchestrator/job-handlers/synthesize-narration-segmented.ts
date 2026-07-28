/**
 * Segmented narration synthesis — the prosody half of the audio step.
 *
 * Instead of handing the whole script to the TTS driver as one blob (which
 * reads flat and robotic, because the engine has no sentence-level phrasing
 * to reset against), each sentence is synthesized as its own clip and the
 * clips are re-joined with real silence and loudness-normalized. See
 * narration-segmenter.ts for why this is done with clips rather than SSML
 * `<break>`.
 *
 * Everything downstream of this module is unchanged: one MP3 at outputPath,
 * one merged TTSSynthesisResult, one summed DriverCost.
 */
import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { statSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { DriverCost } from '../../drivers/driver-cost.types';
import {
  TTSDriver,
  TTSSynthesisResult,
  WordTiming,
} from '../../drivers/tts-driver.interface';
import {
  recordTtsFallback,
  resolveDriverVoiceId,
  synthesizeWithFallback,
  synthesizeWithRetry,
} from './synthesize-audio-chain';
import { NarrationSegment, segmentNarration } from './narration-segmenter';
import {
  assembleNarration,
  isFfmpegAvailable,
} from './assemble-narration-audio';
import { probeAudioDurationMs } from './audio-duration-probe';
import {
  cumulativeSegmentOffsetsMs,
  NarrationSegmentPlan,
  offsetTimings,
} from './narration-timing';

export interface NarrationSynthesis {
  driver: TTSDriver;
  result: TTSSynthesisResult;
  /** null when the single-blob path ran (empty script, or no ffmpeg). */
  segmentPlan: NarrationSegmentPlan | null;
  loudnorm: boolean;
}

/**
 * Entry point for the handler. Chooses the segmented path when ffmpeg is
 * available and falls back to the historical single-blob synthesis otherwise —
 * a missing binary degrades audio quality, it never fails a run.
 */
export async function synthesizeNarration(
  client: SupabaseClient,
  logger: Logger,
  runId: string,
  chain: TTSDriver[],
  primaryVoiceId: string,
  text: string,
  outputPath: string,
): Promise<NarrationSynthesis> {
  const segments = segmentNarration(text);
  const ffmpeg = segments.length > 0 && (await isFfmpegAvailable());

  if (!ffmpeg) {
    if (segments.length > 0) {
      logger.warn(
        `[PIPE] synthesize-audio run=${runId} ffmpeg not on PATH — using single-blob synthesis (flat prosody, no loudness normalization)`,
      );
    }
    const single = await synthesizeWithFallback(
      client,
      logger,
      runId,
      chain,
      primaryVoiceId,
      text,
      outputPath,
    );
    return { ...single, segmentPlan: null, loudnorm: false };
  }

  logger.log(
    `[PIPE] synthesize-audio run=${runId} segmented narration: ${segments.length} segments, ${totalSilenceMs(segments)}ms inserted silence`,
  );
  return synthesizeSegments(
    client,
    logger,
    runId,
    chain,
    primaryVoiceId,
    segments,
    outputPath,
  );
}

export function totalSilenceMs(segments: NarrationSegment[]): number {
  return segments
    .slice(0, -1)
    .reduce((sum, segment) => sum + segment.breakAfterMs, 0);
}

/**
 * Walk the driver chain like synthesizeWithFallback, but a driver only
 * "succeeds" once every segment synthesized AND the clips assembled. A
 * terminal failure on any segment restarts the whole narration on the next
 * driver, so a run never mixes voices or providers mid-narration.
 */
async function synthesizeSegments(
  client: SupabaseClient,
  logger: Logger,
  runId: string,
  chain: TTSDriver[],
  primaryVoiceId: string,
  segments: NarrationSegment[],
  outputPath: string,
): Promise<NarrationSynthesis> {
  const gapsMs = segments.map((segment) => segment.breakAfterMs);
  let lastErr: Error | null = null;

  for (let i = 0; i < chain.length; i++) {
    const driver = chain[i];
    const voiceId = resolveDriverVoiceId(chain, driver, primaryVoiceId);
    const paths = segments.map((_, index) =>
      join(
        tmpdir(),
        `narration-${runId}-${String(index).padStart(3, '0')}-${randomBytes(3).toString('hex')}.mp3`,
      ),
    );
    try {
      const results: TTSSynthesisResult[] = [];
      for (let s = 0; s < segments.length; s++) {
        results.push(
          await synthesizeWithRetry(logger, driver, {
            text: segments[s].text,
            voiceId,
            outputPath: paths[s],
            format: 'mp3',
          }),
        );
      }

      const durationsMs: number[] = [];
      for (const path of paths)
        durationsMs.push(await probeAudioDurationMs(path));
      await assembleNarration(paths, gapsMs, outputPath);

      const offsetsMs = await measureSegmentOffsets(
        logger,
        runId,
        outputPath,
        durationsMs,
        gapsMs,
      );
      if (i > 0) {
        await recordTtsFallback(client, logger, runId, chain, driver, lastErr);
      }
      // Audio-domain length of the assembled narration: last segment's
      // start offset + its probed duration (never wall-clock synth time).
      const totalAudioMs =
        offsetsMs[offsetsMs.length - 1] + durationsMs[durationsMs.length - 1];
      return {
        driver,
        result: mergeResults(results, offsetsMs, outputPath, totalAudioMs),
        segmentPlan: { segments, offsetsMs },
        loudnorm: true,
      };
    } catch (err) {
      lastErr = err as Error;
      if (i === chain.length - 1) throw lastErr;
      logger.warn(
        `[PIPE] synthesize-audio run=${runId} ${driver.provider} failed terminally on segmented narration, advancing chain: ${lastErr.message?.slice(0, 200)}`,
      );
    } finally {
      await Promise.all(
        paths.map((path) => unlink(path).catch(() => undefined)),
      );
    }
  }
  throw lastErr ?? new Error('synthesizeNarrationSegmented: empty chain');
}

/**
 * Segment offsets measured against the assembled file rather than trusted
 * from the clip probes. MP3 encoder delay/padding means the decoded length of
 * a clip differs from its container duration by a few ms — harmless once, but
 * it accumulates across segments and would walk the captions off the audio.
 * The inserted silence is exact, so any difference belongs to the speech, and
 * distributing it proportionally keeps every offset locked to the real file.
 */
async function measureSegmentOffsets(
  logger: Logger,
  runId: string,
  outputPath: string,
  durationsMs: number[],
  gapsMs: number[],
): Promise<number[]> {
  const speechMs = durationsMs.reduce((sum, ms) => sum + ms, 0);
  const silenceMs = gapsMs
    .slice(0, durationsMs.length - 1)
    .reduce((sum, ms) => sum + ms, 0);
  let scale = 1;
  try {
    const assembledMs = await probeAudioDurationMs(outputPath);
    const measuredSpeechMs = assembledMs - silenceMs;
    const candidate = speechMs > 0 ? measuredSpeechMs / speechMs : 1;
    // Only trust a small correction: anything larger means the assembled file
    // is not what we think it is, and stretching timings would make it worse.
    if (candidate >= 0.9 && candidate <= 1.1) {
      scale = candidate;
    } else {
      logger.warn(
        `[PIPE] synthesize-audio run=${runId} assembled duration ${assembledMs}ms vs expected ${speechMs + silenceMs}ms — leaving caption offsets unscaled`,
      );
    }
  } catch {
    /* probe failed; unscaled offsets are still close */
  }
  return cumulativeSegmentOffsetsMs(
    durationsMs.map((ms) => Math.round(ms * scale)),
    gapsMs,
  );
}

function mergeResults(
  results: TTSSynthesisResult[],
  offsetsMs: number[],
  outputPath: string,
  totalAudioMs: number,
): TTSSynthesisResult {
  let sizeBytes = 0;
  try {
    sizeBytes = statSync(outputPath).size;
  } catch {
    sizeBytes = 0;
  }
  return {
    // Wall-clock synthesis time, matching the single-blob contract — the
    // handler probes the file for real audio length.
    durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    // Bitrate over the assembled file's audio-domain length (probed segment
    // durations + gaps) — never wall-clock synth time.
    bitrate:
      totalAudioMs > 0 && sizeBytes > 0
        ? (sizeBytes * 8) / (totalAudioMs / 1000)
        : 0,
    cost: mergeCosts(results.map((r) => r.cost)),
    wordTimings: mergeWordTimings(results, offsetsMs),
  };
}

function mergeCosts(costs: DriverCost[]): DriverCost {
  return {
    provider: costs[0].provider,
    amount_usd: costs.reduce((sum, cost) => sum + cost.amount_usd, 0),
    units: costs.reduce((sum, cost) => sum + cost.units, 0),
    unit_type: costs[0].unit_type,
  };
}

/**
 * All-or-nothing: partial native timings would caption part of the video and
 * silently drop the rest, so a single gap falls the run through to the shadow
 * or Whisper path instead.
 */
function mergeWordTimings(
  results: TTSSynthesisResult[],
  offsetsMs: number[],
): WordTiming[] | undefined {
  const complete = results.every(
    (r) => r.wordTimings !== undefined && r.wordTimings.length > 0,
  );
  if (!complete) return undefined;
  return results.flatMap((r, index) =>
    offsetTimings(r.wordTimings as WordTiming[], offsetsMs[index] ?? 0),
  );
}
