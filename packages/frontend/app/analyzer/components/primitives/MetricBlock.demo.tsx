"use client";

/**
 * Storybook-style demo for MetricBlock — renders every size and variant on one
 * page so the headline-pattern primitive can be visually verified.
 *
 * To preview:
 *   1. Create a temporary route at app/analyzer/dev/metric-block/page.tsx that
 *      `export default` re-exports this component, OR
 *   2. Import directly into a Storybook story.
 */
import { MetricBlock } from "./MetricBlock";
import { piq } from "./piqTokens";

function DemoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: piq.textMuted, letterSpacing: "0.08em" }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl p-6"
        style={{
          background: piq.surface,
          border: `1px solid ${piq.border}`,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function MetricBlockDemo() {
  return (
    <main
      className="min-h-screen px-8 py-12"
      style={{ background: piq.canvas, color: piq.textPrimary }}
    >
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="space-y-2">
          <h1
            className="text-3xl font-semibold"
            style={{ color: piq.textPrimary, letterSpacing: "-0.02em" }}
          >
            MetricBlock — visual reference
          </h1>
          <p className="text-sm" style={{ color: piq.textMuted }}>
            Every size × variant on one page. Foundation primitive for KPI
            tiles, chart headlines, strategy cards, and Market Context tiles.
          </p>
        </header>

        <DemoSection title="Size scale (sm → md → lg → xl)">
          <div className="grid grid-cols-4 gap-8 items-end">
            <MetricBlock
              label="Small (sm)"
              value={1234}
              format="currency"
              size="sm"
            />
            <MetricBlock
              label="Medium (md)"
              value={1234}
              format="currency"
              size="md"
            />
            <MetricBlock
              label="Large (lg, default)"
              value={1234}
              format="currency"
              size="lg"
            />
            <MetricBlock
              label="Extra large (xl)"
              value={1234}
              format="currency"
              size="xl"
            />
          </div>
        </DemoSection>

        <DemoSection title="Variant: neutral (no directional color)">
          <div className="grid grid-cols-3 gap-8">
            <MetricBlock
              label="Property price"
              value={485000}
              format="currency"
              variant="neutral"
            />
            <MetricBlock
              label="Square feet"
              value={1850}
              format="number"
              decimals={0}
              variant="neutral"
            />
            <MetricBlock
              label="Year built"
              value="1998"
              format="raw"
              variant="neutral"
            />
          </div>
        </DemoSection>

        <DemoSection title="Variant: directional (no threshold — sign-driven)">
          <div className="grid grid-cols-3 gap-8">
            <MetricBlock
              label="Monthly cash flow"
              value={312}
              format="currency"
              variant="directional"
            />
            <MetricBlock
              label="Monthly cash flow"
              value={-187}
              format="currency"
              variant="directional"
            />
            <MetricBlock
              label="Monthly cash flow"
              value={0}
              format="currency"
              variant="directional"
            />
          </div>
        </DemoSection>

        <DemoSection title="Variant: directional (with threshold — three zones)">
          <div className="grid grid-cols-3 gap-8">
            <MetricBlock
              label="Cap rate"
              value={6.8}
              format="percent"
              variant="directional"
              threshold={{ good: 6, warning: 4.5 }}
            />
            <MetricBlock
              label="Cap rate"
              value={5.2}
              format="percent"
              variant="directional"
              threshold={{ good: 6, warning: 4.5 }}
            />
            <MetricBlock
              label="Cap rate"
              value={3.8}
              format="percent"
              variant="directional"
              threshold={{ good: 6, warning: 4.5 }}
            />
          </div>
        </DemoSection>

        <DemoSection title="Variant: score (70+ / 40-69 / 0-39)">
          <div className="grid grid-cols-3 gap-8">
            <MetricBlock
              label="PropertyIQ score"
              value={82}
              format="raw"
              variant="score"
            />
            <MetricBlock
              label="PropertyIQ score"
              value={55}
              format="raw"
              variant="score"
            />
            <MetricBlock
              label="PropertyIQ score"
              value={28}
              format="raw"
              variant="score"
            />
          </div>
        </DemoSection>

        <DemoSection title="With delta + label (positive / negative / flat)">
          <div className="grid grid-cols-3 gap-8">
            <MetricBlock
              label="Cap rate"
              value={6.2}
              format="percent"
              variant="directional"
              threshold={{ good: 6, warning: 4.5 }}
              delta={0.4}
              deltaFormat="percent"
              deltaLabel="vs market avg"
            />
            <MetricBlock
              label="DSCR"
              value={1.18}
              format="ratio"
              variant="directional"
              threshold={{ good: 1.25, warning: 1.0 }}
              delta={-0.07}
              deltaFormat="absolute"
              deltaLabel="vs last refi"
            />
            <MetricBlock
              label="PropertyIQ score"
              value={76}
              format="raw"
              variant="score"
              delta={0}
              deltaFormat="absolute"
              deltaLabel="unchanged"
            />
          </div>
        </DemoSection>

        <DemoSection title="Format coverage (currency, percent, number, ratio, raw)">
          <div className="grid grid-cols-5 gap-8">
            <MetricBlock
              label="Currency"
              value={485000}
              format="currency"
              variant="neutral"
            />
            <MetricBlock
              label="Currency (small)"
              value={48.75}
              format="currency"
              variant="neutral"
            />
            <MetricBlock
              label="Percent"
              value={8.4}
              format="percent"
              variant="neutral"
            />
            <MetricBlock
              label="Ratio"
              value={1.25}
              format="ratio"
              variant="neutral"
            />
            <MetricBlock
              label="Raw (grade)"
              value="A−"
              format="raw"
              variant="neutral"
            />
          </div>
        </DemoSection>

        <DemoSection title="Exact spec test cases">
          <div className="grid grid-cols-2 gap-8">
            <MetricBlock
              label="Monthly cash flow"
              value={312}
              format="currency"
              size="lg"
              variant="directional"
            />
            <MetricBlock
              label="Cap rate"
              value={6.2}
              format="percent"
              size="lg"
              variant="directional"
              threshold={{ good: 6, warning: 4.5 }}
              delta={0.4}
              deltaLabel="vs market avg"
            />
            <MetricBlock
              label="PropertyIQ score"
              value={76}
              format="raw"
              size="md"
              variant="score"
              delta={4}
              deltaLabel="last month"
            />
            <MetricBlock
              label="DSCR"
              value={1.28}
              format="ratio"
              size="lg"
              variant="directional"
              threshold={{ good: 1.25, warning: 1.0 }}
            />
          </div>
        </DemoSection>

        <DemoSection title="Edge cases (null delta, NaN value, zero)">
          <div className="grid grid-cols-3 gap-8">
            <MetricBlock
              label="No delta supplied"
              value={6.2}
              format="percent"
              variant="directional"
              threshold={{ good: 6, warning: 4.5 }}
            />
            <MetricBlock
              label="NaN value (renders —)"
              value={Number.NaN}
              format="currency"
              variant="directional"
            />
            <MetricBlock
              label="Zero cashflow"
              value={0}
              format="currency"
              variant="directional"
            />
          </div>
        </DemoSection>
      </div>
    </main>
  );
}
