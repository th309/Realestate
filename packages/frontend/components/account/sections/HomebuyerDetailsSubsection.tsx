"use client";

import React from "react";
import { Home } from "lucide-react";

const TIMELINE_OPTIONS = [
  { value: "under_6_months", label: "Under 6 months" },
  { value: "6_to_12_months", label: "6-12 months" },
  { value: "1_to_2_years", label: "1-2 years" },
  { value: "researching", label: "Just researching" },
];

interface HomebuyerDetailsSubsectionProps {
  budgetMin: number | null;
  budgetMax: number | null;
  timeline: string | null;
  preApproved: boolean;
  onBudgetMinChange: (val: number | null) => void;
  onBudgetMaxChange: (val: number | null) => void;
  onTimelineChange: (val: string | null) => void;
  onPreApprovedChange: (val: boolean) => void;
}

export function HomebuyerDetailsSubsection({
  budgetMin,
  budgetMax,
  timeline,
  preApproved,
  onBudgetMinChange,
  onBudgetMaxChange,
  onTimelineChange,
  onPreApprovedChange,
}: HomebuyerDetailsSubsectionProps) {
  return (
    <div className="mb-5 p-4 rounded-xl bg-blue-50 border border-blue-200/50">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-blue-900">
          Homebuyer Details
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-blue-800 mb-1.5">
            Target Price Range
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
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="$200,000"
            />
            <span className="text-sm text-blue-600">to</span>
            <input
              type="number"
              value={budgetMax ?? ""}
              onChange={(e) =>
                onBudgetMaxChange(
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="$500,000"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-blue-800 mb-1.5">
            Move-in Timeline
          </label>
          <select
            value={timeline ?? ""}
            onChange={(e) => onTimelineChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Select timeline...</option>
            {TIMELINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={preApproved}
              onClick={() => onPreApprovedChange(!preApproved)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preApproved ? "bg-blue-500" : "bg-on-surface/20"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preApproved ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-blue-800">
              Pre-approved for mortgage
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
