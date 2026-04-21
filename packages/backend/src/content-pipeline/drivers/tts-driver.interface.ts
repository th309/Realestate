import { DriverCost } from './driver-cost.types';

export interface TTSSynthesisRequest {
  text: string;
  voiceId: string;
  outputPath: string;
  format: 'mp3' | 'wav';
}

export interface TTSSynthesisResult {
  durationMs: number;
  bitrate: number;
  cost: DriverCost;
}

export interface TTSDriver {
  readonly provider: 'edge' | 'elevenlabs' | 'openai';
  isConfigured(): boolean;
  synthesize(req: TTSSynthesisRequest): Promise<TTSSynthesisResult>;
}

export const TTS_DRIVER = Symbol('TTSDriver');
