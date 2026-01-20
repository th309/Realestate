/**
 * FormulaEditorTab Component
 *
 * Allows editing of scoring formula weights and metrics.
 * Provides live preview and A/B test deployment.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface FormulaComponent {
  name: string;
  label: string;
  weight: number;
  metrics: string[];
}

interface FormulaVersion {
  id: string;
  version: string;
  scoreType: string;
  formulaConfig: {
    components: Record<string, FormulaComponent>;
  };
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

export function FormulaEditorTab() {
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [selectedScoreType, setSelectedScoreType] = useState<string>('market_health');
  const [selectedVersion, setSelectedVersion] = useState<FormulaVersion | null>(null);
  const [draftConfig, setDraftConfig] = useState<Record<string, FormulaComponent> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVersions();
  }, [selectedScoreType]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${apiUrl}/api/admin/formula-versions?scoreType=${selectedScoreType}`,
      );

      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
        const active = data.versions?.find((v: FormulaVersion) => v.isActive);
        if (active) {
          setSelectedVersion(active);
          setDraftConfig(active.formulaConfig.components);
        }
      }
    } catch (error) {
      console.error('Error fetching formula versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (componentName: string, weight: number) => {
    if (!draftConfig) return;

    setDraftConfig({
      ...draftConfig,
      [componentName]: {
        ...draftConfig[componentName],
        weight: Math.max(0, Math.min(1, weight)),
      },
    });
  };

  const getTotalWeight = useCallback(() => {
    if (!draftConfig) return 0;
    return Object.values(draftConfig).reduce((sum, c) => sum + c.weight, 0);
  }, [draftConfig]);

  const hasChanges = useCallback(() => {
    if (!selectedVersion || !draftConfig) return false;
    return (
      JSON.stringify(selectedVersion.formulaConfig.components) !== JSON.stringify(draftConfig)
    );
  }, [selectedVersion, draftConfig]);

  const saveAsDraft = async () => {
    if (!draftConfig || !selectedVersion) return;

    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/admin/formula-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoreType: selectedScoreType,
          formulaConfig: { components: draftConfig },
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
    if (!draftConfig || !selectedVersion) return;

    const testName = prompt('Enter A/B test name:');
    if (!testName) return;

    setSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // First create the new version
      const versionRes = await fetch(`${apiUrl}/api/admin/formula-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scoreType: selectedScoreType,
          formulaConfig: { components: draftConfig },
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
      {/* Score Type Selector */}
      <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
        <label className="text-sm font-medium text-on-surface-variant">Score Type:</label>
        <div className="flex gap-2">
          {['market_health', 'homeready', 'investoredge'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedScoreType(type)}
              className={`
                px-4 py-2 text-sm rounded-lg transition-colors
                ${
                  selectedScoreType === type
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                }
              `}
            >
              {formatScoreType(type)}
            </button>
          ))}
        </div>
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
                    setDraftConfig(version.formulaConfig.components);
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
                {selectedVersion ? `Editing v${selectedVersion.version}` : 'Select a version'}
              </h3>
              {draftConfig && (
                <div
                  className={`text-sm ${
                    Math.abs(getTotalWeight() - 1) < 0.01
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  Total: {(getTotalWeight() * 100).toFixed(0)}%
                </div>
              )}
            </div>

            {draftConfig && (
              <div className="space-y-4">
                {Object.entries(draftConfig).map(([name, component]) => (
                  <div
                    key={name}
                    className="p-4 rounded-lg bg-surface-container-low space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-on-surface">{component.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          value={Math.round(component.weight * 100)}
                          onChange={(e) =>
                            handleWeightChange(name, parseInt(e.target.value, 10) / 100)
                          }
                          className="w-16 px-2 py-1 text-right rounded border border-outline bg-surface text-on-surface"
                        />
                        <span className="text-sm text-on-surface-variant">%</span>
                      </div>
                    </div>

                    {/* Weight slider */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={component.weight * 100}
                      onChange={(e) =>
                        handleWeightChange(name, parseInt(e.target.value, 10) / 100)
                      }
                      className="w-full"
                    />

                    {/* Metrics list */}
                    <div className="flex flex-wrap gap-1">
                      {component.metrics.map((metric) => (
                        <span
                          key={metric}
                          className="text-xs px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container"
                        >
                          {metric}
                        </span>
                      ))}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatScoreType(type: string): string {
  const labels: Record<string, string> = {
    market_health: 'Market Health',
    homeready: 'HomeReady',
    investoredge: 'InvestorEdge',
  };
  return labels[type] || type;
}
