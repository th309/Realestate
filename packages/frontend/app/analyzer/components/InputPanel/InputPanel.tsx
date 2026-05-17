"use client";
import { useState } from "react";
import type { DealInput, PropertyClass } from "@propertyiq/analyzer-core";
import { NumField } from "./NumField";
import { SliderField } from "./SliderField";
import { RentCastBadge, type RentCastState } from "./RentCastBadge";
import { FetchPropertyDataButton } from "./FetchPropertyDataButton";
import { AdvancedAssumptions } from "./AdvancedAssumptions";
import { StrategyControls, type AnalysisMode } from "./StrategyControls";
import { StrategyGroup } from "./StrategyGroup";
import { CommercialUnderwritingGroup } from "./CommercialUnderwritingGroup";
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
      <div data-property-type-toggle>
        <label className="text-xs uppercase font-semibold text-on-surface-variant block mb-1">
          Property Type
        </label>
        <div className="inline-flex rounded-full overflow-hidden border border-outline-variant">
          {(["sfh", "mf"] as const).map((t) => {
            const isActive = t === propertyType;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPropertyType(t)}
                aria-pressed={isActive}
                className="px-4 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? "var(--md-primary)" : "transparent",
                  color: isActive
                    ? "var(--md-on-primary)"
                    : "var(--md-on-surface-variant)",
                  letterSpacing: "0.04em",
                }}
              >
                {t === "sfh" ? "SFH" : "MF"}
              </button>
            );
          })}
        </div>
        {propertyType === "mf" && (
          <>
            <div className="mt-3">
              <NumField
                label="# of units"
                value={unitCount}
                onChange={setUnitCount}
                placeholder="2"
              />
            </div>
            <div className="mt-2 text-[10px] text-on-surface-variant leading-snug">
              {propertyClass === "commercial_mf"
                ? "5+ units → commercial underwriting (DSCR-sized loan, cap-rate valuation, balloon term)."
                : propertyClass === "small_mf"
                  ? "2–4 units → residential underwriting (HUD/FHA conventions, same loan products as SFH)."
                  : "Enter unit count to determine underwriting class."}
            </div>
          </>
        )}
      </div>

      {onAnalysisModeChange && onStrategyChange && (
        <StrategyControls
          mode={analysisMode}
          onModeChange={onAnalysisModeChange}
          activeStrategy={activeStrategy}
          onStrategyChange={onStrategyChange}
          propertyClass={propertyClass}
        />
      )}

      <div>
        <label className="text-xs uppercase font-semibold text-on-surface-variant block mb-1">
          Property Address
        </label>
        <input
          data-address-input
          type="text"
          value={address}
          onChange={(e) => onAddressChange(e.currentTarget.value)}
          placeholder="123 Main St, Atlanta, GA"
          // The full address is also shown in the PropertyHeader; this title
          // lets a user see it on hover when the input itself is too narrow
          // (e.g. tablet width clips long addresses to '..., MD :').
          title={address}
          className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <FetchPropertyDataButton
        address={address}
        isPro={isPro}
        isPending={isFetching}
        onClick={onFetchProperty}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Price"
          value={input.price > 0 ? input.price : null}
          onChange={(v) => update({ price: v ?? 0 })}
          prefix="$"
          placeholder="350,000"
          badge={<RentCastBadge state={rentCastState} />}
          nudge={input.price > 0 ? nudgeForPrice(input.price) : null}
        />
        {showRent && (
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
        )}
        <NumField
          label="Tax (annual)"
          value={input.taxAnnual}
          onChange={(v) => update({ taxAnnual: v })}
          prefix="$"
          // Treat empty as 0 so the nudge fires its "missing tax data
          // understates expenses" warning — previously the user got no
          // signal at all when this field was blank.
          nudge={
            input.price ? nudgeForTax(input.taxAnnual ?? 0, input.price) : null
          }
        />
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

      {showFlipGroup && assumptions && onAssumptionChange && (
        <StrategyGroup label="Flip carry & exit" chip="FLIP">
          <NumField
            label="Holding months"
            value={assumptions.holdingMonths}
            onChange={(v) => onAssumptionChange("holdingMonths", v ?? 0)}
            placeholder="4"
          />
          <NumField
            label="Selling costs"
            value={Math.round(assumptions.sellingCostsPct * 1000) / 10}
            onChange={(v) =>
              onAssumptionChange("sellingCostsPct", v == null ? 0 : v / 100)
            }
            suffix="%"
            placeholder="7.0"
          />
        </StrategyGroup>
      )}

      {showBrrrrGroup && assumptions && onAssumptionChange && (
        <StrategyGroup label="BRRRR refi & timeline" chip="BRRRR">
          <NumField
            label="Refi LTV"
            value={Math.round(assumptions.refinanceLTVPct * 1000) / 10}
            onChange={(v) =>
              onAssumptionChange("refinanceLTVPct", v == null ? 0 : v / 100)
            }
            suffix="%"
            placeholder="75"
          />
          <NumField
            label="Seasoning months"
            value={assumptions.seasoningMonths}
            onChange={(v) => onAssumptionChange("seasoningMonths", v ?? 0)}
            placeholder="6"
          />
          <NumField
            label="Rehab months"
            value={assumptions.rehabMonths}
            onChange={(v) => onAssumptionChange("rehabMonths", v ?? 0)}
            placeholder="3"
          />
          <NumField
            label="Lease-up months"
            value={assumptions.leaseMonths}
            onChange={(v) => onAssumptionChange("leaseMonths", v ?? 0)}
            placeholder="1"
          />
        </StrategyGroup>
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

      {assumptions && onAssumptionChange && (
        <AdvancedAssumptions
          assumptions={assumptions}
          onChange={onAssumptionChange}
          input={input}
          onInputChange={update}
          onFinancingChange={updateFin}
        />
      )}
    </aside>
  );
}
