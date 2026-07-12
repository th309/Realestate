/**
 * GeneratingState
 *
 * Shows a step-based progress indicator while the backend generates
 * a homebuyer or investor report. Thin wrapper over the shared
 * ProgressLoading component (full-screen variant) so the same loader is
 * reused across features.
 */

"use client";

import React from "react";
import { TrendingUp, Database, Newspaper, FileText } from "lucide-react";
import { ReportWithTemplate } from "./types";
import {
  ProgressLoading,
  type ProgressStep,
} from "@/components/ui/ProgressLoading";

// ---------------------------------------------------------------------------
// Progress steps
// ---------------------------------------------------------------------------

export const GENERATION_STEPS: ProgressStep[] = [
  {
    id: "scores",
    label: "Calculating market scores",
    description: "Analyzing market health indicators",
    icon: TrendingUp,
    durationMs: 3000,
  },
  {
    id: "data",
    label: "Gathering data",
    description: "Querying PropertyIQ market data",
    icon: Database,
    durationMs: 10000,
  },
  {
    id: "news",
    label: "Scouting market news",
    description: "Finding recent developments and trends",
    icon: Newspaper,
    durationMs: 15000,
  },
  {
    id: "writing",
    label: "Writing report",
    description: "Generating your personalized report",
    icon: FileText,
    durationMs: 30000,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GeneratingStateProps {
  report: ReportWithTemplate;
  /** Whether the report generation has completed */
  isComplete?: boolean;
  /** Error message if generation failed */
  error?: string | null;
  /** Called when the user wants to retry after an error */
  onRetry?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GeneratingState({
  isComplete = false,
  error,
  onRetry,
}: GeneratingStateProps) {
  return (
    <ProgressLoading
      variant="fullscreen"
      steps={GENERATION_STEPS}
      title="Generating your report"
      subtitle="This usually takes 1-3 minutes."
      footnote="It's safe to leave this page. Your report keeps generating and will be waiting in your reports list."
      completeTitle="Report complete"
      completeSubtitle="Your report is ready."
      errorTitle="Report generation failed"
      isComplete={isComplete}
      error={error}
      onRetry={onRetry}
    />
  );
}
