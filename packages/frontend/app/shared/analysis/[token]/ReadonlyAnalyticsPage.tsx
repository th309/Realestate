"use client";

/**
 * Analytics + market context — page 2 of the PDF / share view.
 *
 * Composes the LIVE section components (ProjectionSection, ExpenseSection,
 * AfterTaxSection, SensitivitySection, MarketContextSection) so the charts
 * and AI insights match the interactive UI exactly. Print CSS in
 * `print-mode.css` compacts them via the stable data-attributes
 * (`[data-section]`, `[data-metric-block]`, `[data-section-ai]`) baked into
 * SectionWrapper / SignatureChart / MetricBlock — hero hero-number blocks
 * and interactive chrome get hidden; chart heights shrink to ~110pt.
 *
 * Falls back gracefully when derived data is missing (older saved
 * analyses without the rich snapshot).
 */

import { ProjectionSection } from "@/app/analyzer/components/sections/ProjectionSection";
import { ExpenseSection } from "@/app/analyzer/components/sections/ExpenseSection";
import { SensitivitySection } from "@/app/analyzer/components/sections/SensitivitySection";
import { MarketContextSection } from "@/app/analyzer/components/sections/MarketContextSection";
import { extractMarketContextProps } from "@/app/analyzer/lib/saved-render-builders";
import type {
  RentalResult,
  FlipResult,
  BrrrrResult,
} from "@propertyiq/analyzer-core";
import type { MarketContext } from "@/lib/data";

interface SectionAiNarratives {
  recommendation_analysis?: string | null;
  projection?: string | null;
  expense_waterfall?: string | null;
  sensitivity?: string | null;
  comps?: string | null;
  after_tax?: string | null;
  market_context?: string | null;
}

interface Props {
  input?: unknown;
  rental?: Partial<RentalResult> | null;
  flip?: FlipResult | null;
  brrrr?: BrrrrResult | null;
  projection?: unknown;
  afterTax?: unknown;
  sensitivity?: unknown;
  expense?: {
    grossRentMonthly: number;
    vacancyMonthly: number;
    opexMonthly: number;
    debtServiceMonthly: number;
  } | null;
  marketContext?: MarketContext | Record<string, unknown> | null;
  arvLocal?: number | null;
  rehabBudget?: number | null;
  activeStrategy?: "buyAndHold" | "flip" | "brrrr";
  marginalTaxRate?: number | null;
  salesComps?: Array<{ distance?: number }>;
  aiNarratives?: SectionAiNarratives;
  disclaimer: string;
}

const staticAi = (text: string | null | undefined) => ({
  aiText: text ?? null,
  aiIsStale: false,
  aiIsLoading: false,
  onRefreshAi: () => {},
});

export function ReadonlyAnalyticsPage(p: Props) {
  const ai = p.aiNarratives ?? {};
  const strategy: "buyAndHold" | "flip" | "brrrr" =
    p.activeStrategy ?? "buyAndHold";
  const marketProps = extractMarketContextProps(p.marketContext);

  const hasProjection = p.projection != null && p.input != null;
  const hasExpense = p.expense != null;
  const hasSensitivity = p.input != null && p.rental != null;
  const hasMarket =
    p.marketContext != null && Object.keys(p.marketContext).length > 0;

  return (
    <section className="pdf-page pdf-page--break stack">
      <h1 className="type-h1">Analytics & Market Context</h1>

      {hasProjection && (
        <ProjectionSection
          input={p.input as never}
          projection={p.projection as never}
          afterTax={p.afterTax as never}
          {...staticAi(ai.projection)}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8pt",
        }}
      >
        {hasExpense && (
          <ExpenseSection
            grossRentMonthly={p.expense!.grossRentMonthly}
            vacancyMonthly={p.expense!.vacancyMonthly}
            opexMonthly={p.expense!.opexMonthly}
            debtServiceMonthly={p.expense!.debtServiceMonthly}
            {...staticAi(ai.expense_waterfall)}
          />
        )}

        {hasSensitivity && (
          <SensitivitySection
            input={p.input as never}
            rental={p.rental as never}
            flip={p.flip ?? null}
            brrrr={p.brrrr ?? null}
            arv={p.arvLocal ?? 0}
            rehabBudget={p.rehabBudget ?? undefined}
            activeStrategy={strategy as never}
            salesComps={p.salesComps ?? []}
            {...staticAi(ai.sensitivity)}
          />
        )}
      </div>

      {hasMarket && (
        <MarketContextSection
          chain={marketProps.chain}
          initialGeoLevel={marketProps.initialGeoLevel}
          fallbackPiq={marketProps.fallbackPiq}
          fallbackHomeValue={marketProps.fallbackHomeValue}
          fallbackHomeValueYoy={marketProps.fallbackHomeValueYoy}
          fallbackRentIndex={marketProps.fallbackRentIndex}
          fallbackMarketHeat={marketProps.fallbackMarketHeat}
          fallbackNetMigration={marketProps.fallbackNetMigration}
          {...staticAi(ai.market_context)}
        />
      )}

      <div>
        <p
          className="type-eyebrow"
          style={{ color: "var(--pdf-ink-faint)", marginBottom: 4 }}
        >
          Sources & Methodology
        </p>
        <p className="type-foot">
          PropertyIQ Score is a cross-sectional percentile rank of demand signal
          across all markets at its level, calibrated so 50 equals the state
          average — built from Zillow ZHVI price momentum and Realtor.com median
          days on market and price-cut share. Cashflow, cap rate, DSCR computed
          from your inputs. Market metrics from Zillow ZHVI/ZORI, BLS, IRS
          migration files. Projections are estimates; actuals will vary.
        </p>
        <p className="type-foot" style={{ marginTop: 4 }}>
          {p.disclaimer}
        </p>
      </div>
    </section>
  );
}
