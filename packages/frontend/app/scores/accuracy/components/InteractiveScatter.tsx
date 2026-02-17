/**
 * Interactive Scatter Plot
 *
 * Score vs Return scatter with filter controls and live correlation stats.
 * Wraps the D3 ScatterPlot component with validation data.
 */

'use client';

import { useState, useMemo } from 'react';
import { ScatterPlot, type ScatterDataPoint } from '@/lib/visualizations/d3/ScatterPlot';
import { useValidationScatter } from '@/lib/data';
import type { ValidationGeography, ValidationScoreType } from '@/lib/data';

const GEO_OPTIONS: { value: ValidationGeography; label: string }[] = [
  { value: 'metro', label: 'Metro Areas' },
  { value: 'county', label: 'Counties' },
  { value: 'zip', label: 'ZIP Codes' },
];

const SCORE_OPTIONS: { value: ValidationScoreType; label: string }[] = [
  { value: 'homeready', label: 'HomeReady' },
  { value: 'investoredge', label: 'InvestorEdge' },
  { value: 'markethealth', label: 'MarketHealth' },
];

export function InteractiveScatter() {
  const [geography, setGeography] = useState<ValidationGeography>('metro');
  const [scoreType, setScoreType] = useState<ValidationScoreType>('homeready');

  const { data: rawData, isLoading, error } = useValidationScatter({
    geography,
    scoreType,
    limit: 1000,
  });

  const scatterData: ScatterDataPoint[] = useMemo(() => {
    if (!rawData) return [];
    return rawData
      .filter((p) => p.excessVsState1y !== null)
      .map((p) => {
        // Assign quartile category for coloring
        const q = p.score < 25 ? 'Q1' : p.score < 50 ? 'Q2' : p.score < 75 ? 'Q3' : 'Q4';
        return {
          id: p.geographyId,
          label: p.geographyName,
          x: p.score,
          y: p.excessVsState1y!,
          category: q,
        };
      });
  }, [rawData]);

  // Compute live correlation stats
  const stats = useMemo(() => {
    if (scatterData.length < 3) return null;
    const n = scatterData.length;
    const xs = scatterData.map((d) => d.x);
    const ys = scatterData.map((d) => d.y);

    // Pearson
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }
    const pearson = sumX2 > 0 && sumY2 > 0 ? sumXY / Math.sqrt(sumX2 * sumY2) : 0;

    // Spearman (rank-based)
    const rankArr = (arr: number[]) => {
      const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const ranks = new Array(n);
      for (let i = 0; i < n; i++) ranks[sorted[i].i] = i + 1;
      return ranks;
    };
    const rx = rankArr(xs);
    const ry = rankArr(ys);
    let sumD2 = 0;
    for (let i = 0; i < n; i++) {
      const d = rx[i] - ry[i];
      sumD2 += d * d;
    }
    const spearman = 1 - (6 * sumD2) / (n * (n * n - 1));

    return { pearson, spearman, n };
  }, [scatterData]);

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Interactive Backtest
      </p>
      <h2 className="text-2xl font-[var(--font-source-serif)] text-on-surface mt-2">
        See the Correlation for Yourself
      </h2>
      <p className="text-on-surface-variant mt-2 max-w-2xl">
        Every dot is a real market. Higher scores on the x-axis should map to higher returns on
        the y-axis. Filter by geography and score type to explore.
      </p>

      {/* Filter controls */}
      <div className="flex flex-wrap gap-3 mt-6">
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-surface-variant font-medium">Geography</label>
          <select
            value={geography}
            onChange={(e) => setGeography(e.target.value as ValidationGeography)}
            className="text-sm bg-surface-container border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            {GEO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-surface-variant font-medium">Score</label>
          <select
            value={scoreType}
            onChange={(e) => setScoreType(e.target.value as ValidationScoreType)}
            className="text-sm bg-surface-container border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            {SCORE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Live stats */}
      {stats && (
        <div className="flex gap-4 mt-4">
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Spearman &rho;</p>
            <p className="text-lg font-bold text-primary">{stats.spearman.toFixed(3)}</p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Pearson r</p>
            <p className="text-lg font-bold text-on-surface">{stats.pearson.toFixed(3)}</p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">R&sup2;</p>
            <p className="text-lg font-bold text-on-surface">{(stats.pearson ** 2).toFixed(3)}</p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-2 border border-outline-variant">
            <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">Markets</p>
            <p className="text-lg font-bold text-on-surface">{stats.n.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="mt-6 bg-surface-container-low border border-outline-variant rounded-2xl p-4">
        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-sm text-on-surface-variant">Loading scatter data...</div>
          </div>
        ) : error ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-sm text-error">Failed to load data. Is the backend running?</div>
          </div>
        ) : scatterData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center">
            <div className="text-sm text-on-surface-variant">No data available for this combination.</div>
          </div>
        ) : (
          <ScatterPlot
            data={scatterData}
            xLabel="PropertyIQ Score"
            yLabel="1Y Excess Return vs State (%)"
            xFormat="integer"
            yFormat="percentAbs"
            height={550}
            dotRadius={4}
            showRegression
            colorByCategory
            sizeByValue={false}
          />
        )}
      </div>

      <p className="text-xs text-on-surface-variant mt-2 italic">
        Competitors show a static PNG. Ours is fully interactive &mdash; filter, hover, zoom.
      </p>
    </section>
  );
}
