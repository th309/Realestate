"use client";

import React from "react";
import { TrendingUp } from "lucide-react";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

interface InvestorDetailsSubsectionProps {
  budgetMin: number | null;
  budgetMax: number | null;
  targetReturn: string;
  targetStates: string[];
  onBudgetMinChange: (val: number | null) => void;
  onBudgetMaxChange: (val: number | null) => void;
  onTargetReturnChange: (val: string) => void;
  onToggleState: (state: string) => void;
}

export function InvestorDetailsSubsection({
  budgetMin,
  budgetMax,
  targetReturn,
  targetStates,
  onBudgetMinChange,
  onBudgetMaxChange,
  onTargetReturnChange,
  onToggleState,
}: InvestorDetailsSubsectionProps) {
  return (
    <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200/50">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-emerald-900">
          Investor Details
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-emerald-800 mb-1.5">
            Budget Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={budgetMin ?? ""}
              onChange={(e) =>
                onBudgetMinChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="$100,000"
            />
            <span className="text-sm text-emerald-600">to</span>
            <input
              type="number"
              value={budgetMax ?? ""}
              onChange={(e) =>
                onBudgetMaxChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="$500,000"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-emerald-800 mb-1.5">
            Target Cash-on-Cash Return %
          </label>
          <input
            type="text"
            value={targetReturn}
            onChange={(e) => onTargetReturnChange(e.target.value)}
            className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
            placeholder="8%"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-emerald-800 mb-1.5">
            Target States
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {US_STATES.map((state) => {
              const isSelected = targetStates.includes(state);
              return (
                <button
                  key={state}
                  type="button"
                  onClick={() => onToggleState(state)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-emerald-500 text-white"
                      : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {state}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
