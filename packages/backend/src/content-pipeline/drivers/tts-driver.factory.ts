import { Injectable, Logger } from '@nestjs/common';
import { TTSDriver } from './tts-driver.interface';
import { EdgeTTSDriver } from './edge-tts-driver';
import { AzureSpeechDriver } from './azure-speech-driver';

/**
 * Chooses a TTS driver based on the requested provider. The legacy "edge"
 * provider now prefers AzureSpeechDriver when Azure credentials are set
 * (same voice catalog, no rate limits), and falls back to the free
 * reverse-engineered EdgeTTSDriver when they aren't. This keeps existing
 * runs that specified provider='edge' working in prod without DB migration.
 *
 * Set TTS_PREFER=edge to force the free driver even when Azure is
 * configured (useful for local dev to avoid billing).
 */
@Injectable()
export class TTSDriverFactory {
  private readonly logger = new Logger(TTSDriverFactory.name);

  constructor(
    private readonly edge: EdgeTTSDriver,
    private readonly azure: AzureSpeechDriver,
  ) {
    this.logger.log(
      `[BOOT] AZURE_SPEECH_KEY.len=${(process.env.AZURE_SPEECH_KEY ?? '').length} AZURE_SPEECH_REGION=${process.env.AZURE_SPEECH_REGION ?? '<unset>'} EDGE_TTS_PYTHON=${process.env.EDGE_TTS_PYTHON ?? '<unset>'}`,
    );
  }

  forProvider(provider: 'edge' | 'elevenlabs' | 'openai'): TTSDriver {
    switch (provider) {
      case 'edge': {
        // Hard preference for Azure when configured. edge-tts is reverse-
        // engineered and rate-limited at the IP level — Azure is the same
        // voice catalog with auth + no throttling. `TTS_PREFER=edge` escapes
        // back to the free driver for offline dev only.
        const forceEdge = process.env.TTS_PREFER === 'edge';
        if (!forceEdge && this.azure.isConfigured()) {
          this.logger.log('TTS: AzureSpeechDriver');
          return this.azure;
        }
        if (this.edge.isConfigured()) {
          this.logger.log('TTS: EdgeTTSDriver');
          return this.edge;
        }
        throw new Error(
          'No TTS driver configured. Set AZURE_SPEECH_KEY+AZURE_SPEECH_REGION, or EDGE_TTS_PYTHON.',
        );
      }
      case 'elevenlabs':
        throw new Error('ElevenLabs driver ships in P3');
      case 'openai':
        throw new Error('OpenAI TTS driver ships in P2');
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }
}
