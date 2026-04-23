// packages/backend/src/content-pipeline/drivers/script-generator.interface.ts
import { ContentFormat, Audience } from '../types';
import { ResolvedMarket } from '../data/content-data.types';
import { DriverCost } from './driver-cost.types';

export interface ScriptGenerationRequest {
  format: ContentFormat;
  audience: Audience;
  resolvedMarket: ResolvedMarket;
  dataBundle: unknown;
  variantCount: 1 | 2;
  ctaText: string;
  // Video length for this format. Drives the audio budget and word target so
  // scripts finish naturally inside the video.
  videoDurationSeconds: number;
  // Audio has to finish before the video ends, with a buffer. This is the
  // actual cap the voice-over must fit inside.
  audioBudgetSeconds: number;
  // Target word count at a natural (not rushed) delivery pace. Sent to the
  // LLM so it writes to fit rather than getting truncated at render.
  wordBudget: number;
  // Narration pace the word budget was computed from. Included so prompts
  // can reference the pace directly in their guidance text.
  naturalWpm: number;
  styleReferenceAttributes?: Record<string, unknown>;
  extraDirectives?: string;
}

export interface ScriptVariant {
  variantId: 'A' | 'B';
  hook: string;
  body: string;
  cta: string;
  fullText: string;
  sceneBreakdown: Array<{
    sceneKey: string;
    text: string;
    durationHintSec: number;
  }>;
}

export interface ScriptGenerationResult {
  scripts: ScriptVariant[];
  cost: DriverCost;
  rawLLMResponse: unknown;
}

export const SCRIPT_GENERATOR = Symbol('ScriptGenerator');

export interface ScriptGenerator {
  generate(req: ScriptGenerationRequest): Promise<ScriptGenerationResult>;
}
