import { Injectable } from '@nestjs/common';
import { TTSDriver } from './tts-driver.interface';
import { EdgeTTSDriver } from './edge-tts-driver';

@Injectable()
export class TTSDriverFactory {
  constructor(private readonly edge: EdgeTTSDriver) {}

  forProvider(provider: 'edge' | 'elevenlabs' | 'openai'): TTSDriver {
    switch (provider) {
      case 'edge':
        if (!this.edge.isConfigured())
          throw new Error('Edge TTS not configured');
        return this.edge;
      case 'elevenlabs':
        throw new Error('ElevenLabs driver ships in P3');
      case 'openai':
        throw new Error('OpenAI TTS driver ships in P2');
      default:
        throw new Error(`Unknown TTS provider: ${provider}`);
    }
  }
}
