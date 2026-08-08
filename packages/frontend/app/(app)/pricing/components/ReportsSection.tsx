"use client";

import { Sparkles, FileText, Check, Lock } from "lucide-react";
import type { PricingTier } from "@/lib/data/fetchers/pricing";
import { CollapsibleFeature } from "./CollapsibleFeature";
import { TierBadge } from "./TierBadge";
import { IllustrativeNote } from "./IllustrativeNote";

export function ReportsSection({
  plans,
  plansLoading,
}: {
  plans: PricingTier[];
  plansLoading: boolean;
}) {
  return (
    <CollapsibleFeature
      id="reports"
      icon={<FileText className="w-5 h-5 text-primary" />}
      title="Market Reports"
      subtitle="Single-market or head-to-head comparison"
      summary="Polished reports with AI narratives, investment thesis, and risk assessment."
    >
      <div className="mb-8">
        <ul className="space-y-1.5 text-[15px] text-on-surface-variant leading-relaxed">
          <li>
            Metrics, scores, trends, and AI narratives pulled into one polished
            document.
          </li>
          <li>Focus on a single market or compare two head-to-head.</li>
          <li>
            Share with partners, lenders, or your team — looks like it came from
            a professional analyst.
          </li>
          <li className="text-on-surface font-medium">
            Institutional investors pay thousands for reports like these.{" "}
            {(() => {
              // Pull the Pro monthly price from the same DB-driven source the
              // tier cards use. Guard against NaN/0 so a missing or unresolved
              // price can never render a dangling "Yours start at ." — the
              // no-price branch is a complete, price-agnostic sentence and we
              // never hardcode a dollar amount.
              const proMonthly = Number(
                plans.find((p) => p.slug === "pro")?.price_monthly,
              );
              if (Number.isFinite(proMonthly) && proMonthly > 0) {
                return `Yours start at $${Math.round(proMonthly)}/month.`;
              }
              if (plansLoading) {
                return (
                  <>
                    Yours start at{" "}
                    <span className="inline-block w-16 h-4 bg-surface-container animate-pulse rounded align-middle" />
                    .
                  </>
                );
              }
              return "Yours cost a fraction of that.";
            })()}
          </li>
        </ul>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Free */}
        <div className="rounded-xl border border-outline-variant bg-surface-container p-5 relative">
          <div className="absolute top-4 right-4">
            <TierBadge tier="free" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-on-surface-variant/60" />
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant/60">
              What you get today
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Metrics, scores, and trend charts
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Scoring breakdown tables
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface-variant">
                Market comparison data
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No AI narratives or summaries
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No executive summary
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Lock className="w-4 h-4 text-on-surface-variant/30 shrink-0" />
              <span className="text-on-surface-variant/50">
                No investment thesis or risk assessment
              </span>
            </div>
          </div>
          <p className="text-[10px] text-on-surface-variant/40 mt-4 italic">
            Data tables without the &ldquo;so what.&rdquo;
          </p>
        </div>

        {/* Pro */}
        <div className="rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-surface-container to-tertiary/[0.04] p-5 relative shadow-[0_2px_20px_-4px_rgba(57,73,171,0.12)]">
          <div className="absolute top-4 right-4">
            <TierBadge tier="pro" />
          </div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              What you&apos;re missing
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 text-sm">
              <Check className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-on-surface">
                Everything in the data report
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>Executive Summary</strong> — the bottom line, up front
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>Investment Thesis</strong> — buy, hold, or walk away
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-on-surface">
                <strong>Risk Assessment</strong> — what could go wrong and how
                to hedge
              </span>
            </div>
          </div>
          <div className="mt-4 bg-surface rounded-lg p-3 border border-dashed border-primary/15">
            <p className="text-xs text-on-surface-variant italic leading-relaxed">
              &ldquo;Nashville presents a compelling buy opportunity for
              mid-term investors. The combination of 2.8% job growth, sustained
              in-migration, and a PropertyIQ Score firming from 58 to 62 over
              six months signals strengthening fundamentals. The primary risk —
              rising inventory — is concentrated in new construction above
              $500K, which doesn&apos;t threaten the core investment thesis at
              sub-$400K price points.&rdquo;
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-primary font-medium">
                Sample AI Executive Summary
              </span>
            </div>
          </div>
          <IllustrativeNote detail="Sample narrative in the style Pro generates — the figures are examples, not live Nashville data." />
        </div>
      </div>
    </CollapsibleFeature>
  );
}
