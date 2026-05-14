"use client";

import type { AnalyzerInputState } from "@/lib/analyzer/useAnalyzer";

interface FieldStatus {
  autoFilled?: boolean;
  unavailable?: boolean;
}

interface Props {
  input: AnalyzerInputState;
  fieldStatus: Partial<Record<keyof AnalyzerInputState, FieldStatus>>;
  setField: <K extends keyof AnalyzerInputState>(
    k: K,
    v: AnalyzerInputState[K],
  ) => void;
  setFinancing: (
    k: "downPaymentPct" | "interestRatePct" | "termYears",
    v: number,
  ) => void;
}

function NumField({
  label,
  value,
  onChange,
  status,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
  status?: FieldStatus;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm text-on-surface-variant mb-1 flex items-center gap-2">
        <span>{label}</span>
        {status?.autoFilled && (
          <span className="text-accent text-xs">✓ auto</span>
        )}
        {status?.unavailable && (
          <span className="text-error text-xs">— unavailable</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? 0 : Number(e.target.value))
          }
          placeholder={status?.unavailable ? "enter manually" : ""}
          className="w-full h-10 rounded-md bg-surface border border-outline px-3 font-mono text-on-surface"
        />
        {suffix && (
          <span className="text-on-surface-variant text-sm">{suffix}</span>
        )}
      </div>
    </label>
  );
}

export default function InputForm({
  input,
  fieldStatus,
  setField,
  setFinancing,
}: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-on-surface text-lg mb-3">Inputs</h2>

      <NumField
        label="Price"
        value={input.price}
        onChange={(v) => setField("price", v)}
        suffix="$"
        status={fieldStatus.price}
      />
      <NumField
        label="Rent / month"
        value={input.rentMonthly}
        onChange={(v) => setField("rentMonthly", v)}
        suffix="$"
        status={fieldStatus.rentMonthly}
      />
      <NumField
        label="Property tax / year"
        value={input.taxAnnual}
        onChange={(v) => setField("taxAnnual", v)}
        suffix="$"
        status={fieldStatus.taxAnnual}
      />
      <NumField
        label="Insurance / year"
        value={input.insuranceAnnual}
        onChange={(v) => setField("insuranceAnnual", v)}
        suffix="$"
        status={fieldStatus.insuranceAnnual}
      />
      <NumField
        label="HOA / month"
        value={input.hoaMonthly ?? 0}
        onChange={(v) => setField("hoaMonthly", v)}
        suffix="$"
      />

      <div className="border-t border-outline-variant pt-4 mt-4">
        <h3 className="text-sm uppercase text-on-surface-variant mb-3">
          Financing
        </h3>
        <NumField
          label="Down payment"
          value={Math.round((input.financing.downPaymentPct || 0) * 100)}
          onChange={(v) => setFinancing("downPaymentPct", v / 100)}
          suffix="%"
        />
        <NumField
          label="Interest rate"
          value={input.financing.interestRatePct}
          onChange={(v) => setFinancing("interestRatePct", v)}
          suffix="%"
        />
        <NumField
          label="Term"
          value={input.financing.termYears}
          onChange={(v) => setFinancing("termYears", v)}
          suffix="yr"
        />
      </div>
    </div>
  );
}
