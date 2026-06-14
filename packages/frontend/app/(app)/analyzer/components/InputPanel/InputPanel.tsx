"use client";
import { useState } from "react";
import type {
  BrrrrResult,
  DealInput,
  FlipResult,
  PropertyClass,
  RentalResult,
} from "@propertyiq/analyzer-core";
import { NumField } from "./NumField";
import { SliderField } from "./SliderField";
import { RentCastBadge, type RentCastState } from "./RentCastBadge";
import { FetchPropertyDataButton } from "./FetchPropertyDataButton";
import { AdvancedAssumptions } from "./AdvancedAssumptions";
import { StrategyControls, type AnalysisMode } from "./StrategyControls";
import { StrategyFields } from "./StrategyFields";
import { CommercialUnderwritingGroup } from "./CommercialUnderwritingGroup";
import { MetricMathPanel } from "./MetricMathPanel";
import { PropertyTypeToggle } from "./PropertyTypeToggle";
import {
  nudgeForPrice,
  nudgeForRent,
  nudgeForTax,
  nudgeForInsurance,
  nudgeForRate,
  nudgeForArv,
} from "../../lib/nudges";
import type { Strategy } from "../../lib/strategy-tile-mappers";
import type { AnalyzerAssumptions } from "../../lib/analyzer-assumptions";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { FieldProvenance } from "./FieldProvenance";
import { isDivergent, type ProvenanceMap } from "../../lib/use-analyzer-state";
import type { AddressSuggestion } from "@/lib/data";

type PropertyType = "sfh" | "mf";

