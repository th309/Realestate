"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, ChevronRight } from "lucide-react";
import PrioritySelector from "./PrioritySelector";

// ============================================================================
// CURRENCY INPUT HELPERS
// ============================================================================

// Format a number string with commas (e.g., "1234567" -> "1,234,567")
function formatWithCommas(value: string): string {
  // Remove all non-digit characters except decimal point
  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) return "";

  // Split by decimal point if present
  const parts = digits.split(".");
  // Format the integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return parts.join(".");
}

// Handle currency input change - format display but store raw value
function handleCurrencyChange(
  rawValue: string,
  onChange: (key: string, value: string) => void,
  key: string,
): void {
  // Format the input with commas for display
  const formatted = formatWithCommas(rawValue);
  onChange(key, formatted);
}

// ============================================================================
// PERSONALIZATION PANEL
// ============================================================================

interface ReportBuilderPersonalizationPanelProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function ReportBuilderPersonalizationPanel({
  values,
  onChange,
}: ReportBuilderPersonalizationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-outline-variant/30 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4
          hover:bg-surface-container/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-on-surface-variant" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-medium text-on-surface">
              Personalize your report
            </h3>
            <p className="text-xs text-on-surface-variant">
              Optional - Get tailored insights
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 pt-2 border-t border-outline-variant/20">
              {/* Priority Selector */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-on-surface mb-3">
                  What matters most to you? (Pick your top 3)
                </h4>
                <PrioritySelector
                  userType="homebuyer"
                  selected={
                    values.priorities ? JSON.parse(values.priorities) : []
                  }
                  onChange={(priorities) =>
                    onChange("priorities", JSON.stringify(priorities))
                  }
                />
              </div>

              {/* Financial Inputs - all fields merged, all optional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Household income
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      $
                    </span>
                    <input
                      type="text"
                      value={values.income || ""}
                      onChange={(e) =>
                        handleCurrencyChange(e.target.value, onChange, "income")
                      }
                      placeholder="85,000"
                      className="w-full pl-8 pr-4 py-3 rounded-xl
                        bg-surface-container border border-outline-variant/50
                        text-on-surface placeholder:text-on-surface-variant/40
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                        transition-all duration-200"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-on-surface-variant/70">
                    We&apos;ll calculate what you can afford
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Down payment
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      $
                    </span>
                    <input
                      type="text"
                      value={values.downPayment || ""}
                      onChange={(e) =>
                        handleCurrencyChange(
                          e.target.value,
                          onChange,
                          "downPayment",
                        )
                      }
                      placeholder="50,000"
                      className="w-full pl-8 pr-4 py-3 rounded-xl
                        bg-surface-container border border-outline-variant/50
                        text-on-surface placeholder:text-on-surface-variant/40
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                        transition-all duration-200"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-on-surface-variant/70">
                    Savings available for purchase
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Purchase price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      $
                    </span>
                    <input
                      type="text"
                      value={values.purchasePrice || ""}
                      onChange={(e) =>
                        handleCurrencyChange(
                          e.target.value,
                          onChange,
                          "purchasePrice",
                        )
                      }
                      placeholder="450,000"
                      className="w-full pl-8 pr-4 py-3 rounded-xl
                        bg-surface-container border border-outline-variant/50
                        text-on-surface placeholder:text-on-surface-variant/40
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                        transition-all duration-200"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-on-surface-variant/70">
                    Leave blank for median price
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface mb-2">
                    Expected rent
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">
                      $
                    </span>
                    <input
                      type="text"
                      value={values.expectedRent || ""}
                      onChange={(e) =>
                        handleCurrencyChange(
                          e.target.value,
                          onChange,
                          "expectedRent",
                        )
                      }
                      placeholder="2,500"
                      className="w-full pl-8 pr-16 py-3 rounded-xl
                        bg-surface-container border border-outline-variant/50
                        text-on-surface placeholder:text-on-surface-variant/40
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                        transition-all duration-200"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                      /mo
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-on-surface-variant/70">
                    Leave blank for market rent
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
