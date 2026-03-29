"use client";

/**
 * V2 Template Section Wrappers
 *
 * These components bind generic v2 section renderers to specific v2
 * narrative section IDs. Each wraps a V2NarrativeSection, V2VerdictActionsSection,
 * V2WatchMetricsSection, or V2ActionsMonitoringSection with the correct
 * sectionId, title, and icon.
 *
 * They conform to the `SectionComponentProps` interface ({ report: ReportInstance })
 * so they can be used in REPORT_TEMPLATES definitions.
 */

import React from "react";
import {
  Sparkles,
  BarChart3,
  Users,
  Shield,
  Lightbulb,
  GitCompareArrows,
  Layers,
} from "lucide-react";

import type { ReportInstance } from "../../../../types";

// V2 renderers
import { V2NarrativeSection } from "./V2NarrativeSection";
import { V2VerdictActionsSection } from "./V2VerdictActionsSection";
import { V2WatchMetricsSection } from "./V2WatchMetricsSection";
import { V2ActionsMonitoringSection } from "./V2ActionsMonitoringSection";

// ---------------------------------------------------------------------------
// Shared props type (matches SectionComponentProps from templates/index.ts)
// ---------------------------------------------------------------------------

interface SectionWrapperProps {
  report: ReportInstance;
}

// ===========================
// HomeReady v2 Sections
// ===========================

export function V2HomeReadyExecutiveVerdict({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="executive_verdict"
      title="Executive Verdict"
      icon={Sparkles}
    />
  );
}

export function V2HomeReadyMarketDeepDive({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="market_deep_dive"
      title="Market Deep Dive"
      icon={BarChart3}
    />
  );
}

export function V2HomeReadyYourSituation({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="your_situation"
      title="Your Situation"
      icon={Users}
    />
  );
}

export function V2HomeReadyVerdictAndActions({ report }: SectionWrapperProps) {
  return (
    <V2VerdictActionsSection
      report={report}
      sectionId="verdict_and_actions"
      title="Verdict & Actions"
      scoreType="homebuyer"
    />
  );
}

export function V2HomeReadyWhatToWatch({ report }: SectionWrapperProps) {
  return (
    <V2WatchMetricsSection
      report={report}
      sectionId="what_to_watch"
      title="What to Watch"
    />
  );
}

// ===========================
// InvestorEdge v2 Sections
// ===========================

export function V2InvestorExecutiveVerdict({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="executive_verdict"
      title="Executive Verdict"
      icon={Sparkles}
    />
  );
}

export function V2InvestorDeepDive({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="investment_deep_dive"
      title="Investment Deep Dive"
      icon={BarChart3}
    />
  );
}

export function V2InvestorRiskAndResilience({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="risk_and_resilience"
      title="Risk & Resilience"
      icon={Shield}
    />
  );
}

export function V2InvestorThesis({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="investment_thesis"
      title="Investment Thesis"
      icon={Lightbulb}
    />
  );
}

export function V2InvestorActionsAndMonitoring({
  report,
}: SectionWrapperProps) {
  return (
    <V2ActionsMonitoringSection
      report={report}
      sectionId="actions_and_monitoring"
      title="Actions & Monitoring"
    />
  );
}

// ===========================
// Comparison v2 Sections
// ===========================

export function V2ComparisonExecutiveVerdict({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="executive_verdict"
      title="Executive Verdict"
      icon={Sparkles}
    />
  );
}

export function V2ComparisonHeadToHead({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="head_to_head"
      title="Head to Head"
      icon={GitCompareArrows}
    />
  );
}

export function V2ComparisonScenarioAnalysis({ report }: SectionWrapperProps) {
  return (
    <V2NarrativeSection
      report={report}
      sectionId="scenario_analysis"
      title="Scenario Analysis"
      icon={Layers}
    />
  );
}

export function V2ComparisonVerdictAndActions({ report }: SectionWrapperProps) {
  return (
    <V2VerdictActionsSection
      report={report}
      sectionId="verdict_and_actions"
      title="Verdict & Actions"
      scoreType="homebuyer"
    />
  );
}
