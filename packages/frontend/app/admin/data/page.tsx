/**
 * Data Admin Dashboard
 *
 * Admin interface for monitoring data cards, sources, pipelines, and alerts.
 * Provides a unified view of all data health across the PropertyIQ platform.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { StatusBanner } from './components/StatusBanner';
import { DataCardsTab } from './components/DataCardsTab';
import { DataSourcesTab } from './components/DataSourcesTab';
import { PipelineRunsTab } from './components/PipelineRunsTab';
import { DataAlertsTab } from './components/DataAlertsTab';

type TabId = 'data-cards' | 'data-sources' | 'pipeline-runs' | 'alerts';

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'data-cards', label: 'Data Cards', description: 'Metric display health and coverage' },
  { id: 'data-sources', label: 'Data Sources', description: 'Source availability and freshness' },
  { id: 'pipeline-runs', label: 'Pipeline Runs', description: 'ETL pipeline status' },
  { id: 'alerts', label: 'Alerts', description: 'Active data alerts' },
];

interface HealthSummary {
  status: 'healthy' | 'degraded' | 'unhealthy';
  cardsTotal: number;
  cardsHealthy: number;
  sourcesTotal: number;
  sourcesAvailable: number;
  pipelinesTotal: number;
  pipelinesHealthy: number;
  lastCheck: string;
}

export default function DataAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('data-cards');
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealthSummary = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/health/data-summary`);

      if (response.ok) {
        const data = await response.json();
        setHealthSummary(data);
      } else {
        // Mock data for development
        setHealthSummary({
          status: 'healthy',
          cardsTotal: 48,
          cardsHealthy: 46,
          sourcesTotal: 6,
          sourcesAvailable: 6,
          pipelinesTotal: 10,
          pipelinesHealthy: 9,
          lastCheck: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error fetching health summary:', error);
      // Mock data for development
      setHealthSummary({
        status: 'healthy',
        cardsTotal: 48,
        cardsHealthy: 46,
        sourcesTotal: 6,
        sourcesAvailable: 6,
        pipelinesTotal: 10,
        pipelinesHealthy: 9,
        lastCheck: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchHealthSummary();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchHealthSummary, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHealthSummary]);

  const handleRefresh = () => {
    fetchHealthSummary();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'data-cards':
        return <DataCardsTab />;
      case 'data-sources':
        return <DataSourcesTab />;
      case 'pipeline-runs':
        return <PipelineRunsTab />;
      case 'alerts':
        return <DataAlertsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-on-surface">
                Data Management
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Monitor data cards, sources, and pipeline health
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50"
                data-testid="refresh-button"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-tertiary-container text-on-tertiary-container">
                Admin Access
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Status Banner */}
      <div className="border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <StatusBanner
            summary={healthSummary}
            loading={loading}
            lastRefresh={lastRefresh}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                className={`
                  px-4 py-3 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline'
                  }
                `}
                title={tab.description}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      <main
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
        role="tabpanel"
        id={`${activeTab}-panel`}
      >
        {renderTabContent()}
      </main>
    </div>
  );
}
