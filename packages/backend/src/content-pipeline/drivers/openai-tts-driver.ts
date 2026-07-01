import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { writeFileSync } from 'fs';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from './tts-driver.interface';
import { assertAiBudget } from '../../ai-provider/ai-spend-guard.shared';

// OpenAI TTS pricing per 1K characters (verified 2026-04):
//   tts-1     → $0.015 / 1K chars
//   tts-1-hd  → $0.030 / 1K chars  ← we use tts-1-hd for higher fidelity
// If the model below is swapped to 'tts-1', also drop this constant to 0.015.
const OPENAI_TTS_USD_PER_1K_CHARS = 0.03;

// OpenAI's TTS voice catalog. Different from Azure/Edge — when the synthesize-
// audio handler falls through from Azure/Edge to OpenAI, it overrides the
// stored voiceId with one of these (currently hardcoded to 'alloy' in the
// handler; future work could add a per-voice OpenAI mapping in tts_voices).
type OpenAITTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

@Injectable()
export class OpenAITTSDriver implements TTSDriver {
  readonly provider = 'openai' as const;
  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is required for OpenAITTSDriver');
      }
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult> {
    const start = Date.now();
    // Block-only: TTS is billed per-character, not per-token, so it can't
    // advance the token-based ledger — but the cap still halts it once tripped.
    assertAiBudget();
    const response = await this.getClient().audio.speech.create({
      model: 'tts-1-hd',
      voice: req.voiceId as OpenAITTSVoice,
      input: req.text,
      response_format: req.format === 'wav' ? 'wav' : 'mp3',
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(req.outputPath, buffer);
    const wallMs = Date.now() - start;

    return {
      durationMs: wallMs,
      bitrate: buffer.length > 0 ? (buffer.length * 8) / (wallMs / 1000) : 0,
      cost: {
        provider: 'openai-tts',
        amount_usd: (req.text.length / 1000) * OPENAI_TTS_USD_PER_1K_CHARS,
        units: req.text.length,
        unit_type: 'chars',
      },
    };
  }
}
