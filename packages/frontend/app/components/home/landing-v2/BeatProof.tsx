import Link from "next/link";
import { BeatSection } from "./BeatSection";
import { Reveal } from "./Reveal";
import { PrimaryCta } from "./PrimaryCta";

/**
 * Beat 6 — "The Proof" (objection handling: "is it accurate?").
 *
 * One point: the PropertyIQ Score is backtested and validated, so the number
 * means what it claims. Every figure here is a REAL, productionized validation
 * result pulled from the SINGLE SOURCE OF TRUTH — no fabricated testimonials,
 * user counts, or logos. Numbers are reconciled against:
 *  - `packages/frontend/lib/data/validation-claims.ts` (`V4_CLAIMS`): ic3Y 0.27,
 *    alpha3Y_pp 2.28, yearHitRate3Y 100, backtestYears 22, metrosValidated 865,
 *    metroGap3Y $21,741, band means topQuintile3YExcess +0.38 / bottom −1.29.
 *  - `app/(app)/scores/methodology/validation-report.md` §2.1 (metro band table,
 *    2016+ full-formula era) and §1 (45–55 within ±0.2 pp/yr of zero).
 * These are the era-specific (2016+) numbers the shipped methodology page uses,
 * NOT the superseded full-period figures in the raw backtest docs. Governed by
 * the Five Absolute Rules (.claude/skills/piq-validation-report/SKILL.md):
 * predicts 3Y excess vs STATE; every number sourced; no superlatives, no 1Y
 * headline metric, no fabricated confidence intervals.
 *
 * The visual renders the metro band means (pp/yr excess vs state), strictly
 * monotonic, with the midpoint (≈45–55) band highlighted as the calibrated
 * "performs like its state" zero.
 *
 * Lower-middle of the page's fixed indigo→light gradient → dark-on-light, so
 * tone="light" (spec §4.0). Server component; the only client leaf is the
 * shared PrimaryCta. Mono numbers, serif headline, M3 semantic tokens only.
 */

/**
 * Metro score-band means — mean 3Y excess return vs state, pp/yr, 2016+
 * full-formula era. Source: validation-report.md §2.1 / V4_CLAIMS band means.
 */
interface ScoreBand {
  label: string;
  /** Mean 3Y excess return vs state, percentage points per year. */
  excess: number;
  /** The calibrated midpoint band (≈45–55) that lands at ≈0 by design. */
  isMidpoint?: boolean;
}

const SCORE_BANDS: ScoreBand[] = [
  { label: "1–20", excess: -1.29 },
  { label: "21–40", excess: -0.46 },
  { label: "41–60", excess: -0.13, isMidpoint: true },
  { label: "61–80", excess: 0.08 },
  { label: "81–99", excess: 0.38 },
];

interface ProofStat {
  value: string;
  label: string;
}

const PROOF_STATS: ProofStat[] = [
  { value: "0.27", label: "predictive strength (IC), 3-year, at metro level" },
  { value: "100%", label: "of validated years with a positive signal" },
  { value: "22 yrs", label: "of history backtested, 2001 to today" },
];

// --- Visual geometry (pure layout math, no chart library) --------------------
const MAX_ABS = 1.4; // axis half-range; comfortably brackets [-1.29, +0.38]
const BAR_AREA = 132; // px on each side of the zero baseline

function barWidth(excess: number): number {
  return Math.min(Math.abs(excess) / MAX_ABS, 1) * BAR_AREA;
}

function ScoreBandRow({ band }: { band: ScoreBand }) {
  const positive = band.excess >= 0;
  const width = barWidth(band.excess);
  const barColor = positive ? "bg-green-700" : "bg-red-700";
  const valueColor = positive ? "text-green-700" : "text-red-700";
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
        band.isMidpoint ? "bg-primary-container" : ""
      }`}
    >
      <span className="w-14 shrink-0 text-right font-mono text-sm text-on-surface-variant">
        {band.label}
      </span>
      {/* Diverging bar: zero baseline in the middle, negatives grow left. */}
      <div className="relative flex h-6 flex-1 items-center">
        <div
          className="absolute left-1/2 top-0 h-full w-px bg-outline/40"
          aria-hidden
        />
        <div className="flex w-1/2 justify-end pr-px">
          {!positive && (
            <div
              className={`h-3.5 rounded-l-sm ${barColor}`}
              style={{ width: `${width}px` }}
            />
          )}
        </div>
        <div className="flex w-1/2 justify-start pl-px">
          {positive && (
            <div
              className={`h-3.5 rounded-r-sm ${barColor}`}
              style={{ width: `${width}px` }}
            />
          )}
        </div>
      </div>
      <span
        className={`w-20 shrink-0 font-mono text-sm font-medium ${valueColor}`}
      >
        {positive ? "+" : ""}
        {band.excess.toFixed(2)}
      </span>
    </div>
  );
}

function ScoreBandVisual() {
  return (
    <figure className="rounded-xl bg-surface p-6 shadow-sm">
      <figcaption className="mb-1 font-medium text-on-surface">
        Higher scores, higher returns
      </figcaption>
      <p className="mb-5 text-sm text-on-surface-variant">
        Mean 3-year return vs. the market&apos;s own state, by score band
        &mdash; the validated pattern across 865 metros (full-formula era,
        2016&ndash;2023).
      </p>

      <div className="space-y-1.5">
        {SCORE_BANDS.map((band) => (
          <ScoreBandRow key={band.label} band={band} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-outline/30 pt-3 text-xs text-on-surface-variant">
        <span className="font-mono">&minus;1.4pp</span>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2 w-3 rounded-sm bg-primary-container"
            aria-hidden
          />
          Score 45&ndash;55 &asymp; state average
        </span>
        <span className="font-mono">+1.4pp</span>
      </div>
    </figure>
  );
}

export function BeatProof() {
  return (
    <BeatSection id="beat-proof" eyebrow="The proof" tone="light">
      <Reveal>
        <h2 className="font-serif text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
          We backtested it. Here&apos;s what held up.
        </h2>
      </Reveal>

      <Reveal delayMs={70}>
        <p className="mt-5 max-w-2xl text-lg text-on-surface-variant">
          The honest answer to &ldquo;is it accurate?&rdquo; is a 22-year,
          out-of-sample backtest. Markets scoring 45&ndash;55 landed within a
          fifth of a point of zero excess return versus their state. Higher
          scores beat their state; lower scores lagged. The number means what it
          says.
        </p>
      </Reveal>

      <Reveal delayMs={140} className="mt-12">
        <ScoreBandVisual />
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-3">
        {PROOF_STATS.map((stat, index) => (
          <Reveal key={stat.label} delayMs={200 + index * 70}>
            <div className="flex flex-col">
              <div className="font-mono text-4xl font-semibold tracking-tight text-on-surface sm:text-5xl">
                {stat.value}
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                {stat.label}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delayMs={420} className="mt-12">
        <div className="flex flex-col gap-4 border-t border-outline/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {/* TODO(author): real named author + headshot for E-E-A-T — confirm with owner */}
            <p className="text-sm font-medium text-on-surface">
              PropertyIQ Research
            </p>
            <p className="text-sm text-on-surface-variant">
              Methodology, sample sizes, and year-by-year results are published
              in full.
            </p>
          </div>
          <Link
            href="/scores/methodology"
            className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-light"
          >
            Read the full methodology &rarr;
          </Link>
        </div>
      </Reveal>

      <Reveal delayMs={490} className="mt-12">
        <PrimaryCta source="after_proof" />
      </Reveal>
    </BeatSection>
  );
}
