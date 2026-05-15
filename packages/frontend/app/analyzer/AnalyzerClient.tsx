"use client";

import { use, useState } from "react";
import { useEntitlements } from "@/lib/entitlements";
import { ModeProvider } from "./lib/mode-context";
import { ModeToolbar } from "./components/chrome/ModeToolbar";
import { Hero } from "./components/Hero/Hero";
import { StrategyCompare } from "./components/StrategyCompare/StrategyCompare";
import { InputPanel } from "./components/InputPanel/InputPanel";
import { ProjectionSection } from "./components/sections/ProjectionSection";
import { ExpenseSection } from "./components/sections/ExpenseSection";
import { SensitivitySection } from "./components/sections/SensitivitySection";
import { MarketContextSection } from "./components/sections/MarketContextSection";
import { AfterTaxSection } from "./components/sections/AfterTaxSection";
import { NotesSection } from "./components/sections/NotesSection";
import { EditInputsFab } from "./components/chrome/EditInputsFab";
import { useAnalyzerState } from "./lib/use-analyzer-state";
import { buildStrategyCompareProps } from "./lib/strategy-compare-builders";
import {
  fmtPct,
  fmtUsd,
  fmtRatio,
  deriveGradeScore,
} from "./lib/format-helpers";

export default function AnalyzerClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{
    address?: string;
    zip?: string;
    piq_market?: string;
  }>;
}) {
  const params = use(searchParamsPromise);
  const entitlements = useEntitlements();
  const isPro = ["pro", "enterprise", "admin"].includes(
    entitlements.tier ?? "free",
  );

  const state = useAnalyzerState({
    isPro,
    initialAddress: params.address ?? "",
    paramAddress: params.address,
  });
  const {
    analyzer,
    address,
    setAddress,
    arvLocal,
    setArvLocal,
    propertyLookup,
    rentcastData,
    projection,
    sensitivity,
    afterTax,
    breakEven,
    brrrrTimeline,
    aiVerdict,
    isStreaming,
  } = state;
  const { rental, flip, brrrr } = analyzer;

  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);

  const score = deriveGradeScore(rental.capRatePct, rental.dscr);
  const strategyProps = buildStrategyCompareProps({
    rental,
    flip,
    brrrr,
    breakEven,
    brrrrTimeline,
    projection,
  });

  const grossRentMonthly = analyzer.input.rentMonthly ?? 0;
  const debtServiceMonthly = rental.monthlyDebtService;
  const opexAnnual =
    (analyzer.input.taxAnnual ?? 0) +
    (analyzer.input.insuranceAnnual ?? 0) +
    (analyzer.input.hoaMonthly ?? 0) * 12 +
    grossRentMonthly *
      12 *
      ((analyzer.input.maintenancePctOfRent ?? 0.08) +
        (analyzer.input.managementPctOfRent ?? 0.08));
  const vacancyMonthly =
    grossRentMonthly * (analyzer.input.vacancyPctOfRent ?? 0.05);

  const irrBandByYear = projection.yearly
    .filter((y: (typeof projection.yearly)[number]) =>
      [1, 3, 5, 10, 20, 30].includes(y.year),
    )
    .map((y: (typeof projection.yearly)[number]) => ({
      year: y.year,
      value: y.irrToDate,
      bandLow: y.irrToDate * 0.7,
      bandHigh: y.irrToDate * 1.3,
    }));

  const inputPanel = (
    <InputPanel
      input={analyzer.input}
      arv={arvLocal}
      onChange={analyzer.setInput}
      onArvChange={setArvLocal}
      address={address}
      onAddressChange={setAddress}
      isPro={isPro}
      isFetching={propertyLookup.isPending}
      onFetchProperty={() => propertyLookup.mutate({ address })}
      rentCastState={rentcastData ? "fresh" : "missing"}
    />
  );

  return (
    <ModeProvider>
      <main className="min-h-screen bg-surface">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <header className="flex items-center justify-between mb-6 gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-on-surface">
              Deal Analyzer
            </h1>
            <ModeToolbar />
          </header>

          <div className="grid grid-cols-1 md:grid-cols-[62%_38%] gap-6">
            <div className="space-y-6 min-w-0">
              <Hero
                score={score}
                aiText={
                  aiVerdict ||
                  (isPro ? null : "Pro members get a streaming AI verdict.")
                }
                aiIsStreaming={isStreaming}
                kpiTiles={[
                  {
                    label: "Cap Rate",
                    value: fmtPct(
                      rental.capRatePct ? rental.capRatePct / 100 : null,
                    ),
                  },
                  {
                    label: "Cashflow",
                    value:
                      rental.cashflowMonthly != null
                        ? `${fmtUsd(rental.cashflowMonthly)}/mo`
                        : "—",
                  },
                  { label: "DSCR", value: fmtRatio(rental.dscr) },
                  {
                    label: "IRR (10y)",
                    value: fmtPct(projection.horizons.y10.irr),
                  },
                ]}
              />

              <StrategyCompare {...strategyProps} />

              <ProjectionSection projection={projection} />
              <ExpenseSection
                grossRentMonthly={grossRentMonthly}
                vacancyMonthly={vacancyMonthly}
                opexMonthly={opexAnnual / 12}
                debtServiceMonthly={debtServiceMonthly}
              />
              <SensitivitySection
                sensitivity={sensitivity}
                irrBandByYear={irrBandByYear}
              />
              <MarketContextSection
                piqScore={null}
                homeValue={null}
                rentIndex={null}
                marketHeat={null}
                netMigration={null}
              />
              <AfterTaxSection afterTax={afterTax} />
              <NotesSection />
            </div>

            <div className="hidden md:block">
              <div className="sticky top-6">{inputPanel}</div>
            </div>
          </div>
        </div>

        <EditInputsFab
          open={inputsOpenMobile}
          onToggle={() => setInputsOpenMobile((v) => !v)}
        >
          {inputPanel}
        </EditInputsFab>
      </main>
    </ModeProvider>
  );
}
