"use client";

import { use, useMemo, useState } from "react";
import {
  computeProjection,
  computeSensitivity,
  computeAfterTax,
  computeBrrrrTimeline,
  computeBreakEven,
} from "@propertyiq/analyzer-core";
import { useAnalyzer } from "@/lib/analyzer/useAnalyzer";
import { useEntitlements } from "@/lib/entitlements";
import {
  usePropertyLookup,
  useAiHeaderVerdict,
  type PropertyLookupResult,
} from "@/lib/data";
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

const fmtPct = (v: number | null) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;
const fmtUsd = (v: number | null) =>
  v == null ? "—" : `$${Math.round(v).toLocaleString()}`;
const fmtRatio = (v: number | null) => (v == null ? "—" : v.toFixed(2));

/** Derive a 0-100 grade score from rental metrics. */
function deriveGradeScore(capRatePct: number | null, dscr: number | null) {
  if (capRatePct == null) return 50;
  let score = capRatePct * 8; // 8% cap → 64
  if (dscr != null) score += Math.max(-20, Math.min(20, (dscr - 1) * 30));
  return Math.max(0, Math.min(100, Math.round(score)));
}

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

  const analyzer = useAnalyzer({
    price: 240_000,
    rentMonthly: 2_850,
    taxAnnual: 3_800,
    insuranceAnnual: 1_200,
  });

  const [address, setAddress] = useState(params.address ?? "");
  const [arvLocal, setArvLocal] = useState<number>(300_000);
  const [inputsOpenMobile, setInputsOpenMobile] = useState(false);

  const propertyLookup = usePropertyLookup();
  const rentcastData =
    propertyLookup.data && "avm" in propertyLookup.data
      ? (propertyLookup.data as PropertyLookupResult)
      : null;

  const projection = useMemo(
    () => computeProjection(analyzer.input),
    [analyzer.input],
  );
  const sensitivity = useMemo(
    () => computeSensitivity(analyzer.input),
    [analyzer.input],
  );
  const afterTax = useMemo(
    () => computeAfterTax(analyzer.input),
    [analyzer.input],
  );
  const breakEven = useMemo(
    () => computeBreakEven(analyzer.input),
    [analyzer.input],
  );
  const brrrrTimeline = useMemo(
    () =>
      computeBrrrrTimeline({
        ...analyzer.input,
        arv: arvLocal,
        rehabBudget: 45_000,
      }),
    [analyzer.input, arvLocal],
  );

  const { rental, flip, brrrr } = analyzer;
  const score = deriveGradeScore(rental.capRatePct, rental.dscr);

  const verdictPayload = useMemo(
    () => ({
      input: analyzer.input,
      result: rental,
      rentcast: rentcastData ?? {},
      piq: {},
    }),
    [analyzer.input, rental, rentcastData],
  );
  const { text: aiVerdict, isStreaming } = useAiHeaderVerdict(
    isPro ? verdictPayload : null,
  );

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

  const strategyScores = {
    buyAndHold: {
      irr10: projection.horizons.y10.irr,
      cashflowMonthly: rental.cashflowMonthly ?? 0,
    },
    flip: {
      roiPct: flip?.projectedRoiPct ?? 0,
      projectedProfit: flip?.projectedProfit ?? 0,
    },
    brrrr: {
      score: brrrr?.score ?? 0,
      postRefiCashflow: brrrr?.postRefiCashflowMonthly ?? 0,
    },
  };

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

              <StrategyCompare
                scores={strategyScores}
                cards={[
                  {
                    id: "buyAndHold",
                    title: "Buy & Hold",
                    heroMetric: {
                      label: "Cap Rate",
                      value: fmtPct(
                        rental.capRatePct ? rental.capRatePct / 100 : null,
                      ),
                    },
                    stats: [
                      {
                        label: "Cashflow/mo",
                        value: fmtUsd(rental.cashflowMonthly),
                      },
                      {
                        label: "IRR (10y)",
                        value: fmtPct(projection.horizons.y10.irr),
                      },
                    ],
                  },
                  {
                    id: "flip",
                    title: "Flip",
                    heroMetric: {
                      label: "ROI",
                      value: fmtPct(
                        flip?.projectedRoiPct
                          ? flip.projectedRoiPct / 100
                          : null,
                      ),
                    },
                    stats: [
                      {
                        label: "Profit",
                        value: fmtUsd(flip?.projectedProfit ?? null),
                      },
                    ],
                  },
                  {
                    id: "brrrr",
                    title: "BRRRR",
                    heroMetric: {
                      label: "Score",
                      value: brrrr?.score?.toString() ?? "—",
                    },
                    stats: [
                      {
                        label: "Refi cash-out",
                        value: fmtUsd(brrrr?.refinanceCashOut ?? null),
                      },
                    ],
                  },
                ]}
                fullViews={{
                  buyAndHold: (
                    <div className="text-sm text-on-surface-variant">
                      {fmtUsd(rental.noiAnnual)} NOI; {fmtRatio(rental.dscr)}{" "}
                      DSCR; break-even rent {fmtUsd(breakEven.rentMonthly)}.
                    </div>
                  ),
                  flip: (
                    <div className="text-sm text-on-surface-variant">
                      MAO {fmtUsd(flip?.mao70 ?? null)}; profit{" "}
                      {fmtUsd(flip?.projectedProfit ?? null)}.
                    </div>
                  ),
                  brrrr: (
                    <div className="text-sm text-on-surface-variant">
                      Refi after {brrrrTimeline.monthsToFirstRefi}mo; cash left{" "}
                      {fmtUsd(brrrr?.remainingCashInDeal ?? null)}.
                    </div>
                  ),
                }}
                summaries={[
                  {
                    key: "buyAndHold",
                    title: "Buy & Hold",
                    heroLabel: "Cap Rate",
                    heroValue: fmtPct(
                      rental.capRatePct ? rental.capRatePct / 100 : null,
                    ),
                    full: <div>NOI {fmtUsd(rental.noiAnnual)}</div>,
                    summary: [
                      {
                        label: "Cashflow",
                        value: `${fmtUsd(rental.cashflowMonthly)}/mo`,
                      },
                    ],
                  },
                  {
                    key: "flip",
                    title: "Flip",
                    heroLabel: "ROI",
                    heroValue: fmtPct(
                      flip?.projectedRoiPct ? flip.projectedRoiPct / 100 : null,
                    ),
                    full: <div>MAO {fmtUsd(flip?.mao70 ?? null)}</div>,
                    summary: [
                      {
                        label: "Profit",
                        value: fmtUsd(flip?.projectedProfit ?? null),
                      },
                    ],
                  },
                  {
                    key: "brrrr",
                    title: "BRRRR",
                    heroLabel: "Score",
                    heroValue: brrrr?.score?.toString() ?? "—",
                    full: (
                      <div>Refi after {brrrrTimeline.monthsToFirstRefi}mo</div>
                    ),
                    summary: [
                      {
                        label: "Cash left",
                        value: fmtUsd(brrrr?.remainingCashInDeal ?? null),
                      },
                    ],
                  },
                ]}
              />

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
              <div className="sticky top-6">
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
              </div>
            </div>
          </div>
        </div>

        <EditInputsFab
          open={inputsOpenMobile}
          onToggle={() => setInputsOpenMobile((v) => !v)}
        >
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
        </EditInputsFab>
      </main>
    </ModeProvider>
  );
}
