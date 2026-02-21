'use client';

import React, { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, TrendingUp, MapPin, DollarSign, ChevronRight, Plus, X, Sparkles, Info, AlertCircle, History, Clock, FileText, ArrowRight, BarChart3, Zap } from 'lucide-react';
import { EntitlementGate } from '@/components/entitlements/EntitlementGate';
import { PaywallCard } from '@/components/entitlements/PaywallCard';
import { useEntitlements } from '@/lib/entitlements/EntitlementsContext';
import { useAuth } from '@/lib/auth';
import { Breadcrumbs } from '@/components/navigation';
import { useUniversalSearch } from '@/app/shared/hooks/useUniversalSearch';
import { SearchWidget } from '@/app/map/components/SearchWidget';
import type { SearchResult } from '@/app/map/types';
import type { UserType, Geography, GeographyType, ReportListItem } from './types';
import PrioritySelector from './components/PrioritySelector';
import { generateReport as generateReportAPI, fetchReportList } from '@/lib/data';

// ============================================================================
// TYPES
// ============================================================================

interface Market {
  id: string;
  name: string;
  type: 'metro' | 'city' | 'zip' | 'county' | 'state';
  center?: [number, number];
  state?: string;
}

// ============================================================================
// REPORT CARD - Entry Point
// ============================================================================

interface ReportCardProps {
  type: 'homebuyer' | 'investor';
  onSelect: () => void;
}

function ReportCard({ type, onSelect }: ReportCardProps) {
  const isHomebuyer = type === 'homebuyer';

  return (
    <motion.button
      onClick={onSelect}
      className={`
        group relative overflow-hidden
        w-full text-left rounded-3xl p-8 md:p-10
        transition-all duration-500 ease-out
        ${isHomebuyer
          ? 'bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 hover:from-primary/10 hover:via-primary/15 hover:to-primary/10'
          : 'bg-gradient-to-br from-tertiary/5 via-tertiary/10 to-tertiary/5 hover:from-tertiary/10 hover:via-tertiary/15 hover:to-tertiary/10'
        }
        border border-outline-variant/30 hover:border-outline-variant/60
        hover:shadow-xl hover:shadow-black/5
      `}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Decorative gradient orb */}
      <div className={`
        absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-30
        transition-opacity duration-500 group-hover:opacity-50
        ${isHomebuyer ? 'bg-primary' : 'bg-tertiary'}
      `} />

      {/* Icon */}
      <div className={`
        relative w-14 h-14 rounded-2xl flex items-center justify-center mb-6
        ${isHomebuyer
          ? 'bg-primary/15 text-primary'
          : 'bg-tertiary/15 text-tertiary'
        }
      `}>
        {isHomebuyer ? <Home className="w-7 h-7" /> : <TrendingUp className="w-7 h-7" />}
      </div>

      {/* Content */}
      <div className="relative">
        <h2 className="text-2xl md:text-3xl font-semibold text-on-surface mb-2 tracking-tight">
          {isHomebuyer ? 'Homebuyer Report' : 'Investor Report'}
        </h2>

        <p className="text-on-surface-variant text-base md:text-lg mb-6 leading-relaxed max-w-md">
          {isHomebuyer
            ? 'Discover if a market fits your budget and lifestyle. See affordability, competition, and buying conditions.'
            : 'Analyze cash flow, appreciation potential, and risk. Get pro forma projections for any market.'
          }
        </p>

        {/* Score badge */}
        <div className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
          ${isHomebuyer
            ? 'bg-primary/10 text-primary'
            : 'bg-tertiary/10 text-tertiary'
          }
        `}>
          <Sparkles className="w-4 h-4" />
          {isHomebuyer ? 'HomeReady Score' : 'InvestorEdge Score'}
        </div>
      </div>

      {/* Arrow */}
      <div className={`
        absolute bottom-8 right-8 w-12 h-12 rounded-full
        flex items-center justify-center
        transition-all duration-300 group-hover:scale-110
        ${isHomebuyer
          ? 'bg-primary text-on-primary'
          : 'bg-tertiary text-on-tertiary'
        }
      `}>
        <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.button>
  );
}

// ============================================================================
// MARKET SELECTOR
// ============================================================================

interface MarketSelectorProps {
  markets: Market[];
  onAdd: (market: Market) => void;
  onRemove: (id: string) => void;
  maxMarkets?: number;
  accentColor?: 'primary' | 'tertiary';
}

function MarketSelector({ markets, onAdd, onRemove, maxMarkets = 5, accentColor = 'primary' }: MarketSelectorProps) {
  const [showSearch, setShowSearch] = useState(false);

  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
    setShowSearchResults,
  } = useUniversalSearch({});

  const handleSelectResult = useCallback((result: SearchResult) => {
    const market: Market = {
      id: result.id,
      name: result.name,
      type: result.type,
      center: result.center,
      state: result.state,
    };

    if (!markets.find(m => m.id === market.id)) {
      onAdd(market);
    }

    clearSearch();
    setShowSearch(false);
  }, [markets, onAdd, clearSearch]);

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
                ${index === 0
                  ? accentColor === 'primary'
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-tertiary/10 border-tertiary/30 text-tertiary'
                  : 'bg-surface-container border-outline-variant/50 text-on-surface'
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
              ${accentColor === 'primary'
                ? 'hover:border-primary/50 hover:text-primary'
                : 'hover:border-tertiary/50 hover:text-tertiary'
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
          <Info className={`w-4 h-4 ${accentColor === 'primary' ? 'text-primary' : 'text-tertiary'}`} />
          Add another market to see a side-by-side comparison
        </motion.p>
      )}

      {markets.length >= 2 && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 text-sm ${accentColor === 'primary' ? 'text-primary' : 'text-tertiary'}`}
        >
          <Sparkles className="w-4 h-4" />
          Comparison mode: We&apos;ll show how these markets stack up
        </motion.p>
      )}

      {/* Search Widget */}
      <AnimatePresence>
        {(showSearch || markets.length === 0) && markets.length < maxMarkets && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <SearchWidget
              searchQuery={searchQuery}
              searchResults={searchResults.filter(r => !markets.find(m => m.id === r.id))}
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
  const digits = value.replace(/[^\d.]/g, '');
  if (!digits) return '';

  // Split by decimal point if present
  const parts = digits.split('.');
  // Format the integer part with commas
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return parts.join('.');
}

