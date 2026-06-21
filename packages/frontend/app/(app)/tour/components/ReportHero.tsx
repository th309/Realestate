"use client";

import { ScoreGauge } from "./charts/ScoreGauge";
import { Sparkline } from "./charts/Sparkline";
import type { HeroKpi, HeroScore } from "./listing-sections/adapt-hero";

interface Props {
  marketName: string;
  score: HeroScore | null;
  verdict: string;
  kpis: HeroKpi[];
  generatedAt: string;
  /** Persona framing; defaults to the agent (market-intelligence) copy. */
  eyebrow?: string;
  reportLabel?: string;
}

/**
 * ReportHero — the finale's above-the-fold conversion moment. An indigo
 * masthead, then the PropertyIQ Score gauge + plain-English verdict, then a row
 * of KPI tiles with sparklines. Built to read as a premium intelligence
 * dossier the instant it loads.
 */
export function ReportHero({
  marketName,
  score,
  verdict,
  kpis,
  generatedAt,
  eyebrow = "PropertyIQ · Market Intelligence",
  reportLabel = "Market Intelligence Report",
}: Props) {
  const monthYear = new Date(generatedAt).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      {/* Masthead */}
      <header className="relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-on-primary-container via-primary to-secondary px-6 pb-9 pt-10 text-white md:px-12 md:pt-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-white/75">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-[32px] font-semibold leading-[1.05] tracking-tight md:text-[44px]">
            {marketName}
          </h1>
          <p className="mt-2 text-[14px] text-white/80 md:text-[15px]">
            {reportLabel} · {monthYear}
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-tertiary"
            />
            PropertyIQ Score · validated out-of-sample across 925 metros
          </p>
        </div>
      </header>

      {/* Verdict: score gauge + plain-English read */}
      {score && (
        <div className="grid items-center gap-7 border-b border-outline-variant/40 bg-surface px-6 py-9 md:grid-cols-[auto_1fr] md:px-12">
          <div className="flex flex-col items-center text-center">
            <ScoreGauge score={score.score} size={172} />
            <p className="mt-3 font-serif text-lg font-semibold text-on-surface">
              {score.label}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-1 text-[11px] text-on-surface-variant">
              <span className="font-semibold text-on-primary-container">
                Confidence {score.confidenceLetter}
              </span>
              · {score.confidencePercent}% coverage
            </p>
          </div>
          {verdict && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                The verdict
              </p>
              <p className="mt-2 font-serif text-[20px] leading-[1.42] text-on-surface md:text-[23px]">
                {verdict}
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPI tiles */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-b border-outline-variant/40 bg-surface-container-low px-6 py-6 md:grid-cols-4 md:px-12">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.label} kpi={kpi} />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTile({ kpi }: { kpi: HeroKpi }) {
  const hasDelta = typeof kpi.deltaPct === "number";
  const up = (kpi.deltaPct ?? 0) >= 0;
  const accent = kpi.favorable ? "var(--md-tertiary)" : "var(--md-error)";

  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
      <p className="text-[10.5px] font-medium uppercase tracking-wide text-on-surface-variant">
        {kpi.label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-semibold leading-none text-on-surface">
          {kpi.value}
        </span>
        {kpi.sub && (
          <span className="text-[11px] text-on-surface-variant">{kpi.sub}</span>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {hasDelta ? (
          <span
            className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold"
            style={{ color: accent }}
          >
            {up ? "▲" : "▼"} {Math.abs(kpi.deltaPct as number).toFixed(1)}%
          </span>
        ) : (
          <span />
        )}
        {kpi.spark && (
          <Sparkline
            values={kpi.spark}
            width={76}
            height={24}
            stroke={accent}
          />
        )}
      </div>
    </div>
  );
}
