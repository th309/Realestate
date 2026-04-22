import { Injectable, Logger } from '@nestjs/common';
import { writeFileSync, statSync } from 'fs';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from './tts-driver.interface';

/**
 * Azure Speech Service driver — drop-in replacement for EdgeTTSDriver.
 * edge-tts is a reverse-engineered client for the same Azure Speech backend,
 * so the voice ids (e.g. "en-US-AndrewMultilingualNeural") are identical.
 * Difference: authenticated requests aren't throttled.
 *
 * Env vars:
 *   AZURE_SPEECH_KEY       — subscription key from the Azure Speech resource
 *   AZURE_SPEECH_REGION    — region short name (e.g. "eastus", "westus")
 */
@Injectable()
export class AzureSpeechDriver implements TTSDriver {
  readonly provider = 'edge' as const;
  private readonly logger = new Logger(AzureSpeechDriver.name);

  isConfigured(): boolean {
    return Boolean(
      process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION,
    );
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    if (!key || !region) {
      throw new Error(
        'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must both be set',
      );
    }

    const format =
      req.format === 'wav'
        ? 'riff-24khz-16bit-mono-pcm'
        : 'audio-24khz-96kbitrate-mono-mp3';
    const mime =
      req.format === 'wav' ? 'application/ssml+xml' : 'application/ssml+xml';

    const ssml = buildSSML(req.voiceId, req.text);
    const start = Date.now();
    const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': mime,
        'X-Microsoft-OutputFormat': format,
        'User-Agent': 'propertyiq-content-pipeline',
      },
      body: ssml,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `azure-speech HTTP ${response.status}: ${body.slice(0, 300) || response.statusText}`,
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());
    writeFileSync(req.outputPath, audio);

    const wallMs = Date.now() - start;
    const sizeBytes = (() => {
      try {
        return statSync(req.outputPath).size;
      } catch {
        return 0;
      }
    })();

    return {
      durationMs: wallMs,
      bitrate: sizeBytes > 0 ? (sizeBytes * 8) / (wallMs / 1000) : 0,
      cost: {
        provider: 'azure-speech',
        // $16 / 1M chars for Neural voices
        amount_usd: (req.text.length * 16) / 1_000_000,
        units: req.text.length,
        unit_type: 'chars',
      },
    };
  }
}

/**
 * Minimal SSML envelope. The backend stores a language-agnostic voice id
 * like "en-US-AndrewMultilingualNeural"; Azure extracts the language
 * automatically from the voice name.
 */
function buildSSML(voiceId: string, text: string): string {
  const lang = voiceId.slice(0, 5) || 'en-US';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  return `<speak version='1.0' xml:lang='${lang}'><voice name='${voiceId}'>${escaped}</voice></speak>`;
}
