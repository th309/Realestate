/**
 * ComponentAnalysis Component
 *
 * Displays component-level confidence breakdown for PropertyIQ scores.
 * Features:
 * - Per-component R², directional accuracy, quintile spread
 * - Highlight weak components (confidence < 60%)
 * - Drill-down to individual metrics
 * - Score type selector
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ComponentMetrics {
  name: string;
  weight: number;
  r2: number;
  directional_accuracy: number;
  quintile_spread: number;
  sample_size: number;
  confidence: number;
  status: string;
  metrics: {
    name: string;
    importance: number;
    correlation: number;
  }[];
}

interface ComponentAnalysisData {
  score_type: string;
  geography_type: string;
  horizon: string;
  components: ComponentMetrics[];
  overall_confidence: number;
}

interface ComponentAnalysisProps {
  geography?: {
    type: string;
    id: string;
    name: string;
  } | null;
}

const SCORE_TYPES = [
  { id: 'market_health', label: 'Market Health' },
  { id: 'homeready', label: 'HomeReady' },
  { id: 'investoredge', label: 'InvestorEdge' },
];

const GEOGRAPHY_TYPES = ['state', 'metro', 'county', 'zip'];
const HORIZONS = ['6m', '1y', '3y', '5y'];

// Component definitions by score type
const COMPONENT_DEFINITIONS: Record<string, { name: string; weight: number }[]> = {
  market_health: [
    { name: 'Demand Strength', weight: 0.35 },
    { name: 'Supply Balance', weight: 0.25 },
    { name: 'Price Stability', weight: 0.25 },
    { name: 'Economic Foundation', weight: 0.15 },
  ],
  homeready: [
    { name: 'Affordability', weight: 0.30 },
    { name: 'Market Timing', weight: 0.25 },
    { name: 'Growth Potential', weight: 0.20 },
    { name: 'Stability', weight: 0.15 },
    { name: 'Liquidity', weight: 0.10 },
  ],
  investoredge: [
    { name: 'Cash Flow', weight: 0.35 },
    { name: 'Appreciation', weight: 0.20 },
    { name: 'Rent Demand', weight: 0.20 },
    { name: 'Entry Point', weight: 0.15 },
    { name: 'Stability', weight: 0.10 },
  ],
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    healthy: { bg: 'bg-green-100', text: 'text-green-800' },
    monitor: { bg: 'bg-amber-100', text: 'text-amber-800' },
    review: { bg: 'bg-orange-100', text: 'text-orange-800' },
    broken: { bg: 'bg-red-100', text: 'text-red-800' },
  };
  const c = config[status] || config.broken;
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.bg} ${c.text} capitalize`}>
      {status}
    </span>
  );
}

function ComponentBar({ component }: { component: ComponentMetrics }) {
  const [expanded, setExpanded] = useState(false);
  const isWeak = component.confidence < 60;

  return (
    <div className={`border rounded-lg ${isWeak ? 'border-error/50 bg-error/5' : 'border-outline-variant'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-container-low transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-on-surface">{component.name}</span>
          <span className="text-sm text-on-surface-variant">
            ({(component.weight * 100).toFixed(0)}% weight)
          </span>
          {isWeak && (
            <span className="text-xs text-error font-medium">Low confidence</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-on-surface">
              {component.confidence.toFixed(0)}%
            </div>
            <StatusBadge status={component.status} />
          </div>
          <svg
            className={`w-5 h-5 text-on-surface-variant transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-outline-variant">
          {/* Metrics summary */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-surface-container-low rounded p-3">
              <div className="text-xs text-on-surface-variant">R²</div>
              <div className="text-lg font-medium text-on-surface">{component.r2.toFixed(3)}</div>
            </div>
            <div className="bg-surface-container-low rounded p-3">
              <div className="text-xs text-on-surface-variant">Directional Accuracy</div>
              <div className="text-lg font-medium text-on-surface">
                {(component.directional_accuracy * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-surface-container-low rounded p-3">
              <div className="text-xs text-on-surface-variant">Quintile Spread</div>
              <div className="text-lg font-medium text-on-surface">
                {component.quintile_spread.toFixed(2)}
              </div>
            </div>
            <div className="bg-surface-container-low rounded p-3">
              <div className="text-xs text-on-surface-variant">Sample Size</div>
              <div className="text-lg font-medium text-on-surface">
                {component.sample_size.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Individual metrics */}
          {component.metrics && component.metrics.length > 0 && (
            <div>
              <div className="text-sm font-medium text-on-surface mb-2">Contributing Metrics</div>
              <div className="space-y-2">
                {component.metrics.map((metric, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-surface-container-low rounded"
                  >
                    <span className="text-sm text-on-surface">{metric.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-on-surface-variant">
                        Importance: <span className="font-medium">{(metric.importance * 100).toFixed(1)}%</span>
                      </span>
                      <span className="text-on-surface-variant">
                        Correlation: <span className="font-medium">{metric.correlation.toFixed(3)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ComponentAnalysis({ geography }: ComponentAnalysisProps) {
  const [scoreType, setScoreType] = useState('homeready');
  const [geographyType, setGeographyType] = useState(geography?.type || 'metro');
  const [horizon, setHorizon] = useState('1y');
  const [data, setData] = useState<ComponentAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate mock data for now (would come from API in real implementation)
  const generateMockData = useCallback((): ComponentAnalysisData => {
    const components = COMPONENT_DEFINITIONS[scoreType]?.map((def) => {
      const confidence = 50 + Math.random() * 40;
      return {
        name: def.name,
        weight: def.weight,
        r2: 0.2 + Math.random() * 0.4,
        directional_accuracy: 0.5 + Math.random() * 0.3,
        quintile_spread: Math.random() * 0.1,
        sample_size: Math.floor(500 + Math.random() * 1500),
        confidence,
        status: confidence >= 70 ? 'healthy' : confidence >= 55 ? 'monitor' : confidence >= 40 ? 'review' : 'broken',
        metrics: [
          { name: 'Primary Metric', importance: 0.4 + Math.random() * 0.2, correlation: 0.3 + Math.random() * 0.4 },
          { name: 'Secondary Metric', importance: 0.2 + Math.random() * 0.2, correlation: 0.2 + Math.random() * 0.3 },
          { name: 'Supporting Metric', importance: 0.1 + Math.random() * 0.1, correlation: 0.1 + Math.random() * 0.2 },
        ],
      };
    }) || [];

    const avgConfidence = components.reduce((sum, c) => sum + c.confidence * c.weight, 0);

    return {
      score_type: scoreType,
      geography_type: geographyType,
      horizon,
      components,
      overall_confidence: avgConfidence,
    };
  }, [scoreType, geographyType, horizon]);

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 500);
  }, [generateMockData]);

  const weakComponents = data?.components.filter((c) => c.confidence < 60) || [];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Score Type</label>
          <select
            value={scoreType}
            onChange={(e) => setScoreType(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
          >
            {SCORE_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Geography Type</label>
          <select
            value={geographyType}
            onChange={(e) => setGeographyType(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
          >
            {GEOGRAPHY_TYPES.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Horizon</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-surface text-on-surface"
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-error-container text-on-error-container rounded-lg">{error}</div>
      ) : data ? (
        <>
          {/* Overall summary */}
          <div className="bg-surface-container rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-on-surface">
                  {SCORE_TYPES.find((t) => t.id === scoreType)?.label} Analysis
                </h3>
                <p className="text-sm text-on-surface-variant">
                  {geographyType.charAt(0).toUpperCase() + geographyType.slice(1)} / {horizon} horizon
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-on-surface">
                  {data.overall_confidence.toFixed(0)}%
                </div>
                <div className="text-sm text-on-surface-variant">Overall Confidence</div>
              </div>
            </div>

            {weakComponents.length > 0 && (
              <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg">
                <div className="flex items-center gap-2 text-error font-medium text-sm">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {weakComponents.length} component{weakComponents.length > 1 ? 's' : ''} with low
                  confidence
                </div>
                <div className="mt-1 text-sm text-on-surface-variant">
                  {weakComponents.map((c) => c.name).join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Component breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium text-on-surface">Component Breakdown</h4>
            {data.components.map((component, idx) => (
              <ComponentBar key={idx} component={component} />
            ))}
          </div>

          {/* Weight distribution visualization */}
          <div className="bg-surface-container rounded-lg p-4">
            <h4 className="font-medium text-on-surface mb-3">Weight Distribution</h4>
            <div className="flex h-8 rounded-lg overflow-hidden">
              {data.components.map((component, idx) => {
                const colors = [
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-amber-500',
                  'bg-purple-500',
                  'bg-pink-500',
                ];
                return (
                  <div
                    key={idx}
                    className={`${colors[idx % colors.length]} relative group`}
                    style={{ width: `${component.weight * 100}%` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                      {(component.weight * 100).toFixed(0)}%
                    </div>
                    <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded text-xs">
                      {component.name}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {data.components.map((component, idx) => {
                const colors = [
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-amber-500',
                  'bg-purple-500',
                  'bg-pink-500',
                ];
                return (
                  <div key={idx} className="flex items-center gap-1.5 text-sm">
                    <span className={`w-3 h-3 rounded ${colors[idx % colors.length]}`}></span>
                    <span className="text-on-surface-variant">{component.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
