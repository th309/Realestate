import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface HookWinner {
  winnerVariantId: 'A' | 'B';
  lift: number;
  confidence: number;
  aMeanRetention: number;
  bMeanRetention: number;
  aSamples: number;
  bSamples: number;
}

const MIN_SAMPLES_PER_ARM = 50;
const MIN_LIFT = 0.3;
const MIN_CONFIDENCE = 0.95;

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((acc, x) => acc + x, 0) / nums.length;
}

function variance(nums: number[], mu: number): number {
  if (nums.length < 2) return 0;
  const sse = nums.reduce((acc, x) => acc + (x - mu) * (x - mu), 0);
  return sse / (nums.length - 1);
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun approximation for erf → CDF
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    sign *
    (1 -
      (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
        Math.exp(-z * z));
  return 0.5 * (1 + erf);
}

function twoSidedPValueFromZ(z: number): number {
  const pOneSided = 1 - normalCdf(Math.abs(z));
  return Math.min(1, Math.max(0, 2 * pOneSided));
}

function computeWinnerFromRetentionSamples(
  a: number[],
  b: number[],
): HookWinner | null {
  if (a.length < MIN_SAMPLES_PER_ARM || b.length < MIN_SAMPLES_PER_ARM) {
    return null;
  }

  const aMu = mean(a);
  const bMu = mean(b);
  const aVar = variance(a, aMu);
  const bVar = variance(b, bMu);

  const se = Math.sqrt(aVar / a.length + bVar / b.length);
  // If both arms have zero variance but different means, treat as overwhelming
  // evidence (deterministic samples) rather than returning null.
  if (!Number.isFinite(se) || se <= 0) {
    if (aMu === bMu) return null;
    const winnerVariantId: 'A' | 'B' = aMu >= bMu ? 'A' : 'B';
    const winnerMu = winnerVariantId === 'A' ? aMu : bMu;
    const loserMu = winnerVariantId === 'A' ? bMu : aMu;
    const lift = loserMu > 0 ? (winnerMu - loserMu) / loserMu : Infinity;
    if (lift < MIN_LIFT) return null;
    return {
      winnerVariantId,
      lift,
      confidence: 1,
      aMeanRetention: aMu,
      bMeanRetention: bMu,
      aSamples: a.length,
      bSamples: b.length,
    };
  }

  const z = (aMu - bMu) / se;
  const p = twoSidedPValueFromZ(z);
  const confidence = 1 - p;

  const winnerVariantId: 'A' | 'B' = aMu >= bMu ? 'A' : 'B';
  const winnerMu = winnerVariantId === 'A' ? aMu : bMu;
  const loserMu = winnerVariantId === 'A' ? bMu : aMu;
  const lift = loserMu > 0 ? (winnerMu - loserMu) / loserMu : Infinity;

  if (lift < MIN_LIFT) return null;
  if (confidence < MIN_CONFIDENCE) return null;

  return {
    winnerVariantId,
    lift,
    confidence,
    aMeanRetention: aMu,
    bMeanRetention: bMu,
    aSamples: a.length,
    bSamples: b.length,
  };
}

/**
 * Determines the winning hook variant (A/B) for a given format using 7d
 * `avg_retention_pct` pulled into `content_metrics`. Winner requires:
 * - >= 50 samples per arm
 * - >= 30% lift vs loser
 * - >= 95% confidence (two-sided z-test on mean difference, normal approx)
 */
@Injectable()
export class HookABService {
  constructor(private readonly supabase: SupabaseService) {}

  async determineWinner(format: string): Promise<HookWinner | null> {
    const client = this.supabase.getClient();

    const { data: runs } = await client
      .from('content_runs')
      .select('id')
      .eq('format', format);
    const runIds = (runs ?? []).map((r: any) => r.id).filter(Boolean);
    if (runIds.length === 0) return null;

    const { data: posts } = await client
      .from('platform_posts')
      .select('id, hook_variant_id')
      .in('run_id', runIds)
      .eq('status', 'posted')
      .in('hook_variant_id', ['A', 'B']);
    const postIds = (posts ?? []).map((p: any) => p.id).filter(Boolean);
    if (postIds.length === 0) return null;

    const { data: metrics } = await client
      .from('content_metrics')
      .select('platform_post_id, avg_retention_pct')
      .eq('pulled_at_window', '7d')
      .in('platform_post_id', postIds);
    if (!metrics || metrics.length === 0) return null;

    const postToVariant = new Map<string, 'A' | 'B'>();
    for (const p of posts ?? []) {
      const v = p?.hook_variant_id;
      if (p?.id && (v === 'A' || v === 'B')) postToVariant.set(p.id, v);
    }

    const a: number[] = [];
    const b: number[] = [];
    for (const row of metrics) {
      const postId = (row as any)?.platform_post_id as string | undefined;
      const v = postId ? postToVariant.get(postId) : undefined;
      const r = Number((row as any)?.avg_retention_pct);
      if (!v) continue;
      if (!Number.isFinite(r)) continue;
      if (v === 'A') a.push(r);
      if (v === 'B') b.push(r);
    }

    return computeWinnerFromRetentionSamples(a, b);
  }
}

