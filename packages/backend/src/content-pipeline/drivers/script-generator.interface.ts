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
