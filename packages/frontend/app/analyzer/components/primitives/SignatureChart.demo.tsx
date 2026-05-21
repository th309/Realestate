"use client";

/**
 * Storybook-style demo for SignatureChart — three scenarios:
 *   1. Positive 30-year wealth projection (green ascending area)
 *   2. Negative monthly cash flow (red descending line)
 *   3. Flat / volatile market value (indigo near-flat with noise)
 *
 * View at /analyzer/dev/signature-chart
 */
import { SignatureChart, type DataPoint } from "./SignatureChart";
import { piq } from "./piqTokens";

// Deterministic noise via sine — no Math.random so values are stable across renders.
function sineNoise(i: number, freq: number, amp: number, phase = 0): number {
  return Math.sin(i * freq + phase) * amp;
}

// 30-year equity growth from $50K → ~$381K at 7% compounding.
const WEALTH_30Y: DataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  x: i + 1,
  y: Math.round(50_000 * Math.pow(1.07, i)),
}));

// 36 months of monthly cash flow drifting more negative.
const CASHFLOW_36M: DataPoint[] = Array.from({ length: 36 }, (_, i) => ({
  x: i + 1,
  y: Math.round(-200 - i * 8 + sineNoise(i, 0.5, 35)),
}));

// 60 months of home value oscillating around $400K (flat-volatile).
const MARKET_60M: DataPoint[] = Array.from({ length: 60 }, (_, i) => ({
  x: i + 1,
  y: Math.round(
    400_000 +
      sineNoise(i, 0.3, 15_000) +
      sineNoise(i, 1.1, 4_000, 0.7) +
      sineNoise(i, 0.07, 6_000, 2.1),
  ),
}));

function DemoSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2
          className="text-xs font-semibold uppercase"
          style={{ color: piq.textMuted, letterSpacing: "0.14em" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: "13px", color: piq.textMuted, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="rounded-2xl p-6"
        style={{
          background: piq.surface,
          border: `0.5px solid ${piq.border}`,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function SignatureChartDemo() {
  return (
    <main
      className="min-h-screen px-8 py-12"
      style={{ background: piq.canvas, color: piq.textPrimary }}
    >
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="space-y-2">
          <h1
            className="text-3xl font-semibold"
            style={{ color: piq.textPrimary, letterSpacing: "-0.02em" }}
          >
            SignatureChart — visual reference
          </h1>
          <p style={{ fontSize: "14px", color: piq.textMuted, margin: 0 }}>
            Robinhood-grade line/area chart. Hover to scrub. Click range pills
            to slice.
          </p>
        </header>

        <DemoSection
          title="Positive 30-year wealth projection"
          subtitle="Area variant, auto-colored green (last > first). Default range 30Y. Watch the pulsing glow at the endpoint and hover anywhere to scrub."
        >
          <SignatureChart
            data={WEALTH_30Y}
            headlineLabel="Projected equity"
            headlineFormat="currency"
            subLabel={(p) => `Year ${p.x} · ${2024 + Number(p.x)}`}
            variant="area"
          />
        </DemoSection>

        <DemoSection
          title="Negative monthly cash flow"
          subtitle="Line variant, auto-colored red (descending). Custom ranges in months. The dashed baseline at y=0 makes the deficit obvious at a glance."
        >
          <SignatureChart
            data={CASHFLOW_36M}
            headlineLabel="Monthly cash flow"
            headlineFormat="currency"
            subLabel={(p) => `Month ${p.x}`}
            variant="line"
            ranges={[
              { label: "6M", years: 6 },
              { label: "1Y", years: 12 },
              { label: "2Y", years: 24 },
              { label: "3Y", years: 36 },
            ]}
          />
        </DemoSection>

        <DemoSection
          title="Flat / volatile market value"
          subtitle="Area variant, auto-colored indigo (delta within 5% of starting value). Useful for sideways markets where directional color would lie."
        >
          <SignatureChart
            data={MARKET_60M}
            headlineLabel="Estimated market value"
            headlineFormat="currency"
            subLabel={(p) => `Month ${p.x}`}
            variant="area"
            ranges={[
              { label: "1Y", years: 12 },
              { label: "2Y", years: 24 },
              { label: "5Y", years: 60 },
            ]}
          />
        </DemoSection>

        <DemoSection
          title="Override color + line variant"
          subtitle="Same wealth data, but forced to indigo + line-only variant. Demonstrates the manual color override path."
        >
          <SignatureChart
            data={WEALTH_30Y}
            headlineLabel="Projected equity (indigo override)"
            headlineFormat="currency"
            subLabel={(p) => `Year ${p.x}`}
            variant="line"
            color={piq.indigo}
            showBaseline={false}
          />
        </DemoSection>
      </div>
    </main>
  );
}
