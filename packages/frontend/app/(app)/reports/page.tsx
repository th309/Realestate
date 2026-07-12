"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  MapPin,
  ChevronRight,
  History,
  Clock,
  FileText,
  ArrowRight,
  BarChart3,
  Zap,
} from "lucide-react";
import { EntitlementGate } from "@/components/entitlements/EntitlementGate";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import { PostTrialGate } from "@/components/entitlements/PostTrialGate";
import { useAuth } from "@/lib/auth";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import type { ReportListItem } from "./types";
import { fetchReportList } from "@/lib/data";
import { ReportCreationPage } from "./ReportCreationPage";

// ============================================================================
// REPORT HISTORY
// ============================================================================

function ReportHistory() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchReportList({ userId, limit: 10 })
      .then((data) => setReports(data as ReportListItem[]))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-8 animate-pulse space-y-3">
        <div className="h-14 bg-surface-container-high rounded-xl" />
        <div className="h-14 bg-surface-container-high rounded-xl" />
        <div className="h-14 bg-surface-container-high rounded-xl" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-14 px-6 border border-dashed border-outline-variant/50 rounded-2xl">
        <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-6 h-6 text-primary/60" />
        </div>
        <p className="text-base font-medium text-on-surface mb-1">
          No reports yet
        </p>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
          Select a market above to generate your first AI-powered market
          analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <button
          key={report.id}
          onClick={() => router.push(`/reports/${report.id}`)}
          className="w-full flex items-center gap-4 p-4 rounded-xl
            bg-surface-container hover:bg-surface-container-high
            border border-outline-variant/30 hover:border-outline-variant/50
            transition-all duration-200 text-left group"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-100 text-indigo-700">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-on-surface truncate">
              {report.title}
            </div>
            <div className="text-sm text-on-surface-variant truncate">
              {report.primary_geography_name}
            </div>
          </div>
          <div className="text-xs text-on-surface-variant flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(report.created_at).toLocaleDateString()}
          </div>
          <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-on-surface transition-colors" />
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ReportsContent() {
  return (
    <div className="min-h-screen bg-surface" data-tour="reports-section">
      {/* Report creation form; recent reports render in its right column so
          they're visible without scrolling on desktop */}
      <ReportCreationPage
        recentReports={
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
                <History className="w-4 h-4 text-on-surface-variant" />
              </div>
              <h2 className="text-lg font-semibold text-on-surface">
                Recent Reports
              </h2>
            </div>
            <ReportHistory />
          </section>
        }
      />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="h-screen bg-surface px-6 py-10">
      <div className="max-w-5xl mx-auto animate-pulse">
        {/* Skeleton: page title */}
        <div className="h-8 w-48 bg-surface-container-high rounded-xl mb-8" />
        {/* Skeleton: report type cards (grid of 3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="h-64 bg-surface-container-high rounded-3xl" />
          <div className="h-64 bg-surface-container-high rounded-3xl" />
          <div className="h-64 bg-surface-container-high rounded-3xl" />
        </div>
        {/* Skeleton: recent reports section */}
        <div className="h-6 w-36 bg-surface-container-high rounded-xl mb-4" />
        <div className="h-32 bg-surface-container-high rounded-xl" />
      </div>
    </div>
  );
}

function ReportsLanding() {
  const features = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Deep Market Analysis",
      desc: "AI-powered insights across 60+ metrics",
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Investment Projections",
      desc: "Cash flow, appreciation, and risk scenarios",
    },
    {
      icon: <MapPin className="w-5 h-5" />,
      title: "Market Comparisons",
      desc: "Side-by-side analysis of up to 5 markets",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Personalized Insights",
      desc: "Tailored to your budget and priorities",
    },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[{ label: "Reports" }]}
          title="Real Estate Market Reports"
          description="Get comprehensive market analysis tailored to homebuyers and investors. See a real report below."
          icon={<FileText className="w-5 h-5" />}
          className="mb-10"
        />

        {/* Sample Report CTA - prominent */}
        <a
          href="/reports/sample"
          className="group block relative overflow-hidden rounded-3xl p-8 md:p-10 mb-10
            bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5
            hover:from-primary/10 hover:via-primary/15 hover:to-primary/10
            border border-outline-variant/30 hover:border-primary/40
            hover:shadow-xl hover:shadow-black/5
            transition-all duration-300"
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20 bg-primary transition-opacity duration-500 group-hover:opacity-40" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
              <FileText className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
                  Sample Report
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-on-surface mb-1.5">
                View a Full Market Report
              </h2>
              <p className="text-on-surface-variant text-sm sm:text-base max-w-lg">
                See exactly what you get — AI narratives, score breakdowns,
                market trends, and investment analysis for a real metro area.
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
              <ArrowRight className="w-6 h-6 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </a>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 p-4 rounded-xl bg-surface-container border border-outline-variant/30"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-on-surface">
                  {f.title}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade CTA */}
        <PaywallCard
          type="feature"
          id="reports"
          title="Unlock Market Reports"
          description="Generate unlimited AI-powered reports with custom market comparisons, investment projections, and exportable formats."
          className="max-w-lg mx-auto"
        />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EntitlementGate
        type="feature"
        id="reports"
        fallback={
          <PostTrialGate
            feature="reports"
            featureName="Market Reports"
            fallback={<ReportsLanding />}
          >
            <ReportsContent />
          </PostTrialGate>
        }
        loadingFallback={<LoadingFallback />}
      >
        <ReportsContent />
      </EntitlementGate>
    </Suspense>
  );
}
