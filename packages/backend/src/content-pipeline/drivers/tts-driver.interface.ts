import { DriverCost } from './driver-cost.types';

export interface TTSSynthesisRequest {
  text: string;
  voiceId: string;
  outputPath: string;
  format: 'mp3' | 'wav';
}

/**
 * Per-word timing emitted natively by the synthesizer (no transcription).
 * Edge TTS streams these via WordBoundary events; Azure SDK emits them
 * during synthesis. OpenAI TTS does NOT — those runs fall through to
 * Whisper transcription in the time-captions handler.
 */
export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TTSSynthesisResult {
  durationMs: number;
  bitrate: number;
  cost: DriverCost;
  /**
   * Native word-level timings captured during synthesis. Populated by
   * drivers that have a word-boundary mechanism (Edge, Azure-via-Edge-
   * shadow). Undefined for drivers without one (OpenAI), in which case
   * the caller falls through to Whisper transcription.
   */
  wordTimings?: WordTiming[];
}

export interface TTSDriver {
  readonly provider: 'edge' | 'elevenlabs' | 'openai';
  isConfigured(): boolean;
  synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult>;
}

export const TTS_DRIVER = Symbol('TTSDriver');
