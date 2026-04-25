import { DriverCost } from './driver-cost.types';

export interface CaptionTiming {
  startMs: number;
  endMs: number;
  text: string;
}

export interface CaptionTimingResult {
  segments: CaptionTiming[];
  words: Array<{ startMs: number; endMs: number; word: string }>;
  srt: string;
  cost: DriverCost;
}

export interface CaptionTimer {
  time(audioPath: string): Promise<CaptionTimingResult>;
}

export const CAPTION_TIMER = Symbol('CaptionTimer');