// Strip commas from a value (for storing raw number)
function stripCommas(value: string): string {
  return value.replace(/,/g, '');
}

// Handle currency input change - format display but store raw value
function handleCurrencyChange(
  rawValue: string,
  onChange: (key: string, value: string) => void,
  key: string
): void {
  // Format the input with commas for display
  const formatted = formatWithCommas(rawValue);
  onChange(key, formatted);
}

// ============================================================================
// PERSONALIZATION PANEL
// ============================================================================

interface PersonalizationPanelProps {
  type: 'homebuyer' | 'investor';
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function PersonalizationPanel({ type, values, onChange }: PersonalizationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isHomebuyer = type === 'homebuyer';

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
            <h3 className="text-sm font-medium text-on-surface">Personalize your report</h3>
            <p className="text-xs text-on-surface-variant">Optional - Get tailored insights</p>
          </div>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-5 h-5 text-on-surface-variant" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-6 pb-6 pt-2 border-t border-outline-variant/20">
              {/* Priority Selector */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-on-surface mb-3">
                  What matters most to you? (Pick your top 3)
                </h4>
                <PrioritySelector
                  userType={type}
                  selected={values.priorities ? JSON.parse(values.priorities) : []}
                  onChange={(priorities) => onChange('priorities', JSON.stringify(priorities))}
                />
              </div>

              {/* Financial Inputs */}
              {isHomebuyer ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-2">
                      Household income
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                      <input
                        type="text"
                        value={values.income || ''}
                        onChange={(e) => handleCurrencyChange(e.target.value, onChange, 'income')}
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
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                      <input
                        type="text"
                        value={values.downPayment || ''}
                        onChange={(e) => handleCurrencyChange(e.target.value, onChange, 'downPayment')}
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
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-2">
                      Purchase price
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                      <input
                        type="text"
                        value={values.purchasePrice || ''}
                        onChange={(e) => handleCurrencyChange(e.target.value, onChange, 'purchasePrice')}
                        placeholder="450,000"
                        className="w-full pl-8 pr-4 py-3 rounded-xl
                          bg-surface-container border border-outline-variant/50
                          text-on-surface placeholder:text-on-surface-variant/40
                          focus:outline-none focus:ring-2 focus:ring-tertiary/30 focus:border-tertiary/50
                          transition-all duration-200"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-on-surface-variant/70">
                      Leave blank for median price
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-2">
                      Down payment %
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={values.downPaymentPct || ''}
                        onChange={(e) => onChange('downPaymentPct', e.target.value)}
                        placeholder="25"
                        className="w-full pl-4 pr-8 py-3 rounded-xl
                          bg-surface-container border border-outline-variant/50
                          text-on-surface placeholder:text-on-surface-variant/40
                          focus:outline-none focus:ring-2 focus:ring-tertiary/30 focus:border-tertiary/50
                          transition-all duration-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant">%</span>
                    </div>
                    <p className="mt-1.5 text-xs text-on-surface-variant/70">
                      Default: 25%
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface mb-2">
                      Expected rent
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">$</span>
                      <input
                        type="text"
                        value={values.expectedRent || ''}
                        onChange={(e) => handleCurrencyChange(e.target.value, onChange, 'expectedRent')}
                        placeholder="2,500"
                        className="w-full pl-8 pr-16 py-3 rounded-xl
                          bg-surface-container border border-outline-variant/50
                          text-on-surface placeholder:text-on-surface-variant/40
                          focus:outline-none focus:ring-2 focus:ring-tertiary/30 focus:border-tertiary/50
                          transition-all duration-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">/mo</span>
                    </div>
                    <p className="mt-1.5 text-xs text-on-surface-variant/70">
                      Leave blank for market rent
                    </p>
                  </div>
                </div>
              )}
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

interface ReportCreationPageProps {
  type: 'homebuyer' | 'investor';
  onBack: () => void;
}

function ReportCreationPage({ type, onBack }: ReportCreationPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { simulatedTier, tier } = useEntitlements();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlPrefillApplied = useRef(false);

  // Read prefill data from URL params (e.g. from "Generate Report" on market page)
  // or from localStorage (e.g. from map context menu right-click)
  useEffect(() => {
    if (markets.length > 0) return;

    // Priority 1: URL params (mid, mname, mtype)
    if (!urlPrefillApplied.current) {
      const mid = searchParams.get('mid');
      const mname = searchParams.get('mname');
      const mtype = searchParams.get('mtype') as Market['type'] | null;
      const mstate = searchParams.get('mstate');
      if (mid && mname && mtype) {
        urlPrefillApplied.current = true;
        setMarkets([{ id: mid, name: mname, type: mtype, state: mstate || undefined }]);
        return;
      }
    }

    // Priority 2: localStorage prefill (map context menu)
    try {
      const raw = localStorage.getItem('propertyiq-report-prefill');
      if (raw) {
        localStorage.removeItem('propertyiq-report-prefill');
        const prefill = JSON.parse(raw);
        if (prefill?.id && prefill?.name && prefill?.type) {
          setMarkets([{ id: prefill.id, name: prefill.name, type: prefill.type, state: prefill.state }]);
        }
      }
    } catch { /* ignore malformed data */ }
  }, [markets.length, searchParams]);

  const isHomebuyer = type === 'homebuyer';
  const canGenerate = markets.length > 0;

  const handleGenerate = async () => {
    if (markets.length === 0) {
      setError('Please select at least one market');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const templateSlug = markets.length > 1
        ? 'comparison'
        : (isHomebuyer ? 'homeready' : 'investoredge');

      const userType: UserType = isHomebuyer ? 'homebuyer' : 'investor';

      const primaryMarket = markets[0];
      const primaryGeography: Geography = {
        id: primaryMarket.id,
        type: primaryMarket.type as GeographyType,
        name: primaryMarket.name,
        state: primaryMarket.state,
        center: primaryMarket.center,
      };

      const comparisonGeographies: Geography[] = markets.slice(1).map(m => ({
        id: m.id,
        type: m.type as GeographyType,
        name: m.name,
        state: m.state,
        center: m.center,
      }));

      const userInputs: Record<string, any> = {};
      if (isHomebuyer) {
        if (inputs.income) userInputs.household_income = parseFloat(inputs.income.replace(/,/g, ''));
        if (inputs.downPayment) userInputs.down_payment = parseFloat(inputs.downPayment.replace(/,/g, ''));
      } else {
        if (inputs.purchasePrice) userInputs.purchase_price = parseFloat(inputs.purchasePrice.replace(/,/g, ''));
        if (inputs.downPaymentPct) userInputs.down_payment_pct = parseFloat(inputs.downPaymentPct);
        if (inputs.expectedRent) userInputs.expected_rent = parseFloat(inputs.expectedRent.replace(/,/g, ''));
      }

      // Add priorities if selected
      if (inputs.priorities) {
        try {
          const parsedPriorities = JSON.parse(inputs.priorities);
          if (Array.isArray(parsedPriorities) && parsedPriorities.length > 0) {
            userInputs.priorities = parsedPriorities;
          }
        } catch (e) {
          console.warn('Failed to parse priorities:', e);
        }
      }

      const requestBody = {
        template_slug: templateSlug,
        user_type: userType,
        primary_geography: primaryGeography,
        comparison_geographies: comparisonGeographies.length > 0 ? comparisonGeographies : undefined,
        user_inputs: Object.keys(userInputs).length > 0 ? userInputs : undefined,
      };

      const userId = user?.id;
      if (!userId) {
        setError('You must be signed in to generate a report.');
        setIsGenerating(false);
        return;
      }
      const effectiveTier = simulatedTier || tier;

      const data = await generateReportAPI(requestBody, { userId, userTier: effectiveTier || undefined });
      router.push(`/reports/${data.report_id}`);
    } catch (err) {
      console.error('Report generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className={`
        relative overflow-hidden
        ${isHomebuyer
          ? 'bg-gradient-to-br from-primary/5 via-primary/10 to-transparent'
          : 'bg-gradient-to-br from-tertiary/5 via-tertiary/10 to-transparent'
        }
      `}>
        <div className={`
          absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20
          ${isHomebuyer ? 'bg-primary' : 'bg-tertiary'}
        `} />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 relative">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface
              transition-colors mb-6 group"
          >
            <ChevronRight className="w-4 h-4 rotate-180 transition-transform group-hover:-translate-x-0.5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex items-center gap-4 mb-2">
            <div className={`
              w-12 h-12 rounded-2xl flex items-center justify-center
              ${isHomebuyer
                ? 'bg-primary/15 text-primary'
                : 'bg-tertiary/15 text-tertiary'
              }
            `}>
              {isHomebuyer ? <Home className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
                {isHomebuyer ? 'Homebuyer Report' : 'Investor Report'}
              </h1>
              <p className="text-on-surface-variant">
                {isHomebuyer
                  ? 'Powered by HomeReady Score'
                  : 'Powered by InvestorEdge Score'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-on-surface mb-1">Select your market(s)</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            Choose up to 5 markets to analyze
          </p>
          <MarketSelector
            markets={markets}
            onAdd={(market) => setMarkets([...markets, market])}
            onRemove={(id) => setMarkets(markets.filter(m => m.id !== id))}
            accentColor={isHomebuyer ? 'primary' : 'tertiary'}
          />
        </section>

        <section>
          <PersonalizationPanel
            type={type}
            values={inputs}
            onChange={(key, value) => setInputs({ ...inputs, [key]: value })}
          />
        </section>

        <motion.button
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={`
            w-full py-4 px-6 rounded-2xl font-semibold text-lg
            flex items-center justify-center gap-3
            transition-all duration-300
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isHomebuyer
              ? 'bg-primary text-on-primary hover:bg-primary/90 shadow-lg shadow-primary/25'
              : 'bg-tertiary text-on-tertiary hover:bg-tertiary/90 shadow-lg shadow-tertiary/25'
            }
          `}
          whileHover={canGenerate ? { scale: 1.01 } : {}}
          whileTap={canGenerate ? { scale: 0.99 } : {}}
        >
          {isGenerating ? (
            <>
              <motion.div
                className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
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
    if (!userId) { setLoading(false); return; }
    fetchReportList({ userId, limit: 10 })
      .then(data => setReports(data as ReportListItem[]))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-on-surface-variant border border-dashed border-outline-variant/50 rounded-2xl">
        No reports yet. Create your first one above!
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
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${report.user_type === 'homebuyer'
              ? 'bg-primary/10 text-primary'
              : 'bg-tertiary/10 text-tertiary'
            }
          `}>
            {report.user_type === 'homebuyer' ? <Home className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-on-surface truncate">{report.title}</div>
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
  const searchParams = useSearchParams();
  const urlType = searchParams.get('rtype') as 'homebuyer' | 'investor' | null;
  const [selectedType, setSelectedType] = useState<'homebuyer' | 'investor' | null>(
    urlType && ['homebuyer', 'investor'].includes(urlType) ? urlType : null
  );

  if (selectedType) {
    return (
      <ReportCreationPage
        type={selectedType}
        onBack={() => setSelectedType(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: 'Reports' }]} className="mb-6" />
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight mb-3">
            Create a Report
          </h1>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto">
            Get AI-powered market analysis tailored to your goals
          </p>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <ReportCard type="homebuyer" onSelect={() => setSelectedType('homebuyer')} />
          <ReportCard type="investor" onSelect={() => setSelectedType('investor')} />
        </div>

        {/* Recent Reports */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
              <History className="w-4 h-4 text-on-surface-variant" />
            </div>
            <h2 className="text-xl font-semibold text-on-surface">Recent Reports</h2>
          </div>
          <ReportHistory />
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant font-medium">Loading reports...</p>
      </div>
    </div>
  );
}

function ReportsLanding() {
  const features = [
    { icon: <BarChart3 className="w-5 h-5" />, title: 'Deep Market Analysis', desc: 'AI-powered insights across 60+ metrics' },
    { icon: <TrendingUp className="w-5 h-5" />, title: 'Investment Projections', desc: 'Cash flow, appreciation, and risk scenarios' },
    { icon: <MapPin className="w-5 h-5" />, title: 'Market Comparisons', desc: 'Side-by-side analysis of up to 5 markets' },
    { icon: <Zap className="w-5 h-5" />, title: 'Personalized Insights', desc: 'Tailored to your budget and priorities' },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: 'Reports' }]} className="mb-8" />

        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight mb-3">
            AI-Powered Market Reports
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
            Get comprehensive market analysis tailored to homebuyers and investors. See a real report below.
          </p>
        </div>

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
                <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Sample Report</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-on-surface mb-1.5">
                View a Full Market Report
              </h2>
              <p className="text-on-surface-variant text-sm sm:text-base max-w-lg">
                See exactly what you get — AI narratives, score breakdowns, market trends, and investment analysis for a real metro area.
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
            <div key={f.title} className="flex items-start gap-3 p-4 rounded-xl bg-surface-container border border-outline-variant/30">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-on-surface">{f.title}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">{f.desc}</p>
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
        fallback={<ReportsLanding />}
      >
        <ReportsContent />
      </EntitlementGate>
    </Suspense>
  );
}
