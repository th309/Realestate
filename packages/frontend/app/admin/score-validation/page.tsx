/**
 * Score Validation Dashboard
 *
 * Admin dashboard showing PropertyIQ score predictive accuracy.
 * Displays:
 * - Summary metrics (correlation, hit rate, avg excess return)
 * - Quintile performance chart
 * - Score vs return scatter plot
 * - Time series accuracy
 * - Geography breakdown
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState } from 'react';
import { ValidationSummaryCards } from './components/ValidationSummaryCards';
import { QuintilePerformanceChart } from './components/QuintilePerformanceChart';
import { ScoreVsReturnScatter } from './components/ScoreVsReturnScatter';

type ScoreType = 'homeready' | 'investoredge' | 'markethealth' | 'all';
type GeographyType = 'metro' | 'county' | 'zip' | 'all';
type Horizon = '1y' | '3y';

export default function ScoreValidationPage() {
  const [scoreType, setScoreType] = useState<ScoreType>('homeready');
  const [geography, setGeography] = useState<GeographyType>('metro');
  const [horizon, setHorizon] = useState<Horizon>('1y');

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-on-surface">
                Score Validation Dashboard
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Analyzing PropertyIQ score predictive accuracy against actual market returns
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

      {/* Filters */}
      <div className="bg-surface-container-low border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Score Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-on-surface-variant">Score Type:</label>
              <select
                value={scoreType}
                onChange={(e) => setScoreType(e.target.value as ScoreType)}
                className="px-3 py-1.5 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Types</option>
                <option value="homeready">HomeReady</option>
                <option value="investoredge">InvestorEdge</option>
                <option value="markethealth">Market Health</option>
              </select>
            </div>

            {/* Geography Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-on-surface-variant">Geography:</label>
              <select
                value={geography}
                onChange={(e) => setGeography(e.target.value as GeographyType)}
                className="px-3 py-1.5 text-sm border border-outline-variant rounded-lg bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Geographies</option>
                <option value="metro">Metro Areas</option>
                <option value="county">Counties</option>
                <option value="zip">ZIP Codes</option>
              </select>
            </div>

            {/* Horizon Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-on-surface-variant">Horizon:</label>
              <div className="flex rounded-lg border border-outline-variant overflow-hidden">
                <button
                  onClick={() => setHorizon('1y')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    horizon === '1y'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface text-on-surface hover:bg-surface-container'
                  }`}
                >
                  1 Year
                </button>
                <button
                  onClick={() => setHorizon('3y')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    horizon === '3y'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface text-on-surface hover:bg-surface-container'
                  }`}
                >
                  3 Years
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <ValidationSummaryCards
          scoreType={scoreType === 'all' ? undefined : scoreType}
          geography={geography === 'all' ? undefined : geography}
        />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quintile Performance */}
          <QuintilePerformanceChart
            scoreType={scoreType === 'all' ? undefined : scoreType}
            geography={geography === 'all' ? undefined : geography}
            horizon={horizon}
          />

          {/* Score vs Return Scatter */}
          <ScoreVsReturnScatter
            scoreType={scoreType === 'all' ? undefined : scoreType}
            geography={geography === 'all' ? undefined : geography}
            horizon={horizon}
          />
        </div>

        {/* Methodology Note */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
          <h3 className="text-sm font-semibold text-on-surface mb-2">Methodology Notes</h3>
          <ul className="text-xs text-on-surface-variant space-y-1">
            <li>
              <strong>Correlation:</strong> Pearson correlation between score at prediction time and actual return at horizon end
            </li>
            <li>
              <strong>Hit Rate:</strong> Percentage of scores above 70 that outperformed their state benchmark
            </li>
            <li>
              <strong>Excess Return:</strong> Location return minus state benchmark return (eliminates macro effects)
            </li>
            <li>
              <strong>Quintiles:</strong> Scores divided into 5 equal groups to show performance spread
            </li>
            <li>
              <strong>Formula Version:</strong> Backfilled scores use current formulas (v3.0.0) - past scores would have been different with old formulas
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
