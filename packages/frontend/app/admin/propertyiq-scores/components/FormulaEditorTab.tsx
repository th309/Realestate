/**
 * FormulaEditorTab Component
 *
 * Allows editing of scoring formula weights and metrics.
 * Provides live preview and A/B test deployment.
 * Shows formula components with weights per score type and geography.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

// New features-based format from SCORING_SYSTEM_SPEC
interface FormulaFeature {
  name: string;
  weight: number;
  direction: '+' | '-';
}

// Legacy components format (for backward compatibility)
interface FormulaComponent {
  name: string;
  label: string;
  weight: number;
  metrics: string[];
}

interface FormulaConfig {
  features?: FormulaFeature[];
  components?: Record<string, FormulaComponent>;
}

interface FormulaVersion {
  id: string;
  version: string;
  scoreType: string;
  geography: string;
  formulaConfig: FormulaConfig;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface ConfidenceData {
  confidenceScore: number;
  confidenceLevel: string;
  rSquared: number | null;
  sampleCount: number | null;
}

const SCORE_TYPES = [
  { value: 'market_health', label: 'Market Health' },
  { value: 'homeready', label: 'HomeReady' },
  { value: 'investoredge', label: 'InvestorEdge' },
];

const GEOGRAPHIES = [
  { value: 'metro', label: 'Metro' },
  { value: 'county', label: 'County' },
  { value: 'zip', label: 'ZIP' },
];

// Component labels for display
const COMPONENT_LABELS: Record<string, string> = {
  demand_strength: 'Demand Strength',
  supply_balance: 'Supply Balance',
  price_stability: 'Price Stability',
  economic_foundation: 'Economic Foundation',
  affordability: 'Affordability',
  market_timing: 'Market Timing',
  stability: 'Stability',
  growth_potential: 'Growth Potential',
  livability: 'Livability',
  cash_flow: 'Cash Flow',
  rent_demand: 'Rent Demand',
  appreciation: 'Appreciation',
  entry_point: 'Entry Point',
  risk: 'Risk',
};

export function FormulaEditorTab() {
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [selectedScoreType, setSelectedScoreType] = useState<string>('market_health');
  const [selectedGeography, setSelectedGeography] = useState<string>('metro');
  const [selectedVersion, setSelectedVersion] = useState<FormulaVersion | null>(null);
  const [draftFeatures, setDraftFeatures] = useState<FormulaFeature[] | null>(null);
  const [confidenceData, setConfidenceData] = useState<ConfidenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [selectedScoreType, selectedGeography]);

  useEffect(() => {
    if (selectedVersion) {
      fetchConfidenceData();
    }
  }, [selectedVersion, selectedGeography]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/admin/formula-versions?scoreType=${selectedScoreType}&geography=${selectedGeography}`,
        { credentials: 'include' },
      );

      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
        const active = data.versions?.find((v: FormulaVersion) => v.isActive);
        if (active) {
          setSelectedVersion(active);
          // Extract features from the formula config
          setDraftFeatures(active.formulaConfig.features || []);
        } else {
          setSelectedVersion(null);
          setDraftFeatures(null);
        }
      }
    } catch (error) {
      console.error('Error fetching formula versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfidenceData = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/admin/backtest-runs/confidence/summary`,
        { credentials: 'include' },
      );

      if (response.ok) {
        const data = await response.json();
        // Find confidence for selected score type and geography
        const found = data.data?.find(
          (c: { scoreType: string; geographyType: string }) =>
            c.scoreType === selectedScoreType && c.geographyType === selectedGeography,
        );
        if (found) {
          setConfidenceData({
            confidenceScore: found.confidenceScore,
            confidenceLevel: found.confidenceLevel,
            rSquared: found.rSquared,
            sampleCount: found.sampleCount,
          });
        } else {
          setConfidenceData(null);
        }
      }
    } catch (error) {
      console.error('Error fetching confidence data:', error);
      setConfidenceData(null);
    }
  };

  const handleFeatureWeightChange = (featureName: string, weight: number) => {
    if (!draftFeatures) return;

    setDraftFeatures(
      draftFeatures.map((f) =>
        f.name === featureName ? { ...f, weight: Math.max(0, Math.min(100, weight)) } : f,
      ),
    );
  };

  const handleFeatureDirectionChange = (featureName: string, direction: '+' | '-') => {
    if (!draftFeatures) return;

    setDraftFeatures(
      draftFeatures.map((f) => (f.name === featureName ? { ...f, direction } : f)),
    );
  };

  const getTotalWeight = useCallback(() => {
    if (!draftFeatures) return 0;
    return draftFeatures.reduce((sum, f) => sum + f.weight, 0);
  }, [draftFeatures]);

  const hasChanges = useCallback(() => {
    if (!selectedVersion || !draftFeatures) return false;
    return (
      JSON.stringify(selectedVersion.formulaConfig.features) !== JSON.stringify(draftFeatures)
    );
  }, [selectedVersion, draftFeatures]);

  const saveAsDraft = async () => {
    if (!draftFeatures || !selectedVersion) return;

    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/admin/formula-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scoreType: selectedScoreType,
          geography: selectedGeography,
          formulaConfig: { features: draftFeatures },
          parentVersion: selectedVersion.version,
          description: 'Draft update',
        }),
      });

      if (response.ok) {
        await fetchVersions();
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setSaving(false);
    }
  };

  const deployWithABTest = async () => {
    if (!draftFeatures || !selectedVersion) return;

    const testName = prompt('Enter A/B test name:');
    if (!testName) return;

    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // First create the new version
      const versionRes = await fetch(`${apiUrl}/api/admin/formula-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scoreType: selectedScoreType,
          geography: selectedGeography,
          formulaConfig: { features: draftFeatures },
          parentVersion: selectedVersion.version,
          description: `A/B test: ${testName}`,
        }),
      });

      if (!versionRes.ok) throw new Error('Failed to create version');

      const newVersion = await versionRes.json();

      // Then create the A/B test
      const testRes = await fetch(`${apiUrl}/api/admin/ab-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: testName,
          scoreType: selectedScoreType,
          controlVersion: selectedVersion.version,
          treatmentVersion: newVersion.version,
          trafficPercentage: 10,
        }),
      });

      if (testRes.ok) {
        alert('A/B test created successfully');
        await fetchVersions();
      }
    } catch (error) {
      console.error('Error deploying A/B test:', error);
      alert('Failed to deploy A/B test');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Score Type and Geography Selector */}
      <div className="flex flex-wrap items-center gap-6 p-4 bg-surface-container rounded-xl">
        {/* Score Type */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-on-surface-variant">Score Type:</label>
          <div className="flex gap-2">
            {SCORE_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setSelectedScoreType(type.value)}
                className={`
                  px-4 py-2 text-sm rounded-lg transition-colors
                  ${
                    selectedScoreType === type.value
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                  }
                `}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Geography */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-on-surface-variant">Geography:</label>
          <div className="flex gap-2">
            {GEOGRAPHIES.map((geo) => (
              <button
                key={geo.value}
                onClick={() => setSelectedGeography(geo.value)}
                className={`
                  px-4 py-2 text-sm rounded-lg transition-colors
                  ${
                    selectedGeography === geo.value
                      ? 'bg-secondary text-on-secondary'
                      : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                  }
                `}
              >
                {geo.label}
              </button>
            ))}
          </div>
        </div>

        {/* Confidence Indicator */}
        {confidenceData && (
          <div className="ml-auto flex items-center gap-3 px-4 py-2 rounded-lg bg-surface-container-low">
            <span className="text-sm text-on-surface-variant">Confidence:</span>
            <span
              className={`
                px-2 py-0.5 rounded text-sm font-medium
                ${
                  confidenceData.confidenceLevel === 'high'
                    ? 'bg-green-100 text-green-800'
                    : confidenceData.confidenceLevel === 'medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }
              `}
            >
              {confidenceData.confidenceScore.toFixed(0)}% ({confidenceData.confidenceLevel})
            </span>
            {confidenceData.rSquared !== null && (
              <span className="text-xs text-on-surface-variant">
                R² = {confidenceData.rSquared.toFixed(3)}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-on-surface-variant">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Version History */}
          <div className="bg-surface-container rounded-xl p-4 space-y-4">
            <h3 className="font-medium text-on-surface">Version History</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => {
                    setSelectedVersion(version);
                    setDraftFeatures(version.formulaConfig.features || []);
                  }}
                  className={`
                    w-full p-3 text-left rounded-lg transition-colors
                    ${
                      selectedVersion?.id === version.id
                        ? 'bg-primary-container'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-on-surface">v{version.version}</span>
                    <div className="flex gap-1">
                      {version.isActive && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                      {version.isDefault && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          Default
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">
                    {new Date(version.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2 bg-surface-container rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-on-surface">
                {selectedVersion
                  ? `Editing v${selectedVersion.version} (${selectedGeography})`
                  : 'Select a version'}
              </h3>
              {draftFeatures && (
                <div
                  className={`text-sm ${
                    Math.abs(getTotalWeight() - 100) < 1
                      ? 'text-green-600'
                      : 'text-yellow-600'
                  }`}
                >
                  Total: {getTotalWeight().toFixed(1)}%
                </div>
              )}
            </div>

            {draftFeatures && draftFeatures.length > 0 ? (
              <div className="space-y-4">
                {draftFeatures.map((feature) => (
                  <div
                    key={feature.name}
                    className="p-4 rounded-lg bg-surface-container-low space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Direction indicator */}
                        <button
                          onClick={() =>
                            handleFeatureDirectionChange(
                              feature.name,
                              feature.direction === '+' ? '-' : '+',
                            )
                          }
                          className={`
                            w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold
                            ${
                              feature.direction === '+'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }
                          `}
                          title={
                            feature.direction === '+'
                              ? 'Higher is better'
                              : 'Lower is better'
                          }
                        >
                          {feature.direction}
                        </button>
                        <div>
                          <span className="font-medium text-on-surface">
                            {formatMetricName(feature.name)}
                          </span>
                          <span className="ml-2 text-xs text-on-surface-variant">
                            ({feature.name})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={feature.weight.toFixed(1)}
                          onChange={(e) =>
                            handleFeatureWeightChange(
                              feature.name,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-20 px-2 py-1 text-right rounded border border-outline bg-surface text-on-surface"
                        />
                        <span className="text-sm text-on-surface-variant">%</span>
                      </div>
                    </div>

                    {/* Weight slider */}
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.5"
                        value={feature.weight}
                        onChange={(e) =>
                          handleFeatureWeightChange(
                            feature.name,
                            parseFloat(e.target.value),
                          )
                        }
                        className="flex-1"
                      />
                      <div
                        className="h-2 rounded"
                        style={{
                          width: `${feature.weight}%`,
                          maxWidth: '100px',
                          backgroundColor:
                            feature.direction === '+'
                              ? 'var(--md-sys-color-primary)'
                              : 'var(--md-sys-color-error)',
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={saveAsDraft}
                    disabled={saving || !hasChanges()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary text-on-secondary disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    onClick={deployWithABTest}
                    disabled={saving || !hasChanges()}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-on-primary disabled:opacity-50"
                  >
                    Deploy with A/B Test
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-on-surface-variant">
                {selectedVersion
                  ? 'No features defined for this version'
                  : 'Select a version from the list to edit'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMetricName(metric: string): string {
  // Convert snake_case to Title Case and handle common abbreviations
  return metric
    .split('_')
    .map((word) => {
      // Handle common abbreviations
      if (word === 'yoy') return 'YoY';
      if (word === 'yy') return 'YoY';
      if (word === 'zhvi') return 'ZHVI';
      if (word === 'zori') return 'ZORI';
      if (word === 'grm') return 'GRM';
      if (word === 'cagr') return 'CAGR';
      if (word === 'dom') return 'DOM';
      if (word === 'pct') return '%';
      if (word === '3y') return '3Y';
      if (word === '5y') return '5Y';
      if (word === '36m') return '36M';
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
