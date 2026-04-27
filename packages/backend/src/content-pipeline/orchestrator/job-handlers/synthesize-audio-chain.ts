/**
 * TTS Chain Helpers — extracted from synthesize-audio.handler.ts to keep
 * the handler under the 300-line file-size limit.
 *
 * Two concerns live here:
 *  - synthesizeWithFallback: walk the priority-ordered driver chain, log
 *    fallback events, override voiceId when crossing into OpenAI's catalog.
 *  - synthesizeWithRetry: retry transient failures (Edge TTS WS 403s, network
 *    errors) against a single driver before giving up.
 *
 * Pure helpers — no DI, no class. The handler injects its supabase client +
 * logger and calls them.
 */
import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
  WordTiming,
} from '../../drivers/tts-driver.interface';
import { EdgeTTSDriver } from '../../drivers/edge-tts-driver';

// When falling through to OpenAI from an Azure/Edge primary, the user's
// stored voiceId is from a different catalog (en-US-JennyNeural, etc.) so we
// override to OpenAI's default voice. Future work could store an OpenAI voice
// mapping per row in tts_voices; out of P2 scope.
const OPENAI_FALLBACK_VOICE = 'alloy';

/**
 * Walk the priority-ordered driver chain. The first driver is the primary;
 * synthesizeWithRetry handles transient errors against it. On terminal
 * failure (after retries exhausted), advance to the next configured
 * driver, log a tts_fallback content_run_event, and try again.
 */
export async function synthesizeWithFallback(
  client: SupabaseClient,
  logger: Logger,
  runId: string,
  chain: TTSDriver[],
  primaryVoiceId: string,
  text: string,
  outputPath: string,
): Promise<{ driver: TTSDriver; result: TTSSynthesisResult }> {
  let lastErr: Error | null = null;
  for (let i = 0; i < chain.length; i++) {
    const driver = chain[i];
    const voiceId =
      driver.provider === 'openai' && chain[0].provider !== 'openai'
        ? OPENAI_FALLBACK_VOICE
        : primaryVoiceId;
    const req: TTSSynthesisRequest = {
      text,
      voiceId,
      outputPath,
      format: 'mp3',
    };
    try {
      const result = await synthesizeWithRetry(logger, driver, req);
      if (i > 0) {
        await client.from('content_run_events').insert({
          run_id: runId,
          event_type: 'tts_fallback',
          payload: {
            from: chain[0].provider,
            to: driver.provider,
            reason: lastErr?.message?.slice(0, 500) ?? null,
          },
        });
        logger.warn(
          `[PIPE] synthesize-audio run=${runId} fell back ${chain[0].provider}→${driver.provider}`,
        );
      }
      return { driver, result };
    } catch (err) {
      lastErr = err as Error;
      if (i === chain.length - 1) throw lastErr;
      logger.warn(
        `[PIPE] synthesize-audio run=${runId} ${driver.provider} failed terminally, advancing chain: ${lastErr.message?.slice(0, 200)}`,
      );
    }
  }
  throw lastErr ?? new Error('synthesizeWithFallback: empty chain');
}

/**
 * Native captions chain — runs after the TTS synthesis chain returns. Mirrors
 * TTS priority:
 *   - Edge native: result.wordTimings already populated; just persist.
 *   - Azure REST: REST endpoint emits no boundaries. Fall through to Edge
 *     shadow capture (same Microsoft backend, same voice catalog → near-
 *     identical timings to the Azure audio).
 *   - OpenAI: no native mechanism. Returns null source; caller leaves the
 *     captions_timings asset unwritten so time-captions handler runs Whisper.
 *
 * Persists `captions_timings` asset when timings are obtained, so the
 * downstream time-captions step is a no-op for Edge/Azure runs and the
 * Whisper API is only billed for OpenAI fallback paths.
 */
export async function captureNativeCaptions(
  client: SupabaseClient,
  logger: Logger,
  runId: string,
  driver: TTSDriver,
  chain: TTSDriver[],
  voiceId: string,
  spokenText: string,
  initialTimings: WordTiming[] | undefined,
): Promise<{
  source: 'edge_native' | 'edge_shadow' | null;
  count: number;
}> {
  let timings: WordTiming[] | undefined = initialTimings;
  let source: 'edge_native' | 'edge_shadow' | null = timings
    ? 'edge_native'
    : null;

  if (!timings && driver.constructor.name === 'AzureSpeechDriver') {
    const edge = chain.find((d) => d instanceof EdgeTTSDriver);
    if (edge?.isConfigured()) {
      try {
        timings = await edge.captureTimingsOnly(voiceId, spokenText);
        source = 'edge_shadow';
        logger.log(
          `[PIPE] captions chain run=${runId} edge_shadow captured ${timings.length} word timings`,
        );
      } catch (err) {
        logger.warn(
          `[PIPE] captions chain run=${runId} edge_shadow failed (falling through to Whisper): ${(err as Error).message?.slice(0, 200)}`,
        );
      }
    }
  }

  if (!timings || timings.length === 0) {
    return { source: null, count: 0 };
  }

  await client
    .from('content_assets')
    .delete()
    .eq('run_id', runId)
    .eq('kind', 'captions_timings');
  await client.from('content_assets').insert({
    run_id: runId,
    kind: 'captions_timings',
    storage_url: 'inline',
    metadata: {
      words: timings,
      segments: [],
      source: source ?? 'edge_native',
    },
  });

  return { source, count: timings.length };
}

/**
 * Retry TTS on transient failures. Microsoft's edge-tts endpoint returns
 * intermittent WS 403s when a single IP hits it often — those are not
 * permanent errors and retrying after a short delay usually succeeds.
 */
export async function synthesizeWithRetry(
  logger: Logger,
  driver: TTSDriver,
  req: TTSSynthesisRequest,
): Promise<TTSSynthesisResult> {
  const delays = [0, 2000, 5000, 10000, 20000];
  let lastErr: Error | null = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      const jitter = Math.floor(Math.random() * 1000);
      await new Promise((r) => setTimeout(r, delays[i] + jitter));
    }
    try {
      return await driver.synthesize(req);
    } catch (err) {
      lastErr = err as Error;
      const msg = lastErr.message || '';
      const isTransient =
        msg.includes('403') ||
        msg.includes('WSServerHandshakeError') ||
        msg.includes('timeout') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT');
      if (!isTransient || i === delays.length - 1) {
        throw lastErr;
      }
      logger.warn(
        `TTS attempt ${i + 1}/${delays.length} failed (transient), retrying: ${msg.slice(0, 200)}`,
      );
    }
  }
  throw lastErr ?? new Error('synthesize failed after retries');
}