interface InputPanelProps {
  input: DealInput;
  arv?: number;
  onChange: (next: DealInput) => void;
  onArvChange?: (arv: number) => void;
  rehabBudget?: number;
  onRehabBudgetChange?: (v: number) => void;
  assumptions?: AnalyzerAssumptions;
  onAssumptionChange?: <K extends keyof AnalyzerAssumptions>(
    key: K,
    value: AnalyzerAssumptions[K],
  ) => void;
  address: string;
  onAddressChange: (s: string) => void;
  rentCastState?: RentCastState;
  isPro?: boolean;
  isFetching?: boolean;
  onFetchProperty?: () => void;
  /** Active strategy — drives which inputs are visible (B&H hides ARV/Rehab, Flip hides Rent, etc.). */
  activeStrategy?: Strategy;
  /** Analysis mode — "compare" overrides activeStrategy and shows ALL fields. */
  analysisMode?: AnalysisMode;
  onAnalysisModeChange?: (m: AnalysisMode) => void;
  onStrategyChange?: (s: Strategy) => void;
  /** Property type controlled by parent (drives propertyClass derivation). */
  propertyType?: PropertyType;
  onPropertyTypeChange?: (t: PropertyType) => void;
  unitCount?: number | null;
  onUnitCountChange?: (n: number | null) => void;
  /** Derived class — when "commercial_mf", commercial input group is shown and Flip/BRRRR strategies are hidden. */
  propertyClass?: PropertyClass;
  /** Computed rental/flip/BRRRR results — drives the math-derivation panel
   *  that sits below the inputs and shows the underwriting waterfall. */
  rental?: RentalResult | null;
  flip?: FlipResult | null;
  brrrr?: BrrrrResult | null;
  provenance?: ProvenanceMap;
  onAddressSelect?: (s: AddressSuggestion) => void;
}

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function InputPanel({
  input,
  arv,
  onChange,
  onArvChange,
  rehabBudget,
  onRehabBudgetChange,
  assumptions,
  onAssumptionChange,
  address,
  onAddressChange,
  rentCastState = "missing",
  isPro = false,
  isFetching = false,
  onFetchProperty,
  activeStrategy = "buyAndHold",
  analysisMode = "focused",
  onAnalysisModeChange,
  onStrategyChange,
  propertyType: propertyTypeProp,
  onPropertyTypeChange,
  unitCount: unitCountProp,
  onUnitCountChange,
  propertyClass = "sfh",
  rental,
  flip,
  brrrr,
  provenance = {},
  onAddressSelect,
}: InputPanelProps) {
  // Fall back to uncontrolled local state when parent doesn't supply propertyType
  // (keeps existing tests working). When parent passes the prop, that wins.
  const [localType, setLocalType] = useState<PropertyType>("sfh");
  const [localUnits, setLocalUnits] = useState<number | null>(1);
  const propertyType = propertyTypeProp ?? localType;
  const unitCount = unitCountProp !== undefined ? unitCountProp : localUnits;
  const setPropertyType = onPropertyTypeChange ?? setLocalType;
  const setUnitCount = onUnitCountChange ?? setLocalUnits;

  // Commercial MF restricts strategy choice — only Buy & Hold applies (you
  // don't flip a 50-unit building), so Flip/BRRRR groups are hidden and the
  // Commercial Underwriting group is shown instead.
  const isCompare = analysisMode === "compare";
  const isCommercial = propertyClass === "commercial_mf";
  const showRent = isCompare || activeStrategy !== "flip";
  const showArv =
    !isCommercial &&
    (isCompare || activeStrategy !== "buyAndHold") &&
    arv !== undefined &&
    onArvChange !== undefined;
  const showRehab =
    !isCommercial &&
    (isCompare || activeStrategy === "flip" || activeStrategy === "brrrr") &&
    rehabBudget !== undefined &&
    onRehabBudgetChange !== undefined;
  const showFlipGroup =
    !isCommercial && (isCompare || activeStrategy === "flip");
  const showBrrrrGroup =
    !isCommercial && (isCompare || activeStrategy === "brrrr");
  const update = (patch: Partial<DealInput>) =>
    onChange({ ...input, ...patch });
  const updateFin = (patch: Partial<DealInput["financing"]>) =>
    onChange({ ...input, financing: { ...input.financing, ...patch } });

  return (
    <aside
      data-input-panel
      data-input-panel-sticky
      className="rounded-2xl bg-surface border border-outline-variant p-5 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto"
    >
      <PropertyTypeToggle
        propertyType={propertyType}
        setPropertyType={setPropertyType}
        unitCount={unitCount}
        setUnitCount={setUnitCount}
        propertyClass={propertyClass}
      />

      {onAnalysisModeChange && onStrategyChange && (
        <StrategyControls
          mode={analysisMode}
          onModeChange={onAnalysisModeChange}
          activeStrategy={activeStrategy}
          onStrategyChange={onStrategyChange}
          propertyClass={propertyClass}
        />
      )}

      <AddressAutocomplete
        value={address}
        onChange={onAddressChange}
        onSelect={onAddressSelect ?? (() => {})}
      />

      <FetchPropertyDataButton
        address={address}
        isPro={isPro}
        isPending={isFetching}
        onClick={onFetchProperty}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <NumField
            label="Price"
            value={input.price > 0 ? input.price : null}
            onChange={(v) => update({ price: v ?? 0 })}
            prefix="$"
            placeholder="350,000"
            badge={<RentCastBadge state={rentCastState} />}
            nudge={input.price > 0 ? nudgeForPrice(input.price) : null}
          />
          <FieldProvenance
            data={provenance.price}
            current={input.price}
            divergent={isDivergent(
              provenance.price?.baseline ?? null,
              input.price,
            )}
          />
        </div>
        {showRent && (
          <div>
            <NumField
              label="Monthly Rent"
              value={input.rentMonthly}
              onChange={(v) => update({ rentMonthly: v })}
              prefix="$"
              badge={<RentCastBadge state={rentCastState} />}
              nudge={
                input.rentMonthly && input.price
                  ? nudgeForRent(input.rentMonthly, input.price)
                  : null
              }
            />
            <FieldProvenance
              data={provenance.rentMonthly}
              current={input.rentMonthly}
              divergent={isDivergent(
                provenance.rentMonthly?.baseline ?? null,
                input.rentMonthly,
              )}
            />
          </div>
        )}
        <div>
          <NumField
            label="Tax (annual)"
            value={input.taxAnnual}
            onChange={(v) => update({ taxAnnual: v })}
            prefix="$"
            // Treat empty as 0 so the nudge fires its "missing tax data
            // understates expenses" warning — previously the user got no
            // signal at all when this field was blank.
            nudge={
              input.price
                ? nudgeForTax(input.taxAnnual ?? 0, input.price)
                : null
            }
          />
          <FieldProvenance
            data={provenance.taxAnnual}
            current={input.taxAnnual}
            divergent={isDivergent(
              provenance.taxAnnual?.baseline ?? null,
              input.taxAnnual,
            )}
          />
        </div>
        <div>
          <NumField
            label="Insurance (annual)"
            value={input.insuranceAnnual}
            onChange={(v) => update({ insuranceAnnual: v })}
            prefix="$"
            nudge={
              input.price
                ? nudgeForInsurance(input.insuranceAnnual ?? 0, input.price)
                : null
            }
          />
          <FieldProvenance
            data={provenance.insuranceAnnual}
            current={input.insuranceAnnual}
            divergent={isDivergent(
              provenance.insuranceAnnual?.baseline ?? null,
              input.insuranceAnnual,
            )}
          />
        </div>
        {showArv && (
          <NumField
            label="ARV (after rehab)"
            value={(arv ?? 0) > 0 ? (arv as number) : null}
            onChange={(v) => onArvChange!(v ?? 0)}
            prefix="$"
            placeholder="395,000"
            nudge={
              (arv ?? 0) > 0 && input.price > 0
                ? nudgeForArv(arv as number, input.price)
                : null
            }
          />
        )}
        {showRehab && (
          <NumField
            label="Rehab Budget"
            value={(rehabBudget ?? 0) > 0 ? (rehabBudget as number) : null}
            onChange={(v) => onRehabBudgetChange!(v ?? 0)}
            prefix="$"
            placeholder="45,000"
          />
        )}
      </div>

      <div className="space-y-3 pt-2 border-t border-outline-variant">
        <SliderField
          label="Down Payment"
          min={0}
          max={1}
          step={0.05}
          value={input.financing.downPaymentPct}
          onChange={(v) => updateFin({ downPaymentPct: v })}
          format={fmtPct}
        />
        <SliderField
          label="Interest Rate"
          min={3}
          max={12}
          step={0.1}
          value={input.financing.interestRatePct}
          onChange={(v) => updateFin({ interestRatePct: v })}
          format={(v) => `${v.toFixed(1)}%`}
        />
        <SliderField
          label="Term (years)"
          min={10}
          max={40}
          step={1}
          value={input.financing.termYears}
          onChange={(v) => updateFin({ termYears: v })}
          format={(v) => `${v} yr`}
        />
      </div>

      {isCommercial && assumptions && onAssumptionChange && (
        <CommercialUnderwritingGroup
          assumptions={assumptions}
          onChange={onAssumptionChange}
          termYears={input.financing.termYears}
          unitCount={unitCount}
        />
      )}

      {assumptions && onAssumptionChange && (
        <StrategyFields
          assumptions={assumptions}
          onAssumptionChange={onAssumptionChange}
          showFlipGroup={showFlipGroup}
          showBrrrrGroup={showBrrrrGroup}
        />
      )}

      <div className="text-[10px] text-on-surface-variant pt-2 border-t border-outline-variant">
        Initial cash:{" "}
        <span className="font-mono">
          {fmtUsd(
            input.price * input.financing.downPaymentPct +
              input.price * (input.financing.closingCostsPct ?? 0.03),
          )}
        </span>
      </div>

      <MetricMathPanel
        input={input}
        rental={rental}
        flip={flip}
        brrrr={brrrr}
        activeStrategy={activeStrategy}
        arvLocal={arv ?? 0}
        rehabBudget={rehabBudget ?? 0}
        assumptions={assumptions}
      />

      {assumptions && onAssumptionChange && (
        <AdvancedAssumptions
          assumptions={assumptions}
          onChange={onAssumptionChange}
          input={input}
          onInputChange={update}
          onFinancingChange={updateFin}
          provenance={provenance}
        />
      )}
    </aside>
  );
}
