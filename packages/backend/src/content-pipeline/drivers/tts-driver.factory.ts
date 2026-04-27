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
 *   1. AzureSpeechDriver - official Speech SDK / REST; same voice catalog
 *                           family as Edge with auth + steadier than Edge WS.
 *   2. EdgeTTSDriver - Python edge-tts (Microsoft neural voices); can hit
 *                           IP / WS rate limits.
 *   3. OpenAITTSDriver - paid ($0.030/1K chars on tts-1-hd). Last resort.
 *                           Different voice catalog; the handler swaps to
 *                           voiceId='alloy' when falling through to it.
 *
 * `TTS_PREFER=edge` skips Azure (e.g. offline dev). `provider='openai'` is
 * an explicit paid choice with no fallback.
 *
 * ElevenLabs (`provider='elevenlabs'`) is not wired in this deployment.
 * Rows or templates may still store `elevenlabs` from older seeds; those runs
 * use the same neural chain as `edge` (Azure → Edge → OpenAI). Migration
 * 20260427000100_* updates format defaults to `edge`; this mapping prevents
 * hard failures if the DB row was never migrated.
 *
 * The factory does NOT filter for isConfigured(); the handler does that
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
   * Azure → Edge → OpenAI (or Edge → OpenAI when TTS_PREFER=edge).
   * Shared by `provider='edge'` and legacy `provider='elevenlabs'` rows.
   */
  private neuralMicrosoftTtsDriverChain(): TTSDriver[] {
    const forceEdge = process.env.TTS_PREFER === 'edge';
    if (forceEdge) {
      return [this.edge, this.openai];
    }
    return [this.azure, this.edge, this.openai];
  }

  /**
   * Returns the priority-ordered list of TTS drivers to try for a given
   * provider key. The handler iterates this list, using the first
   * configured driver as the primary and falling through on synthesis
   * failures.
   */
  driverChain(provider: TTSProviderKey): TTSDriver[] {
    if (provider === 'elevenlabs') {
      this.logger.warn(
        "TTS provider key 'elevenlabs' has no ElevenLabs deployment here — using neural Microsoft chain (same as 'edge')",
      );
      return this.neuralMicrosoftTtsDriverChain();
    }
    if (provider === 'openai') {
      // Explicit paid choice: no automatic fallback (caller asked for paid).
      return [this.openai];
    }
    return this.neuralMicrosoftTtsDriverChain();
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
