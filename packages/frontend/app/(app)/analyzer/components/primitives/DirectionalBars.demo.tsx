"use client";

/**
 * Storybook-style demo for DirectionalBars — waterfall + tornado layouts with
 * realistic analyzer data.
 *
 * View at /analyzer/dev/directional-bars
 */
import { DirectionalBars, type BarItem } from "./DirectionalBars";
import { piq } from "./piqTokens";

// "Where the Rent Goes" — typical single-family Buy & Hold deal at $2,800/mo rent.
// Result: $312/mo positive cash flow.
const WHERE_THE_RENT_GOES: BarItem[] = [
  {
    label: "Gross rent",
    value: 2800,
    type: "income",
    tooltip: "Monthly rent collected at full occupancy.",
  },
  {
    label: "Vacancy",
    value: -140,
    type: "expense",
    tooltip: "5% vacancy reserve.",
  },
  {
    label: "Maintenance",
    value: -224,
    type: "expense",
    tooltip: "8% of gross rent for ongoing repairs.",
  },
  {
    label: "Property mgmt",
    value: -224,
    type: "expense",
    tooltip: "8% PM fee.",
  },
  {
    label: "Taxes",
    value: -500,
    type: "expense",
    tooltip: "$6,000/yr property tax ÷ 12.",
  },
  {
    label: "Insurance",
    value: -100,
    type: "expense",
    tooltip: "$1,200/yr policy ÷ 12.",
  },
  {
    label: "Debt service",
    value: -1300,
    type: "expense",
    tooltip: "P&I on $300K @ 7.1% over 30yr.",
  },
  {
    label: "Cash flow",
    value: 312,
    type: "result",
    tooltip: "Monthly net after all expenses.",
  },
];

// Sensitivity — six variables sorted by impact magnitude.
// Each row renders symmetric ±value bars from the center axis.
const SENSITIVITY: BarItem[] = [
  {
    label: "Exit cap rate",
    value: 4.2,
    tooltip:
      "±10% exit cap → ±4.2% IRR. Largest sensitivity over 10-year hold.",
  },
  {
    label: "Rent growth",
    value: 3.1,
    tooltip: "±10% rent growth assumption → ±3.1% IRR.",
  },
  {
    label: "Interest rate",
    value: 2.5,
    tooltip: "±10% loan rate at closing → ±2.5% IRR.",
  },
  {
    label: "Vacancy",
    value: 1.8,
    tooltip: "±10% vacancy assumption → ±1.8% IRR.",
  },
  {
    label: "Property tax",
    value: 0.9,
    tooltip: "±10% tax growth → ±0.9% IRR.",
  },
  {
    label: "Insurance",
    value: 0.4,
    tooltip: "±10% insurance growth → ±0.4% IRR.",
  },
];

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

export default function DirectionalBarsDemo() {
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
            DirectionalBars — visual reference
          </h1>
          <p style={{ fontSize: "14px", color: piq.textMuted, margin: 0 }}>
            One D3 component, two layouts: waterfall (sequential vertical) and
            tornado (symmetric horizontal). Hover any bar for the tooltip.
          </p>
        </header>

        <DemoSection
          title="Waterfall — Where the rent goes"
          subtitle="$2,800/mo gross rent decomposed by expense; final indigo bar shows resulting cash flow."
        >
          <DirectionalBars
            data={WHERE_THE_RENT_GOES}
            layout="waterfall"
            currency
            height={320}
          />
        </DemoSection>

        <DemoSection
          title="Waterfall — Connectors disabled"
          subtitle="Same data, `showConnectors={false}`. Less visual noise; useful in dense dashboards."
        >
          <DirectionalBars
            data={WHERE_THE_RENT_GOES}
            layout="waterfall"
            currency
            showConnectors={false}
            height={320}
          />
        </DemoSection>

        <DemoSection
          title="Tornado — Sensitivity ranking"
          subtitle="Six input variables sorted by impact magnitude. Each row's bars mirror at the center axis: red for downside, green for upside."
        >
          <DirectionalBars
            data={SENSITIVITY}
            layout="tornado"
            currency={false}
            height={300}
          />
        </DemoSection>
      </div>
    </main>
  );
}
