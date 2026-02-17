/**
 * HistoryTab Component
 *
 * Displays version history and A/B test results.
 * Shows formula changes over time.
 *
 * Material Design 3 compliant.
 */

'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';

interface FormulaVersion {
  id: string;
  version: string;
  scoreType: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  isActive: boolean;
  isDefault: boolean;
  changeNotes: string | null;
}

interface ABTest {
  id: string;
  name: string;
  scoreType: string;
  controlVersion: string;
  treatmentVersion: string;
  trafficPercentage: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'rolled_back';
  startedAt: string | null;
  endedAt: string | null;
}

export function HistoryTab() {
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [abTests, setABTests] = useState<ABTest[]>([]);
  const [selectedScoreType, setSelectedScoreType] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'versions' | 'abtests'>('versions');

  useEffect(() => {
    fetchData();
  }, [selectedScoreType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const typeFilter = selectedScoreType !== 'all' ? `?scoreType=${selectedScoreType}` : '';

      const [versionsRes, testsRes] = await Promise.all([
        fetchAPIRaw(`/api/admin/formula-versions${typeFilter}`, { credentials: 'include' }),
        fetchAPIRaw(`/api/admin/ab-tests${typeFilter}`, { credentials: 'include' }),
      ]);

      if (versionsRes.ok) {
        const data = await versionsRes.json();
        setVersions(data.versions || []);
      }

      if (testsRes.ok) {
        const data = await testsRes.json();
        setABTests(data.tests || []);
      }
    } catch (error) {
      console.error('Error fetching history data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activateVersion = async (version: string, scoreType: string) => {
    if (!confirm(`Activate version ${version}? This will make it the active formula.`)) return;

    try {
      const response = await fetchAPIRaw(`/api/admin/formula-versions/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version, scoreType }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error activating version:', error);
    }
  };

  const getStatusBadge = (status: ABTest['status']) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-green-100 text-green-800',
      paused: 'bg-amber-100 text-amber-800',
      completed: 'bg-blue-100 text-blue-800',
      rolled_back: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-surface-container rounded-xl">
        <div className="flex items-center gap-2">
          <label className="text-sm text-on-surface-variant">Score Type:</label>
          <select
            value={selectedScoreType}
            onChange={(e) => setSelectedScoreType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-outline bg-surface text-on-surface"
          >
            <option value="all">All Scores</option>
            <option value="market_health">Market Health</option>
            <option value="homeready">HomeReady</option>
            <option value="investoredge">InvestorEdge</option>
          </select>
        </div>

        <div className="flex-1" />

        <div className="flex gap-1">
          <button
            onClick={() => setView('versions')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              view === 'versions'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface'
            }`}
          >
            Versions
          </button>
          <button
            onClick={() => setView('abtests')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              view === 'abtests'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface'
            }`}
          >
            A/B Tests
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-on-surface-variant">Loading...</div>
      ) : view === 'versions' ? (
        <VersionsTable
          versions={versions}
          onActivate={activateVersion}
        />
      ) : (
        <ABTestsTable tests={abTests} />
      )}
    </div>
  );
}

function VersionsTable({
  versions,
  onActivate,
}: {
  versions: FormulaVersion[];
  onActivate: (version: string, scoreType: string) => void;
}) {
  if (versions.length === 0) {
    return (
      <div className="p-8 text-center bg-surface-container rounded-xl text-on-surface-variant">
        No version history found
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-surface-container-high">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Version
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Score Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Created
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Notes
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {versions.map((version) => (
            <tr key={version.id} className="hover:bg-surface-container-low">
              <td className="px-4 py-3 text-sm font-mono text-on-surface">
                v{version.version}
              </td>
              <td className="px-4 py-3 text-sm text-on-surface">
                {formatScoreType(version.scoreType)}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {version.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                  {version.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Default
                    </span>
                  )}
                  {!version.isActive && !version.isDefault && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-on-surface-variant">
                {new Date(version.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-sm text-on-surface-variant max-w-xs truncate">
                {version.changeNotes || version.description || '-'}
              </td>
              <td className="px-4 py-3 text-right">
                {!version.isActive && (
                  <button
                    onClick={() => onActivate(version.version, version.scoreType)}
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    Activate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ABTestsTable({ tests }: { tests: ABTest[] }) {
  const getStatusBadge = (status: ABTest['status']) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      running: 'bg-green-100 text-green-800',
      paused: 'bg-amber-100 text-amber-800',
      completed: 'bg-blue-100 text-blue-800',
      rolled_back: 'bg-red-100 text-red-800',
    };
    return colors[status] || colors.draft;
  };

  if (tests.length === 0) {
    return (
      <div className="p-8 text-center bg-surface-container rounded-xl text-on-surface-variant">
        No A/B tests found
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-surface-container-high">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Score Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Control
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Treatment
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant uppercase">
              Traffic
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase">
              Started
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {tests.map((test) => (
            <tr key={test.id} className="hover:bg-surface-container-low">
              <td className="px-4 py-3 text-sm font-medium text-on-surface">
                {test.name}
              </td>
              <td className="px-4 py-3 text-sm text-on-surface">
                {formatScoreType(test.scoreType)}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-on-surface-variant">
                v{test.controlVersion}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-on-surface-variant">
                v{test.treatmentVersion}
              </td>
              <td className="px-4 py-3 text-sm text-center text-on-surface-variant">
                {test.trafficPercentage}%
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(test.status)}`}>
                  {test.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-on-surface-variant">
                {test.startedAt
                  ? new Date(test.startedAt).toLocaleDateString()
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
