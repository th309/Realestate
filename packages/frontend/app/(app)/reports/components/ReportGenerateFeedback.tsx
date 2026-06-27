"use client";

import React from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import type { Market } from "./reportBuilderTypes";

interface ReportGenerateFeedbackProps {
  showReportsPaywall: boolean;
  showSignupPrompt: boolean;
  primaryMarket?: Market;
  canGenerate: boolean;
  error: string | null;
  onDismissError: () => void;
}

// Post-generate status area: paywall gate, signup prompt, "pick a market"
// hint, and error banner. Returns a fragment so the parent's `space-y-8`
// spacing applies to each block exactly as before.
export function ReportGenerateFeedback({
  showReportsPaywall,
  showSignupPrompt,
  primaryMarket,
  canGenerate,
  error,
  onDismissError,
}: ReportGenerateFeedbackProps) {
  return (
    <>
      {showReportsPaywall && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <PaywallCard
            type="feature"
            id="reports"
            title="Market Reports"
            description="Generate AI-powered market reports with executive summaries, investment theses, and risk assessments. Upgrade to start generating reports."
          />
        </motion.div>
      )}

      {showSignupPrompt && primaryMarket && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-primary-container/40 p-5 text-center"
        >
          <h3 className="text-base font-semibold text-on-surface mb-1">
            Sign up free to generate your {primaryMarket.name} report
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Create a free account and we&apos;ll bring you right back to this
            report.
          </p>
          <a
            href={`/auth/sign-up?redirect=${encodeURIComponent(
              `/reports?mid=${encodeURIComponent(primaryMarket.id)}&mname=${encodeURIComponent(
                primaryMarket.name,
              )}&mtype=${encodeURIComponent(primaryMarket.type)}${
                primaryMarket.state
                  ? `&mstate=${encodeURIComponent(primaryMarket.state)}`
                  : ""
              }`,
            )}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:bg-primary/90 transition-all"
          >
            Sign up free <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      )}

      {!canGenerate && (
        <p className="text-center text-sm text-on-surface-variant">
          Select at least one market to continue
        </p>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-error-container/30 border border-error/30"
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
          <button
            onClick={onDismissError}
            className="ml-auto text-error hover:text-error/80"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </>
  );
}
