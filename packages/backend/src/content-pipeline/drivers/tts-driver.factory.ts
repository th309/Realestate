import { Injectable, Logger } from '@nestjs/common';
import { TTSDriver } from './tts-driver.interface';
import { EdgeTTSDriver } from './edge-tts-driver';
import { AzureSpeechDriver } from './azure-speech-driver';
import { OpenAITTSDriver } from './openai-tts-driver';

export type TTSProviderKey = 'edge' | 'elevenlabs' | 'openai';

/**
 * Chooses TTS drivers based on the requested provider AND exposes the
 * priority-ordered fallback chain for the run handler to walk.
 *
 * For provider='edge' (the DB default for new runs) the chain is:
 *
 *   1. AzureSpeechDriver  — free during Azure's preview/free tier; same voice
 *                           catalog as Edge with auth + no IP rate-limiting.
 *   2. EdgeTTSDriver      — free reverse-engineered Microsoft endpoint;
 *                           rate-limited at the IP level, occasional WS-403s.
 *   3. OpenAITTSDriver    — paid ($0.030/1K chars on tts-1-hd). Last resort.
 *                           Different voice catalog; the handler swaps to
 *                           voiceId='alloy' when falling through to it.
 *
 * `TTS_PREFER=edge` skips Azure (useful for offline dev to avoid Azure
 * billing once it leaves free tier). `provider='openai'` is an explicit
 * paid choice with no fallback.
 *
 * The factory does NOT filter for isConfigured() — the handler does that
 * so unconfigured-driver behavior is observable in logs.
 */
@Injectable()
export class TTSDriverFactory {
  private readonly logger = new Logger(TTSDriverFactory.name);

  constructor(
    private readonly edge: EdgeTTSDriver,
    private readonly azure: AzureSpeechDriver,
    private readonly openai: OpenAITTSDriver,
  ) {
    this.logger.log(
      `[BOOT] AZURE_SPEECH_KEY.len=${(process.env.AZURE_SPEECH_KEY ?? '').length} AZURE_SPEECH_REGION=${process.env.AZURE_SPEECH_REGION ?? '<unset>'} EDGE_TTS_PYTHON=${process.env.EDGE_TTS_PYTHON ?? '<unset>'} OPENAI_API_KEY.len=${(process.env.OPENAI_API_KEY ?? '').length}`,
    );
  }

  /**
   * Returns the priority-ordered list of TTS drivers to try for a given
   * provider key. The handler iterates this list, using the first
   * configured driver as the primary and falling through on synthesis
   * failures.
   */
  driverChain(provider: TTSProviderKey): TTSDriver[] {
    if (provider === 'elevenlabs') {
      throw new Error('ElevenLabs driver ships in P3');
    }
    if (provider === 'openai') {
      // Explicit paid choice — no automatic fallback (caller asked for paid).
      return [this.openai];
    }
    // 'edge' is the DB default and the legacy selection — Azure-then-Edge,
    // with OpenAI as a last-resort paid fallback.
    const forceEdge = process.env.TTS_PREFER === 'edge';
    if (forceEdge) {
      return [this.edge, this.openai];
    }
    return [this.azure, this.edge, this.openai];
  }

  /**
   * Convenience: returns the first configured driver in the priority chain
   * for direct use (e.g. tests or admin tooling that don't need fallback).
   * Throws if none are configured.
   */
  forProvider(provider: TTSProviderKey): TTSDriver {
    const chain = this.driverChain(provider);
    const configured = chain.find((d) => d.isConfigured());
    if (!configured) {
      throw new Error(
        `No TTS driver configured for provider='${provider}'. Set AZURE_SPEECH_KEY+AZURE_SPEECH_REGION, EDGE_TTS_PYTHON, or OPENAI_API_KEY.`,
      );
    }
    this.logger.log(`TTS: ${configured.constructor.name}`);
    return configured;
  }
}
