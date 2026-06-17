"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  DollarSign,
  Clock,
  TrendingUp,
  Wallet,
  BarChart3,
  Key,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Database,
  FileText,
} from "lucide-react";
import Link from "next/link";
import {
  fetchMarketAnalysis,
  type MarketAnalysisSection,
  type MarketAnalysisResult,
} from "@/lib/data";
import { useEntitlements } from "@/lib/entitlements";
import {
  ProgressLoading,
  type ProgressStep,
} from "@/components/ui/ProgressLoading";
import { generateTemplateAnalysis } from "./market-analysis-template";

interface AIMarketAnalysisProps {
  geoType: string;
  geoId: string;
  marketName: string;
  view: "homebuyer" | "investor";
  metrics: Record<
    string,
    {
      value: number | null;
      formattedValue: string;
      percentChange: number | null;
    }
  >;
  scores: {
    propertyiq: { score: number; grade: string } | null;
  };
  lastUpdated: string;
}

const HOMEBUYER_ICONS = [DollarSign, Clock, TrendingUp];
const INVESTOR_ICONS = [Wallet, BarChart3, Key];

// ---------------------------------------------------------------------------
// (generateTemplateAnalysis moved to ./market-analysis-template for file-size
//  compliance — CLAUDE.md Section 1.3)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Loading steps (shown during the ~30s AI generation, via ProgressLoading)
// ---------------------------------------------------------------------------

const MARKET_ANALYSIS_STEPS: ProgressStep[] = [
  {
    id: "data",
    label: "Reading market data",
    description: "Prices, rents, inventory, and momentum",
    icon: Database,
    durationMs: 8000,
  },
  {
    id: "analyze",
    label: "Analyzing trends and scores",
    description: "Affordability, pace, cash flow, and growth",
    icon: TrendingUp,
    durationMs: 12000,
  },
  {
    id: "writing",
    label: "Writing your analysis",
    description: "Homebuyer and investor takeaways",
    icon: FileText,
    durationMs: 30000,
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AIMarketAnalysis({
  geoType,
  geoId,
  marketName,
  view,
  metrics,
  scores,
  lastUpdated,
}: AIMarketAnalysisProps) {
  const { canAccess } = useEntitlements();
  const aiEnabled = canAccess("feature", "ai_insights");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MarketAnalysisResult | null>(null);

  // Track whether we've already fetched for this geoId to avoid re-fetches
  const fetchedRef = useRef<string | null>(null);

  const doFetch = useCallback(
    async (metricsSnapshot: typeof metrics) => {
      setLoading(true);
      setError(null);

      try {
        const compactMetrics: Record<
          string,
          { value: number | null; formatted: string; change: number | null }
        > = {};
        for (const [key, card] of Object.entries(metricsSnapshot)) {
          if (card.value != null) {
            compactMetrics[key] = {
              value: card.value,
              formatted: card.formattedValue,
              change: card.percentChange,
            };
          }
        }

        const result = await fetchMarketAnalysis(geoType, geoId, {
          geoName: marketName,
          metrics: compactMetrics,
          scores,
          lastUpdated,
        });

        setAnalysis(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate analysis",
        );
        fetchedRef.current = null;
      } finally {
        setLoading(false);
      }
    },
    [geoType, geoId],
  );

  // Only fetch if AI is enabled
  useEffect(() => {
    if (!aiEnabled) return;
    const hasMetrics = Object.values(metrics).some((m) => m.value != null);
    if (hasMetrics && fetchedRef.current !== geoId) {
      fetchedRef.current = geoId;
      doFetch(metrics);
    }
  }, [geoId, doFetch, metrics, aiEnabled]);

  // Reset fetch ref when AI gets disabled (tier change in dev tools)
  useEffect(() => {
    if (!aiEnabled) {
      fetchedRef.current = null;
      setAnalysis(null);
      setLoading(false);
      setError(null);
    }
  }, [aiEnabled]);

  // Determine sections to show
  let sections: MarketAnalysisSection[] | null = null;
  if (aiEnabled && analysis) {
    sections = view === "homebuyer" ? analysis.homebuyer : analysis.investor;
  } else if (!aiEnabled) {
    const hasMetrics = Object.values(metrics).some((m) => m.value != null);
    if (hasMetrics) {
      sections = generateTemplateAnalysis(marketName, view, metrics, scores);
    }
  }

  const icons = view === "homebuyer" ? HOMEBUYER_ICONS : INVESTOR_ICONS;

  const formattedDate = analysis?.generatedAt
    ? new Date(analysis.generatedAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : lastUpdated
      ? new Date(lastUpdated).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      : null;

  // Header config based on mode
  const HeaderIcon = aiEnabled ? Sparkles : BarChart3;
  const headerTitle = aiEnabled ? "AI Market Analysis" : "Market Overview";
  const headerSubtitle = aiEnabled ? "Powered by PropertyIQ" : "Data Summary";
  const containerClass = aiEnabled
    ? "bg-gradient-to-br from-primary/5 via-surface-container to-tertiary/5 rounded-2xl border border-primary/20 overflow-hidden"
    : "bg-surface-container rounded-2xl border border-outline-variant/30 overflow-hidden";
  const iconBgClass = aiEnabled ? "bg-primary/15" : "bg-on-surface/8";
  const iconColorClass = aiEnabled ? "text-primary" : "text-on-surface-variant";

  return (
    <motion.div
      className={containerClass}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${iconBgClass}`}>
            <HeaderIcon className={`w-5 h-5 ${iconColorClass}`} />
          </div>
          <div>
            <h3 className="font-semibold text-on-surface">{headerTitle}</h3>
            <p className="text-xs text-on-surface-variant">{headerSubtitle}</p>
          </div>
        </div>
        {formattedDate && (
          <span className="text-xs text-on-surface-variant/70">
            Data as of {formattedDate}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-6 pb-4 space-y-5">
        {aiEnabled && loading && (
          <ProgressLoading
            variant="inline"
            steps={MARKET_ANALYSIS_STEPS}
            title="Analyzing this market"
            subtitle="This usually takes about 30 seconds."
          />
        )}

        {aiEnabled && error && !loading && (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-on-surface-variant/50 mx-auto mb-3" />
            <p className="text-sm text-on-surface-variant mb-3">
              Unable to generate analysis
            </p>
            <button
              onClick={() => {
                fetchedRef.current = geoId;
                doFetch(metrics);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-full transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        )}

        {!(aiEnabled && loading) &&
          !(aiEnabled && error && !loading) &&
          sections &&
          sections.map((section, i) => {
            const Icon = icons[i] || (aiEnabled ? Sparkles : BarChart3);
            return (
              <motion.div
                key={`${view}-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${aiEnabled ? "bg-primary/10" : "bg-on-surface/6"}`}
                  >
                    <Icon
                      className={`w-4 h-4 ${aiEnabled ? "text-primary" : "text-on-surface-variant"}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-on-surface mb-1">
                      {section.title}
                    </h4>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {section.analysis}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </div>

      {/* Footer: AI disclaimer OR upgrade nudge */}
      {aiEnabled ? (
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container/50">
          <p className="text-[11px] text-on-surface-variant/50 leading-relaxed">
            AI-generated analysis may contain errors. Verify all information
            independently before making decisions.
          </p>
        </div>
      ) : (
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-surface-container/50">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-on-surface-variant/50 leading-relaxed">
              Basic data summary based on available metrics.
            </p>
            <Link
              href="/pricing#ai-insights"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0 ml-3"
            >
              Unlock AI insights <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
