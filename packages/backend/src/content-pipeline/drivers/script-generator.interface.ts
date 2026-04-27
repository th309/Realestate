// packages/backend/src/content-pipeline/drivers/script-generator.interface.ts
import { ContentFormat, Audience } from '../types';
import { ResolvedMarket } from '../data/content-data.types';
import { DriverCost } from './driver-cost.types';
import type { RankingScript } from '../ranking/ranking-script.schema';

/**
 * A single gate violation surfaced from a prior script-repair attempt.
 * The script generator includes these in the prompt so the LLM addresses
 * them on the next attempt.
 */
export interface ScriptGateViolation {
  quote: string;
  issue: string;
}

export interface ScriptGateFeedback {
  gate: string;
  at?: string;
  violations: ScriptGateViolation[];
}

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
  // Optional window label for score_mover. When present, gets substituted
  // into the prompt's {{window_label}} token. Other formats ignore it.
  windowLabel?: string;
  /**
   * Gate violations from preceding script-repair attempts, ordered oldest
   * first. When present, generators MUST incorporate these as "previous
   * attempt feedback" so the regenerated script directly addresses them.
   */
  priorFeedback?: ScriptGateFeedback[];
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

/** LLM request/response introspection for operators (logs + content_run_events). */
export interface ScriptGenerationDiagnostics {
  /** Runtime LLM vendor (Anthropic Cloud vs DeepSeek Anthropic-compatible API). */
  provider: 'anthropic' | 'deepseek';
  model: string;
  /** max_tokens passed to Messages API for this request. */
  maxOutputTokensRequested: number;
  /** Single-market `emit_script` tool vs top/bottom ranking JSON-in-text. */
  generationPath?: 'emit_script' | 'ranking_json';
  /** Ranking path only: 1-based attempt index that produced a valid script. */
  successfulAttempt?: number;
  /** Ranking path only: configured max retry rounds (attempts = this + 1). */
  maxRankingRetries?: number;
  stopReason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  /** e.g. `tool_use,text` — shows whether the model returned structured tool output. */
  contentBlockTypes?: string[];
  /** Summary of parsed tool_use input before validation (never full script text). */
  toolInputSummary?: Record<string, unknown>;
}

export interface ScriptGenerationResult {
  scripts: ScriptVariant[];
  cost: DriverCost;
  rawLLMResponse: unknown;
  /**
   * Optional Anthropic telemetry for debugging truncation, wrong shape, etc.
   */
  diagnostics?: ScriptGenerationDiagnostics;
  /**
   * For ranking formats only — the structured RankingScript (hooks/rows/outro)
   * the LLM produced. Downstream ranking-aware handlers (render-video,
   * publishers) read this for per-row composition. The `scripts[0]` envelope
   * is a flattened, generic-shape projection that text-only handlers
   * (verify-data, lint-voice, synthesize-audio) can consume without branching.
   */
  ranking?: RankingScript;
}

export const SCRIPT_GENERATOR = Symbol('ScriptGenerator');

export interface ScriptGenerator {
  generate(req: ScriptGenerationRequest): Promise<ScriptGenerationResult>;
}
