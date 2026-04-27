/**
 * Policies for Gate A when not every sentence can be backed solely by MCP JSON.
 *
 * MCP remains the source of truth for PropertyIQ-specific metrics (scores,
 * rents, HUD-style fields present in the bundle).
 *
 * Other verification layers you can add later without changing handler shape:
 * - Census / ACS API lookup for demographic claims
 * - Curated allowlist CSV (metro_id → canonical sentence IDs)
 * - Secondary LLM judge: "flag only claims that contradict the bundle"
 *
 * Those plug in beside {@link waiveUnmatchedLongFormGeneralKnowledge} —
 * compose waivers explicitly and record them on {@link GateResult}.
 */
import type { GateViolation } from './gate.types';

/** Options passed from verify-data handler into DataVerifierService.verify(). */
export interface DataVerifierVerifyOptions {
  /** `content_runs.format` — used for logging; Gate A policies apply to all formats. */
  contentFormat?: string;
}

/**
 * Derived numbers so script phrases like "9.3 million people" match bundle
 * integers such as 9300000 without loosening tolerance heuristics globally.
 */
export function augmentCandidatesWithPopulationScales(nums: number[]): number[] {
  const extra: number[] = [];
  for (const n of nums) {
    if (typeof n === 'number' && Number.isFinite(n)) {
      if (Math.abs(n) >= 100_000) {
        extra.push(n / 1_000_000);
        extra.push(Math.round((n / 1_000_000) * 10) / 10);
      }
    }
  }
  return [...nums, ...extra];
}

/**
 * Calendar date at UTC midnight for `YYYY-MM-DD` prefixes so month-span math
 * does not shift when the Node/TZ offset would change `getDate()` vs ISO
 * date-only strings (common for `score_date` / `period_date` from Postgres).
 */
