"use client";

/**
 * Vertical stack of analyzer detail sections — projection, expense waterfall,
 * sensitivity, comps, market context, after-tax. Extracted from
 * AnalyzerClient to keep that file under the §1.3 400-line hard limit.
 *
 * Each section receives strategy-derived data + a `sectionAi` slice that
 * provides per-section AI insight props (aiText / aiIsLoading / aiIsStale /
 * onRefreshAi). Sections render the lightbulb only when actual text is
 * present, so a non-Pro user (or one before the AI fetch resolves) won't
 * see empty lightbulb shells.
 */
import type {
  AfterTaxResult,
  BrrrrResult,
  DealInput,
  FlipResult,
  ProjectionResult,
  RentalResult,
} from "@propertyiq/analyzer-core";
import type { MarketContext } from "@/lib/data/fetchers/analyzer";
import { ProjectionSection } from "./sections/ProjectionSection";
import { ExpenseSection } from "./sections/ExpenseSection";
import { SensitivitySection } from "./sections/SensitivitySection";
import { CompsSection } from "./sections/CompsSection";
import type { CompPin } from "./sections/CompsSection";
import { MarketContextSection } from "./sections/MarketContextSection";
import { AfterTaxSection } from "./sections/AfterTaxSection";
import { NotesSection } from "./sections/NotesSection";
import type { Strategy } from "../lib/strategy-tile-mappers";
import type { SectionAiProps } from "../lib/use-section-ai-insights";

interface SectionAiBundle {
  projection: SectionAiProps;
  expense_waterfall: SectionAiProps;
  sensitivity: SectionAiProps;
  comps: SectionAiProps;
  after_tax: SectionAiProps;
}

// `market_context` runs its own per-geo AI fetches inside MarketContextSection
// (one per pill) so it isn't part of the shared sectionAi bundle. Instead the
// parent passes the base payload + enabled flag.
interface MarketContextAi {
  aiPayloadBase: {
    input: unknown;
    result: unknown;
    rentcast: unknown;
  };
  aiEnabled: boolean;
}

interface AnalyzerSectionsProps {
  input: DealInput;
  rental: RentalResult;
  flip: FlipResult | null;
  brrrr: BrrrrResult | null;
  projection: ProjectionResult;
  afterTax: AfterTaxResult;
  arvLocal: number;
  rehabBudget: number;
  activeStrategy: Strategy;
  marginalTaxRate: number;
  // Cashflow strip primitives
  grossRentMonthly: number;
  vacancyMonthly: number;
  opexAnnual: number;
  debtServiceMonthly: number;
  // Comps
  subjectLat: number | null;
  subjectLon: number | null;
  displayAddress: string | null;
  pricePerSqftValues: number[];
  yourPricePerSqft: number;
  subjectPrice: number;
  salesComps: CompPin[];
  rentalComps: CompPin[];
  mapboxToken?: string;
  // Market context (resolved shape, not the quotaExceeded sentinel)
  marketContext: MarketContext | null | undefined;
  // AI bundle for sections that share one payload
  sectionAi: SectionAiBundle;
  // AI plumbing for the per-geo Market Context fetches
  marketContextAi: MarketContextAi;
  // My Notes — controlled by the parent so they ride along on save.
  notes: string;
  shareNotes: boolean;
  onNotesChange: (notes: string, shareNotes: boolean) => void;
  onSaveNotes: () => void;
}

export function AnalyzerSections({
  input,
  rental,
  flip,
  brrrr,
  projection,
  afterTax,
  arvLocal,
  rehabBudget,
  activeStrategy,
  marginalTaxRate,
  grossRentMonthly,
  vacancyMonthly,
  opexAnnual,
  debtServiceMonthly,
  subjectLat,
  subjectLon,
  displayAddress,
  pricePerSqftValues,
  yourPricePerSqft,
  subjectPrice,
  salesComps,
  rentalComps,
  mapboxToken,
  marketContext,
  sectionAi,
  marketContextAi,
  notes,
  shareNotes,
  onNotesChange,
  onSaveNotes,
}: AnalyzerSectionsProps) {
  return (
    <>
      <ProjectionSection
        input={input}
        projection={projection}
        afterTax={afterTax}
        {...sectionAi.projection}
      />
      <ExpenseSection
        grossRentMonthly={grossRentMonthly}
        vacancyMonthly={vacancyMonthly}
        opexMonthly={opexAnnual / 12}
        debtServiceMonthly={debtServiceMonthly}
        {...sectionAi.expense_waterfall}
      />
      <SensitivitySection
        input={input}
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        arv={arvLocal}
        rehabBudget={rehabBudget}
        activeStrategy={activeStrategy}
        salesComps={salesComps}
        {...sectionAi.sensitivity}
      />
      <CompsSection
        subjectLat={subjectLat}
        subjectLon={subjectLon}
        subjectAddress={displayAddress}
        pricePerSqftValues={pricePerSqftValues}
        yourPricePerSqft={yourPricePerSqft}
        subjectPrice={subjectPrice}
        salesComps={salesComps}
        rentalComps={rentalComps}
        mapboxToken={mapboxToken}
        {...sectionAi.comps}
      />
      <MarketContextSection
        chain={marketContext?.chain ?? null}
        initialGeoLevel={marketContext?.geo_level ?? null}
        fallbackPiq={marketContext?.piq_score?.value ?? null}
        fallbackHomeValue={marketContext?.home_value?.value ?? null}
        fallbackHomeValueYoy={marketContext?.home_value_yoy?.value ?? null}
        fallbackRentIndex={marketContext?.rent_index?.value ?? null}
        fallbackMarketHeat={marketContext?.market_heat?.value ?? null}
        fallbackNetMigration={marketContext?.net_migration?.value ?? null}
        aiPayloadBase={marketContextAi.aiPayloadBase}
        aiEnabled={marketContextAi.aiEnabled}
      />
      <AfterTaxSection
        afterTax={afterTax}
        marginalTaxRate={marginalTaxRate}
        {...sectionAi.after_tax}
      />
      <NotesSection
        initialNotes={notes}
        initialShare={shareNotes}
        onChange={onNotesChange}
        onSave={({ notes: n, shareWithClient }) => {
          onNotesChange(n, shareWithClient);
          onSaveNotes();
        }}
      />
    </>
  );
}
