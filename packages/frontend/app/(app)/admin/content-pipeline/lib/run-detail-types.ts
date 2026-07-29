/**
 * Shape of `GET /api/admin/content-pipeline/runs/:id`.
 *
 * The endpoint is five `select('*')` queries stitched together server-side
 * (`content-pipeline-queries.service.ts` → `getRunDetail`), and `fetchRun`
 * returned `any` until the script editor needed to trust it. These types are
 * deliberately partial: the columns the admin UI actually reads are named, and
 * the rest stays open via index signatures rather than being mirrored
 * exhaustively and drifting from the tables.
 */
import type { PipelineStatus } from "./content-pipeline-api";

/** One generated script. Today only variant A is ever produced. */
export interface ScriptVariant {
  variantId: "A" | "B";
  /** The voice-over text. Holds the raw `{{SHORT_LINK}}` template form. */
  fullText: string;
  hook?: string;
  body?: string;
  cta?: string;
  sceneBreakdown?: Array<{
    sceneKey: string;
    text: string;
    durationHintSec: number;
  }>;
}

export interface ContentAsset {
  id: string;
  kind: string;
  storage_url: string | null;
  metadata: { scripts?: ScriptVariant[] } & Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

/**
 * Format pace, for the script editor's duration meter. `capSeconds` is derived
 * server-side exactly as `synthesize-audio.handler.ts` derives `audioBudgetMs`,
 * so the editor and the pipeline cannot disagree about the limit.
 *
 * `null` for infographic runs, which have no `format_templates` row.
 */
export interface RunScriptBudget {
  capSeconds: number;
  durationSeconds: number;
  audioBufferSeconds: number;
  naturalWpm: number;
}

export interface RunRow {
  id: string;
  status: PipelineStatus;
  format: string;
  market_query: string;
  approval_mode: string;
  status_reason: string | null;
  /** Bumped on every operator script edit; the handlers' staleness epoch. */
  script_revision?: number;
  [key: string]: unknown;
}

export interface RunEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface RunGate {
  gate: string;
  result: string;
  created_at: string;
  details?: Record<string, unknown>;
}

export interface RunDetail {
  run: RunRow;
  assets: ContentAsset[];
  events: RunEvent[];
  gates: RunGate[];
  posts: Array<Record<string, unknown>>;
  scriptBudget: RunScriptBudget | null;
}

/** The script asset's first variant, or null before generate-script has run. */
export function findScriptVariant(
  assets: ContentAsset[] | undefined,
): { asset: ContentAsset; variant: ScriptVariant } | null {
  const asset = assets?.find((a) => a.kind === "script");
  const variant = asset?.metadata?.scripts?.[0];
  return asset && variant ? { asset, variant } : null;
}