function parseIsoDay(s: string | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    if (!Number.isFinite(y) || mo < 0 || mo > 11 || d < 1 || d > 31) {
      return null;
    }
    const t = Date.UTC(y, mo, d);
    return Number.isNaN(t) ? null : new Date(t);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole calendar months between two UTC calendar instants (VO "about N months"). */
function wholeMonthsBetween(early: Date, late: Date): number {
  let months =
    (late.getUTCFullYear() - early.getUTCFullYear()) * 12 +
    (late.getUTCMonth() - early.getUTCMonth());
  if (late.getUTCDate() < early.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

function pushFinite(out: number[], n: unknown) {
  if (typeof n === 'number' && Number.isFinite(n)) {
    out.push(n);
    out.push(Math.abs(n));
  }
}

function mergeUnique(nums: readonly number[], extra: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of [...nums, ...extra]) {
    if (!Number.isFinite(n)) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Adds integers implied by the bundle but not always present as a single
 * flattened field — e.g. score point swings from history, month spans
 * between period_date or history points (substantiates "fifteen months"
 * style narration when it matches bundle timelines).
 */
export function augmentCandidatesWithDerivedDeltas(
  payload: unknown,
  nums: readonly number[],
): number[] {
  const extra: number[] = [];
  if (!payload || typeof payload !== 'object') return mergeUnique(nums, extra);

  const b = payload as Record<string, unknown>;
  pushFinite(extra, b.score_delta);

  const score = b.score;
  if (score && typeof score === 'object') {
    const s = score as Record<string, unknown>;
    pushFinite(extra, s.trend_change);
    pushFinite(extra, s.score_delta);
    const cur = s.propertyiq_score;
    const prev = s.previous_score;
    if (typeof cur === 'number' && typeof prev === 'number') {
      extra.push(Math.abs(cur - prev));
    }
    const hist = s.history;
    if (Array.isArray(hist) && typeof cur === 'number') {
      for (const row of hist) {
        const sc = (row as { score?: number }).score;
        if (typeof sc === 'number') {
          extra.push(Math.abs(cur - sc));
        }
      }
    }
    if (Array.isArray(hist) && hist.length >= 2) {
      const dated = hist
        .map((row) => {
          const h = row as { date?: string; score?: number };
          const d = parseIsoDay(h.date);
          if (!d || typeof h.score !== 'number') return null;
          return { d, score: h.score };
        })
        .filter((x): x is { d: Date; score: number } => x != null)
        .sort((a, b) => a.d.getTime() - b.d.getTime());

      if (dated.length >= 2) {
        const first = dated[0];
        const last = dated[dated.length - 1];
        // VO often cites the net move from the oldest to newest PIQ point in
        // the bundled window (e.g. 71 → 83), not only adjacent history rows.
        extra.push(Math.abs(last.score - first.score));
        const span = wholeMonthsBetween(first.d, last.d);
        extra.push(span);
        if (span > 0) {
          extra.push(span - 1, span + 1);
        }
      }

      for (let i = 0; i < hist.length - 1; i++) {
        const a = hist[i] as { date?: string; score?: number };
        const c = hist[i + 1] as { date?: string; score?: number };
        if (typeof a?.score === 'number' && typeof c?.score === 'number') {
          extra.push(Math.abs(a.score - c.score));
        }
        const da = parseIsoDay(a?.date);
        const dc = parseIsoDay(c?.date);
        if (da && dc) {
          const early = da < dc ? da : dc;
          const late = da < dc ? dc : da;
          const mos = wholeMonthsBetween(early, late);
          extra.push(mos);
          if (mos > 0) {
            extra.push(mos - 1, mos + 1);
          }
        }
      }
    }

    // Score-mover: narration spans calendar time between the prior window anchor
    // and the latest score row. That interval is often longer than first→last
    // dates inside the 12-month chart `history` alone, so Gate A must see it as
    // a candidate month count (e.g. "roughly fifteen months" with a 12-point
    // delta vs `previous_score`).
    const priorAnchor = parseIsoDay(
      typeof s.previous_score_date === 'string'
        ? s.previous_score_date
        : undefined,
    );
    let currentAnchor = parseIsoDay(
      typeof s.current_score_date === 'string'
        ? s.current_score_date
        : undefined,
    );
    const histForEnd = s.history;
    if (!currentAnchor && Array.isArray(histForEnd)) {
      for (const row of histForEnd) {
        const d = parseIsoDay((row as { date?: string }).date);
        if (!d) continue;
        if (!currentAnchor || d.getTime() > currentAnchor.getTime()) {
          currentAnchor = d;
        }
      }
    }
    if (
      priorAnchor &&
      currentAnchor &&
      currentAnchor.getTime() >= priorAnchor.getTime()
    ) {
      const wm = wholeMonthsBetween(priorAnchor, currentAnchor);
      extra.push(wm);
      if (wm > 0) {
        extra.push(wm - 1, wm + 1);
      }
    }
  }

  const periodDates: Date[] = [];
  for (const key of ['home_value', 'rent'] as const) {
    const block = b[key] as { period_date?: string } | undefined;
    const pd = parseIsoDay(block?.period_date);
    if (pd) periodDates.push(pd);
  }
  if (periodDates.length >= 2) {
    periodDates.sort((x, y) => x.getTime() - y.getTime());
    const span = wholeMonthsBetween(
      periodDates[0],
      periodDates[periodDates.length - 1],
    );
    extra.push(span);
    if (span > 0) {
      extra.push(span - 1, span + 1);
    }
  }

  return mergeUnique(nums, extra);
}

/**
 * Waive Gate A failures for narrowly-scoped unmatched claims that commonly
 * reference US-wide metro stature — facts that intentionally do not appear in
 * the PIQ MCP snapshot. Used for **every** content format when Gate A runs.
 *
 * Only unmatched violations; never waives contradictory or tolerance failures.
 */
export function waiveUnmatchedLongFormGeneralKnowledge(
  v: GateViolation,
): boolean {
  if (v.reason !== 'unmatched') return false;

  const q = v.claim.quote;
  const cat = v.claim.category;

  const usOrCountryContext =
    /\b(U\.S\.|US|United\s+States|America|nationwide|national|the\s+country|this\s+country|nation)\b/i;
  const usMetroOrdinal =
    usOrCountryContext.test(q) &&
    /\b(1st|2nd|3rd|4th|5th|first|second|third|fourth|fifth)\b/i.test(q) &&
    /\b(largest|biggest)\b/i.test(q) &&
    /\b(metro|MSA|metropolitan(\s+area)?)\b/i.test(q);

  if (cat === 'ranking' && usMetroOrdinal) return true;

  return false;
}
