/**
 * PropertyIQ Scores Admin Dashboard
 *
 * Admin interface for managing PropertyIQ scoring system.
 * Provides tabs for score visualization, backtesting, formula editing, and alerts.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useCallback } from 'react';
import { ScoreCardsTab } from './components/ScoreCardsTab';
import { BacktestingTab } from './components/BacktestingTab';
import { FormulaEditorTab } from './components/FormulaEditorTab';
import { AlertsTab } from './components/AlertsTab';
import { HistoryTab } from './components/HistoryTab';
import { MLValidationTab } from './components/MLValidationTab';
import { AutomatedRunsTab } from './components/AutomatedRunsTab';
import { GeographySelector } from './components/GeographySelector';

type TabId = 'scores' | 'backtesting' | 'automated-runs' | 'formula' | 'ml-validation' | 'alerts' | 'history';

interface Tab {
  id: TabId;
  label: string;
  description: string;
}

const TABS: Tab[] = [
  { id: 'scores', label: 'Score Cards', description: 'View and analyze scores' },
  { id: 'backtesting', label: 'Backtesting', description: 'Run and view backtest results' },
  { id: 'automated-runs', label: 'Automated Runs', description: 'View automated backtest pipeline runs' },
  { id: 'formula', label: 'Formula Editor', description: 'Edit scoring formulas' },
  { id: 'ml-validation', label: 'ML Validation', description: 'Compare formulas vs AutoGluon ML' },
  { id: 'alerts', label: 'Alerts', description: 'Confidence alerts' },
  { id: 'history', label: 'History', description: 'Version history' },
];

export default function PropertyIQAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('scores');
  const [selectedGeography, setSelectedGeography] = useState<{
    type: 'state' | 'metro' | 'county' | 'zip';
    id: string;
    name: string;
  } | null>(null);

  const handleGeographyChange = useCallback(
    (type: 'state' | 'metro' | 'county' | 'zip', id: string, name: string) => {
      setSelectedGeography({ type, id, name });
    },
    [],
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scores':
        return <ScoreCardsTab geography={selectedGeography} />;
      case 'backtesting':
        return <BacktestingTab geography={selectedGeography} />;
      case 'automated-runs':
        return <AutomatedRunsTab />;
      case 'formula':
        return <FormulaEditorTab />;
      case 'ml-validation':
        return <MLValidationTab />;
      case 'alerts':
        return <AlertsTab />;
      case 'history':
        return <HistoryTab />;
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
                PropertyIQ Score Management
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Admin dashboard for scoring system configuration and analysis
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-tertiary-container text-on-tertiary-container">
                Admin Access
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Geography Selector */}
      <div className="bg-surface-container-low border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <GeographySelector
            selected={selectedGeography}
            onChange={handleGeographyChange}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="bg-surface border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </main>
    </div>
  );
}
