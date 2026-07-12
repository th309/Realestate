"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useEntitlements } from "@/lib/entitlements/EntitlementsContext";
import { useAuth } from "@/lib/auth";
import { generateReport as generateReportAPI } from "@/lib/data";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";
import type { UserType, Geography, GeographyType } from "./types";
import type { Market } from "./components/reportBuilderTypes";
import { MarketSelector } from "./components/MarketSelector";
import { ReportBuilderPersonalizationPanel } from "./components/ReportBuilderPersonalizationPanel";
import { ReportBuilderHeader } from "./components/ReportBuilderHeader";
import { CustomResearchPromoCard } from "./components/CustomResearchPromoCard";
import { ReportGenerateFeedback } from "./components/ReportGenerateFeedback";

interface ReportCreationPageProps {
  /** Rendered in the right column under the Custom Research card so recent
   *  reports stay visible in the first desktop viewport. */
  recentReports?: React.ReactNode;
}

export function ReportCreationPage({ recentReports }: ReportCreationPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const {
    simulatedTier,
    tier,
    getAccess,
    loading: entitlementsLoading,
  } = useEntitlements();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  // Hard paywall gate for the GENERATE action. When a user without `reports`
  // entitlement clicks Generate, we surface the EXISTING PaywallCard and never
  // POST to /api/reports/generate — so an AI generation is never burned on a
  // report the user can't view (the view gate would otherwise reject it after
  // the fact). This is the same `feature:reports` check the report VIEW uses.
  const [showReportsPaywall, setShowReportsPaywall] = useState(false);
  const urlPrefillApplied = useRef(false);

  // Read prefill data from URL params (e.g. from "Generate Report" on market page)
  // or from localStorage (e.g. from map context menu right-click)
  useEffect(() => {
    if (markets.length > 0) return;

    // Priority 1: URL params (mid, mname, mtype)
    if (!urlPrefillApplied.current) {
      const mid = searchParams.get("mid");
      const mname = searchParams.get("mname");
      const mtype = searchParams.get("mtype") as Market["type"] | null;
      const mstate = searchParams.get("mstate");
      if (mid && mname && mtype) {
        urlPrefillApplied.current = true;
        setMarkets([
          { id: mid, name: mname, type: mtype, state: mstate || undefined },
        ]);
        return;
      }
    }

    // Priority 2: localStorage prefill (map context menu)
    try {
      const raw = localStorage.getItem("propertyiq-report-prefill");
      if (raw) {
        const prefill = JSON.parse(raw);
        if (prefill?.id && prefill?.name && prefill?.type) {
          setMarkets([
            {
              id: prefill.id,
              name: prefill.name,
              type: prefill.type,
              state: prefill.state,
            },
          ]);
        }
      }
    } catch {
      /* ignore malformed data */
    }
  }, [markets.length, searchParams]);

  const canGenerate = markets.length > 0;

  // Reports entitlement gate. `feature:reports` is a single boolean in the
  // entitlement system (free = no access; pro/enterprise/admin = full) — it
  // governs BOTH single-market and multi-market comparison reports, so there is
  // no "single is free" carve-out at this layer. We only treat the user as
  // blocked once entitlements have resolved, to avoid blocking during the
  // initial loading flash.
  const reportsAccess = getAccess("feature", "reports");
  const reportsLocked = !entitlementsLoading && reportsAccess.level === "none";

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (markets.length === 0) {
      setError("Please select at least one market");
      return;
    }

    // Hard-block generation for users without the `reports` entitlement BEFORE
    // hitting the API. Reuses the existing PaywallCard (same component the
    // /reports/[id] view shows) instead of generating-then-paywalling. Dismiss
    // does not re-enable generation — the card stays until the user upgrades.
    if (reportsLocked) {
      setShowReportsPaywall(true);
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const templateSlug = markets.length > 1 ? "comparison" : "propertyiq";

      const userType: UserType = "universal";

      const primaryMarket = markets[0];
      const primaryGeography: Geography = {
        id: primaryMarket.id,
        type: primaryMarket.type as GeographyType,
        name: primaryMarket.name,
        state: primaryMarket.state,
        center: primaryMarket.center,
      };

      const comparisonGeographies: Geography[] = markets.slice(1).map((m) => ({
        id: m.id,
        type: m.type as GeographyType,
        name: m.name,
        state: m.state,
        center: m.center,
      }));

      const userInputs: Record<string, any> = {};
      if (inputs.income)
        userInputs.household_income = parseFloat(
          inputs.income.replace(/,/g, ""),
        );
      if (inputs.downPayment)
        userInputs.down_payment = parseFloat(
          inputs.downPayment.replace(/,/g, ""),
        );
      if (inputs.purchasePrice)
        userInputs.purchase_price = parseFloat(
          inputs.purchasePrice.replace(/,/g, ""),
        );
      if (inputs.expectedRent)
        userInputs.expected_rent = parseFloat(
          inputs.expectedRent.replace(/,/g, ""),
        );

      // Add priorities if selected
      if (inputs.priorities) {
        try {
          const parsedPriorities = JSON.parse(inputs.priorities);
          if (Array.isArray(parsedPriorities) && parsedPriorities.length > 0) {
            userInputs.priorities = parsedPriorities;
          }
        } catch (e) {
          console.warn("Failed to parse priorities:", e);
        }
      }

      const requestBody = {
        template_slug: templateSlug,
        user_type: userType,
        primary_geography: primaryGeography,
        comparison_geographies:
          comparisonGeographies.length > 0 ? comparisonGeographies : undefined,
        user_inputs:
          Object.keys(userInputs).length > 0 ? userInputs : undefined,
      };

      const userId = user?.id;
      if (!userId) {
        setShowSignupPrompt(true);
        setIsGenerating(false);
        return;
      }
      const effectiveTier = simulatedTier || tier;

      const data = await generateReportAPI(requestBody, {
        userId,
        userTier: effectiveTier || undefined,
      });
      setIsGenerating(false);
      // Clear localStorage prefill now that the report was successfully generated
      try {
        localStorage.removeItem("propertyiq-report-prefill");
      } catch {
        /* ignore */
      }
      router.push(`/reports/${data.report_id}`);
    } catch (err) {
      console.error("Report generation error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate report",
      );
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <ReportBuilderHeader />

      {/* Form + Custom Research side by side */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Report Builder */}
          <div className="lg:col-span-3 space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-on-surface mb-1">
                Select your market(s)
              </h2>
              <p className="text-sm text-on-surface-variant mb-4">
                Choose up to 5 markets to analyze
              </p>
              <MarketSelector
                markets={markets}
                onAdd={(market) => setMarkets([...markets, market])}
                onRemove={(id) =>
                  setMarkets(markets.filter((m) => m.id !== id))
                }
                accentColor="primary"
              />
              {markets[0] && (
                <div className="mt-3">
                  <SocialProofBadge
                    geoLevel={markets[0].type || "metro"}
                    geoId={markets[0].id || ""}
                    variant="reports"
                  />
                </div>
              )}
            </section>

            <section>
              <ReportBuilderPersonalizationPanel
                values={inputs}
                onChange={(key, value) =>
                  setInputs({ ...inputs, [key]: value })
                }
              />
            </section>

            <motion.button
              data-tour="reports-generate-btn"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="w-full py-4 px-6 rounded-2xl font-semibold text-lg
            flex items-center justify-center gap-3
            transition-all duration-300
            disabled:opacity-50 disabled:cursor-not-allowed
            bg-primary text-on-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              whileHover={canGenerate ? { scale: 1.01 } : {}}
              whileTap={canGenerate ? { scale: 0.99 } : {}}
            >
              {isGenerating ? (
                <>
                  <motion.div
                    className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  Generating your report...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Report
                </>
              )}
            </motion.button>

            <ReportGenerateFeedback
              showReportsPaywall={showReportsPaywall}
              showSignupPrompt={showSignupPrompt}
              primaryMarket={markets[0]}
              canGenerate={canGenerate}
              error={error}
              onDismissError={() => setError(null)}
            />
          </div>

          {/* Right: Custom Research + recent reports */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            <CustomResearchPromoCard
              onOpen={() => router.push("/reports/research")}
            />
            {recentReports}
          </div>
        </div>
      </div>
    </div>
  );
}
