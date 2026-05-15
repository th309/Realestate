"use client";
import type { DealInput } from "@propertyiq/analyzer-core";
import { NumField } from "./NumField";
import { SliderField } from "./SliderField";
import { RentCastBadge, type RentCastState } from "./RentCastBadge";
import { FetchPropertyDataButton } from "./FetchPropertyDataButton";
import {
  nudgeForPrice,
  nudgeForRent,
  nudgeForTax,
  nudgeForInsurance,
  nudgeForRate,
  nudgeForArv,
} from "../../lib/nudges";

interface InputPanelProps {
  input: DealInput;
  arv?: number;
  onChange: (next: DealInput) => void;
  onArvChange?: (arv: number) => void;
  address: string;
  onAddressChange: (s: string) => void;
  rentCastState?: RentCastState;
  isPro?: boolean;
  isFetching?: boolean;
  onFetchProperty?: () => void;
}

const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function InputPanel({
  input,
  arv,
  onChange,
  onArvChange,
  address,
  onAddressChange,
  rentCastState = "missing",
  isPro = false,
  isFetching = false,
  onFetchProperty,
}: InputPanelProps) {
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
          value={input.price}
          onChange={(v) => update({ price: v ?? 0 })}
          prefix="$"
          badge={<RentCastBadge state={rentCastState} />}
          nudge={nudgeForPrice(input.price)}
        />
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
        <NumField
          label="Tax (annual)"
          value={input.taxAnnual}
          onChange={(v) => update({ taxAnnual: v })}
          prefix="$"
          nudge={
            input.taxAnnual != null && input.price
              ? nudgeForTax(input.taxAnnual, input.price)
              : null
          }
        />
        <NumField
          label="Insurance (annual)"
          value={input.insuranceAnnual}
          onChange={(v) => update({ insuranceAnnual: v })}
          prefix="$"
          nudge={
            input.insuranceAnnual != null && input.price
              ? nudgeForInsurance(input.insuranceAnnual, input.price)
              : null
          }
        />
        {arv !== undefined && onArvChange && (
          <NumField
            label="ARV (after rehab)"
            value={arv}
            onChange={(v) => onArvChange(v ?? 0)}
            prefix="$"
            nudge={input.price ? nudgeForArv(arv, input.price) : null}
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

      <div className="text-[10px] text-on-surface-variant pt-2 border-t border-outline-variant">
        Initial cash:{" "}
        <span className="font-mono">
          {fmtUsd(
            input.price * input.financing.downPaymentPct +
              input.price * (input.financing.closingCostsPct ?? 0.03),
          )}
        </span>
      </div>
    </aside>
  );
}
