"use client";

import React, {
  Suspense,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  MapPin,
  DollarSign,
  ChevronRight,
  Plus,
  X,
  Sparkles,
  Info,
  AlertCircle,
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
import { useEntitlements } from "@/lib/entitlements/EntitlementsContext";
import { useAuth } from "@/lib/auth";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import { SearchWidget } from "@/app/map/components/SearchWidget";
import type { SearchResult } from "@/app/map/types";
import type {
  UserType,
  Geography,
  GeographyType,
  ReportListItem,
} from "./types";
import PrioritySelector from "./components/PrioritySelector";
import {
  generateReport as generateReportAPI,
  fetchReportList,
} from "@/lib/data";
import { SocialProofBadge } from "@/app/components/social-proof/SocialProofBadge";

// ============================================================================
// TYPES
// ============================================================================

interface Market {
  id: string;
  name: string;
  type: "metro" | "city" | "zip" | "county" | "state";
  center?: [number, number];
  state?: string;
}

// ReportCard component removed — single PropertyIQ report type, no type picker needed

// ============================================================================
// MARKET SELECTOR
// ============================================================================

interface MarketSelectorProps {
  markets: Market[];
  onAdd: (market: Market) => void;
  onRemove: (id: string) => void;
  maxMarkets?: number;
  accentColor?: "primary" | "tertiary";
}

function MarketSelector({
  markets,
  onAdd,
  onRemove,
  maxMarkets = 5,
  accentColor = "primary",
}: MarketSelectorProps) {
  const [showSearch, setShowSearch] = useState(false);

  // Like-geo restriction: the first market picked locks the geo level so a
  // comparison never mixes metros with ZIPs (the report compares like-for-like).
  // Enforced in three places: the backend search filter, the dropdown filter,
  // and the add handler (belt-and-suspenders).
  const lockedGeoLevel = markets.length > 0 ? markets[0].type : undefined;
  const geoLabel = (t: string) => (t === "zip" ? "ZIP" : t);

  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
    setShowSearchResults,
  } = useUniversalSearch({ filterByGeoLevel: lockedGeoLevel });

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      // Reject a mismatched geo level (the dropdown is already filtered, but a
      // stale result could slip through) so all compared markets stay same-level.
      if (markets.length > 0 && result.type !== markets[0].type) {
        return;
      }

      const market: Market = {
        id: result.id,
        name: result.name,
        type: result.type,
        center: result.center,
        state: result.state,
      };

      if (!markets.find((m) => m.id === market.id)) {
        onAdd(market);
      }

      clearSearch();
      setShowSearch(false);
    },
    [markets, onAdd, clearSearch],
  );

  const handleFocus = useCallback(() => {
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    }
  }, [searchQuery, setShowSearchResults]);

  return (
    <div className="space-y-4">
      {/* Selected markets */}
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {markets.map((market, index) => (
            <motion.div
              key={market.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              layout
              className={`
                group flex items-center gap-2 pl-4 pr-2 py-2 rounded-full
                border transition-all duration-200
                ${
                  index === 0
                    ? accentColor === "primary"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-tertiary/10 border-tertiary/30 text-tertiary"
                    : "bg-surface-container border-outline-variant/50 text-on-surface"
                }
              `}
            >
              <MapPin className="w-4 h-4 opacity-60" />
              <span className="text-sm font-medium">{market.name}</span>
              {index === 0 && (
                <span className="text-xs opacity-60 ml-1">Primary</span>
              )}
              <button
                onClick={() => onRemove(market.id)}
                className="w-6 h-6 rounded-full flex items-center justify-center
                  hover:bg-error/20 hover:text-error transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {markets.length < maxMarkets && !showSearch && (
          <motion.button
            onClick={() => setShowSearch(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full
              border-2 border-dashed border-outline-variant/50
              text-on-surface-variant transition-all duration-200
              ${
                accentColor === "primary"
                  ? "hover:border-primary/50 hover:text-primary"
                  : "hover:border-tertiary/50 hover:text-tertiary"
              }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add market</span>
          </motion.button>
        )}
      </div>

      {/* Comparison hint */}
      {markets.length === 1 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-on-surface-variant"
        >
          <Info
            className={`w-4 h-4 ${accentColor === "primary" ? "text-primary" : "text-tertiary"}`}
          />
          Add another market to see a side-by-side comparison
        </motion.p>
      )}

      {markets.length >= 2 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 text-sm ${accentColor === "primary" ? "text-primary" : "text-tertiary"}`}
        >
          <Sparkles className="w-4 h-4" />
          Comparison mode: We&apos;ll show how these markets stack up
        </motion.p>
      )}

      {/* Search Widget */}
      <AnimatePresence>
        {(showSearch || markets.length === 0) &&
          markets.length < maxMarkets && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SearchWidget
                searchQuery={searchQuery}
                searchResults={searchResults.filter(
                  (r) =>
                    !markets.find((m) => m.id === r.id) &&
                    (lockedGeoLevel == null || r.type === lockedGeoLevel),
                )}
                searchLoading={searchLoading}
                showSearchResults={showSearchResults}
                searchRef={searchRef}
                onSearch={handleSearch}
                onSelectResult={handleSelectResult}
                onFocus={handleFocus}
                className="w-full"
                placeholder="Search for a city, metro, ZIP, or county..."
              />
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

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

// Strip commas from a value (for storing raw number)
function stripCommas(value: string): string {
  return value.replace(/,/g, "");
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

interface PersonalizationPanelProps {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function PersonalizationPanel({ values, onChange }: PersonalizationPanelProps) {
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

// ============================================================================
// REPORT CREATION PAGE
// ============================================================================

function ReportCreationPage() {
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
      <div
        className={`
        relative overflow-hidden
        bg-gradient-to-br from-primary/5 via-primary/10 to-transparent
      `}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 bg-primary" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/15 text-primary">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
                PropertyIQ Report
              </h2>
              <p className="text-on-surface-variant">
                Powered by PropertyIQ Score
              </p>
            </div>
          </div>
        </div>
      </div>

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
              <PersonalizationPanel
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

            {showSignupPrompt && markets[0] && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-primary/30 bg-primary-container/40 p-5 text-center"
              >
                <h3 className="text-base font-semibold text-on-surface mb-1">
                  Sign up free to generate your {markets[0].name} report
                </h3>
                <p className="text-sm text-on-surface-variant mb-4">
                  Create a free account and we&apos;ll bring you right back to
                  this report.
                </p>
                <a
                  href={`/auth/sign-up?redirect=${encodeURIComponent(
                    `/reports?mid=${encodeURIComponent(markets[0].id)}&mname=${encodeURIComponent(
                      markets[0].name,
                    )}&mtype=${encodeURIComponent(markets[0].type)}${
                      markets[0].state
                        ? `&mstate=${encodeURIComponent(markets[0].state)}`
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
                  onClick={() => setError(null)}
                  className="ml-auto text-error hover:text-error/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Right: Custom Research */}
          <div className="lg:col-span-2 flex">
            <motion.button
              onClick={() => router.push("/reports/research")}
              className="
              group relative overflow-hidden
              w-full text-left rounded-3xl p-6 lg:p-8
              flex flex-col
              transition-all duration-500 ease-out
              bg-gradient-to-br from-secondary/5 via-secondary/10 to-secondary/5
              hover:from-secondary/10 hover:via-secondary/15 hover:to-secondary/10
              border border-outline-variant/30 hover:border-outline-variant/60
              hover:shadow-xl hover:shadow-black/5
              self-stretch
            "
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30 transition-opacity duration-500 group-hover:opacity-50 bg-secondary" />
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-secondary/15 text-secondary">
                <FileText className="w-7 h-7" />
              </div>
              <div className="relative flex-1">
                <h2 className="text-xl lg:text-2xl font-semibold text-on-surface mb-2 tracking-tight">
                  Custom Research
                </h2>
                <p className="text-on-surface-variant text-sm lg:text-base leading-relaxed">
                  Ask any real estate question. Get an AI-powered research brief
                  backed by PropertyIQ data.
                </p>
              </div>
              <div className="relative flex items-center justify-between mt-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-secondary/10 text-secondary">
                  <Sparkles className="w-4 h-4" />
                  AI Research Agent
                </div>
                <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 bg-secondary text-on-secondary">
                  <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      {/* Report creation form — direct to market selection, no type picker */}
      <ReportCreationPage />

      {/* Recent Reports */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-8">
        {/* Recent Reports */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
              <History className="w-4 h-4 text-on-surface-variant" />
            </div>
            <h2 className="text-xl font-semibold text-on-surface">
              Recent Reports
            </h2>
          </div>
          <ReportHistory />
        </div>
      </div>
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
