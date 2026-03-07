/**
 * Detects the AI narrative version and provides typed access to v2 sections.
 *
 * V2 narratives have a `_meta.version` field set to 'v2' and use different
 * section IDs than v1. This module provides detection and safe extraction.
 */

import type { ReportInstance } from "../../../../types";

// ---------------------------------------------------------------------------
// V2 Section Types
// ---------------------------------------------------------------------------

/** Structured action item from v2 verdict_and_actions / actions_and_monitoring */
export interface V2ActionItem {
  action: string;
  rationale: string;
  timeframe: string;
}

/** Structured watch metric from v2 what_to_watch / actions_and_monitoring */
export interface V2WatchMetric {
  metric: string;
  current: string | number;
  threshold: string | number;
  direction: "up" | "down" | "stable";
  rationale: string;
}

/** V2 verdict_and_actions section shape */
export interface V2VerdictAndActions {
  verdict: string;
  actions: V2ActionItem[];
}

/** V2 what_to_watch section shape (HomeReady) */
export interface V2WhatToWatch {
  metrics: V2WatchMetric[];
  scenario: string;
}

/** V2 actions_and_monitoring section shape (InvestorEdge) */
export interface V2ActionsAndMonitoring {
  actions: V2ActionItem[];
  metrics: V2WatchMetric[];
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Check if a report uses v2 narrative format.
 * Checks both ai_narrative and ai_narratives (backend uses singular form).
 */
export function isV2Narrative(report: ReportInstance): boolean {
  const narrative = (report.ai_narrative ?? report.ai_narratives) as Record<
    string,
    any
  > | null;
  return narrative?._meta?.version === "v2";
}

/**
 * Safely extract a v2 narrative section by key.
 * Returns null if not found or not v2.
 */
export function getV2Section(
  report: ReportInstance,
  sectionId: string,
): string | Record<string, any> | null {
  const narrative = (report.ai_narrative ?? report.ai_narratives) as Record<
    string,
    any
  > | null;
  if (!narrative) return null;
  const value = narrative[sectionId];
  if (value === undefined || value === null) return null;
  return value;
}

/**
 * Get a v2 text section (string content).
 */
export function getV2TextSection(
  report: ReportInstance,
  sectionId: string,
): string | null {
  const value = getV2Section(report, sectionId);
  if (typeof value === "string") return value;
  return null;
}

/**
 * Get and parse a v2 JSON section.
 * Handles both pre-parsed objects and JSON strings.
 */
export function getV2JsonSection<T>(
  report: ReportInstance,
  sectionId: string,
): T | null {
  const value = getV2Section(report, sectionId);
  if (!value) return null;

  if (typeof value === "object") return value as T;

  if (typeof value === "string") {
    const trimmed = value
      .trim()
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }

  return null;
}
