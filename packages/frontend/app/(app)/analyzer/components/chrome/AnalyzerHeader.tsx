"use client";

import { MapPin } from "lucide-react";
import { AnalyzerHeaderActions } from "./AnalyzerHeaderActions";
import { DealLabelField } from "./DealLabelField";
import {
  buildShareBundle,
  mapStrategyToBestPlay,
} from "../../lib/build-share-bundle";
import { deriveCashflowSummary } from "../../lib/cashflow-summary";
import type { SaveStatus } from "../../lib/use-deal-autosave";

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
  /** Receives a "save now" handle so the NotesSection button can persist.
   *  Resolves true/false so the caller can tell a real save from a guarded
   *  one (e.g. no resolved property address). */
  onRegisterSave?: (saveNow: (() => Promise<boolean>) | null) => void;
  /** Active strategy, shown in the subline — "Buy & Hold", "BRRRR". */
  strategyLabel?: string;
  /** Saved-deal row id, once one exists. Pass-throughs to AnalyzerHeaderActions. */
  dealId?: string | null;
  saveStatus?: SaveStatus;
  onSaveClick?: () => void;
  onSaved?: (dealId: string) => void;
  /**
   * User-editable deal name. Only rendered (as `DealLabelField`, replacing
   * the static heading) once `dealId` is set — an unsaved analysis has
   * nothing to name yet.
   */
  label?: string | null;
  onLabelChange?: (next: string) => void;
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

  // Spec head: a 23px near-black title over a single subline that says what is
  // loaded and how it is being read. The address used to sit in its own boxed
  // strip below, which spent a full card's height restating one line of text.
  const subline = [p.displayAddress, p.strategyLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {p.dealId ? (
          <DealLabelField
            label={p.label ?? null}
            fallback={p.displayAddress ?? "analysis"}
            onChange={p.onLabelChange ?? (() => {})}
          />
        ) : (
          <h1 className="text-[23px] font-bold leading-tight tracking-[-0.02em] text-piq-ink">
            Deal Analyzer
          </h1>
        )}
        {subline && (
          <p className="mt-0.5 flex items-center gap-[7px] text-[13px] text-piq-body">
            <MapPin
              size={14}
              strokeWidth={2}
              aria-hidden
              className="flex-none text-piq-indigo"
            />
            <span className="min-w-0 truncate">{subline}</span>
          </p>
        )}
      </div>
      <AnalyzerHeaderActions
        isPro={p.isPro}
        headingLabel={p.headingLabel}
        onRegisterSave={p.onRegisterSave}
        dealId={p.dealId}
        label={p.label}
        saveStatus={p.saveStatus}
        onSaveClick={p.onSaveClick}
        onSaved={p.onSaved}
        {...bundle}
      />
    </header>
  );
}
