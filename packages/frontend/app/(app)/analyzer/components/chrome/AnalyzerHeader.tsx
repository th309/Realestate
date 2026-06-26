"use client";

import { AnalyzerHeaderActions } from "./AnalyzerHeaderActions";
import {
  buildShareBundle,
  mapStrategyToBestPlay,
} from "../../lib/build-share-bundle";
import { deriveCashflowSummary } from "../../lib/cashflow-summary";

interface Props {
  isPro: boolean;
  headingLabel: string;
  /** useAnalyzerState() return — wider than buildShareBundle's slice; cast internally. */
  state: unknown;
  grading: { data?: unknown };
  compsView: unknown;
  activeStrategy: string;
  activeEngineStrategy: "BUY_AND_HOLD" | "FIX_AND_FLIP" | "BRRRR" | null;
  selectedGoal: string | null;
  displayAddress: string | null;
  paramZip: string | undefined;
  /** Owner "My Notes" free-text — saved into the snapshot. */
  notes: string;
  /** Whether notes are shared on the public link / PDF. */
  shareNotes: boolean;
  /** Receives a "save now" handle so the NotesSection button can persist. */
  onRegisterSave?: (saveNow: (() => Promise<void>) | null) => void;
}

/**
 * Page header: "Deal Analyzer" title + Share/PDF buttons. Pulled out of
 * `AnalyzerClient` to keep that file under the 400-line cap; assembles the
 * share-bundle in one place so the parent just hands data through.
 */
export function AnalyzerHeader(p: Props) {
  const st = p.state as { analyzer: { input: unknown; rental: unknown } };
  const analyzer = st.analyzer;
  const cv = p.compsView as {
    salesComps?: Array<Record<string, unknown>>;
    rentalComps?: Array<Record<string, unknown>>;
    pricePerSqftValues?: number[];
    yourPricePerSqft?: number;
    subjectPrice?: number;
    subjectLat?: number | null;
    subjectLon?: number | null;
  };
  const { grossRentMonthly, debtServiceMonthly, opexAnnual, vacancyMonthly } =
    deriveCashflowSummary(analyzer.input as never, analyzer.rental as never);

  const bundle = buildShareBundle({
    state: p.state as never,
    displayAddress: p.displayAddress,
    subjectLat: cv.subjectLat ?? null,
    subjectLon: cv.subjectLon ?? null,
    paramZip: p.paramZip,
    expense: {
      grossRentMonthly,
      vacancyMonthly,
      opexMonthly: opexAnnual / 12,
      debtServiceMonthly,
    },
    grading: p.grading.data ?? null,
    bestStrategy: mapStrategyToBestPlay(p.activeStrategy),
    activeEngineStrategy: p.activeEngineStrategy,
    goal: p.selectedGoal,
    comps: {
      salesComps: cv.salesComps,
      rentalComps: cv.rentalComps,
      pricePerSqftValues: cv.pricePerSqftValues,
      yourPricePerSqft: cv.yourPricePerSqft,
      subjectPrice: cv.subjectPrice,
    },
    notes: p.notes,
    shareNotes: p.shareNotes,
  });

  return (
    <header className="flex items-center justify-between mb-4 gap-4">
      <h1 className="text-xl md:text-2xl font-bold text-on-surface">
        Deal Analyzer
      </h1>
      <AnalyzerHeaderActions
        isPro={p.isPro}
        headingLabel={p.headingLabel}
        onRegisterSave={p.onRegisterSave}
        {...bundle}
      />
    </header>
  );
}
