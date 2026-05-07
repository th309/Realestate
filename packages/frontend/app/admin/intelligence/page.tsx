/**
 * Admin Intelligence Configuration & Health Dashboard
 *
 * Provides a centralized view for managing market intelligence settings
 * (briefing generation, news ingestion, LLM provider) and monitoring
 * system health (coverage, freshness, availability).
 */

'use client';

import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useIntelligenceConfig } from './hooks/useIntelligenceConfig';
import { useIntelligenceStats } from './hooks/useIntelligenceStats';
import { ConfigSection } from './components/ConfigSection';
import { SystemHealthPanel } from './components/SystemHealthPanel';

export default function IntelligenceAdminPage() {
  const {
    categories,
    updateConfigValue,
    recentlySaved,
    refreshAll: refreshConfig,
  } = useIntelligenceConfig();

  const {
    stats,
    loading: statsLoading,
    error: statsError,
    refresh: refreshStats,
  } = useIntelligenceStats();

  const handleRefresh = () => {
    refreshConfig();
    refreshStats();
  };

  const hasAnyError =
    statsError ||
    Object.values(categories).some((cat) => cat.error !== null);

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto p-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-on-surface">
              Market Intelligence
            </h1>
            <p className="text-sm text-on-surface-variant">
              Configure intelligence features and monitor system health
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-surface-container-high transition-colors"
            title="Refresh all data"
          >
            <RefreshCw className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>

        {/* Global error banner */}
        {hasAnyError && (
          <div className="mb-4 p-4 bg-error-container/30 border border-error/20 rounded-lg flex items-center gap-2 text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">
              Some data failed to load. Individual sections show details.
            </span>
          </div>
        )}

        {/* Config sections */}
        <div className="space-y-4 mb-6">
          {Object.entries(categories).map(([categoryKey, category]) => (
            <ConfigSection
              key={categoryKey}
              label={category.label}
              entries={category.entries}
              loading={category.loading}
              error={category.error}
              onSave={updateConfigValue}
              recentlySaved={recentlySaved}
            />
          ))}
        </div>

        {/* System health panel */}
        <SystemHealthPanel
          stats={stats}
          loading={statsLoading}
          error={statsError}
        />
      </div>
    </div>
  );
}
