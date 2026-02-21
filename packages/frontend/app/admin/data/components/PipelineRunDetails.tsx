'use client';

import { useState, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';

interface RunDetail {
  metricName: string;
  geography: string;
  status: 'success' | 'failed' | 'skipped';
  recordsInserted: number;
  recordsFailed: number;
  recordsDelta: number;
  periodsAdded: string[];
  latestDataDate: string | null;
  freshnessDays: number;
  coveragePct: number;
  coverageDelta: number;
  durationMs: number;
  errorMessage: string | null;
}

interface RunDetailsResponse {
  runId: string;
  pipelineName: string;
  details: RunDetail[];
  summary: {
    totalMetrics: number;
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

const METRIC_DISPLAY_NAMES: Record<string, string> = {
  zhvi: 'ZHVI (Home Value)',
  zori: 'ZORI (Rent Index)',
  zordi: 'ZORDI (Rent Demand)',
  zhvf: 'ZHVF (Forecast)',
  inventory: 'For-Sale Inventory',
  new_listings: 'New Listings',
  pending_sales: 'Pending Sales',
  list_price: 'Median List Price',
  sale_price: 'Median Sale Price',
  sale_to_list: 'Sale-to-List Ratio',
  dom: 'Days on Market',
  price_cuts: 'Price Cuts',
  market_heat: 'Market Heat Index',
  new_con_price: 'New Construction Price',
  new_con_price_sqft: 'New Construction $/SqFt',
  new_con_sales: 'New Construction Sales',
  sales_count: 'Sales Count',
  homeowner_income: 'Homeowner Income Needed',
  renter_income: 'Renter Income Needed',
  affordable_price: 'Affordable Home Price',
  years_to_save: 'Years to Save',
  homeowner_afford: 'Homeowner Affordability',
  renter_afford: 'Renter Affordability',
};

const GEO_BADGE_COLORS: Record<string, string> = {
  state: 'bg-blue-100 text-blue-700',
  metro: 'bg-purple-100 text-purple-700',
  county: 'bg-amber-100 text-amber-700',
  city: 'bg-teal-100 text-teal-700',
  zip: 'bg-rose-100 text-rose-700',
};

function getFreshnessColor(days: number): string {
  if (days <= 36) return 'text-emerald-600';
  if (days <= 60) return 'text-amber-600';
  return 'text-rose-600';
}

function formatDelta(value: number): string {
  if (value === 0) return '';
  return value > 0 ? `+${value}` : `${value}`;
}

export function PipelineRunDetails({ runId }: { runId: string }) {
  const [data, setData] = useState<RunDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPIRaw(`/api/health/pipeline-runs/${runId}/details`, { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return <div className="p-4 text-sm text-on-surface-variant animate-pulse">Loading details...</div>;
  }

  if (!data || !data.details || data.details.length === 0) {
    return <div className="p-4 text-sm text-on-surface-variant">No per-metric details recorded for this run.</div>;
  }

  return (
    <div className="border-t border-outline-variant bg-surface-container-low/50">
      {/* Summary chips */}
      <div className="flex gap-3 px-4 py-2 text-xs">
        <span className="text-on-surface-variant">{data.summary.totalMetrics} metrics</span>
        {data.summary.succeeded > 0 && (
          <span className="text-emerald-600">{data.summary.succeeded} succeeded</span>
        )}
        {data.summary.failed > 0 && (
          <span className="text-rose-600">{data.summary.failed} failed</span>
        )}
        {data.summary.skipped > 0 && (
          <span className="text-on-surface-variant">{data.summary.skipped} skipped</span>
        )}
      </div>

      {/* Detail table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-t border-outline-variant text-on-surface-variant">
            <th className="text-left px-4 py-1.5 font-medium">Metric</th>
            <th className="text-left px-2 py-1.5 font-medium">Geo</th>
            <th className="text-center px-2 py-1.5 font-medium">Status</th>
            <th className="text-right px-2 py-1.5 font-medium">Records</th>
            <th className="text-right px-2 py-1.5 font-medium">Latest</th>
            <th className="text-right px-2 py-1.5 font-medium">Fresh</th>
            <th className="text-right px-4 py-1.5 font-medium">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {data.details.map((detail) => (
            <tr
              key={`${detail.metricName}-${detail.geography}`}
              className={`border-t border-outline-variant/50 ${
                detail.status === 'failed' ? 'bg-rose-50' : ''
              }`}
            >
              <td className="px-4 py-1.5 font-medium text-on-surface">
                {METRIC_DISPLAY_NAMES[detail.metricName] || detail.metricName}
              </td>
              <td className="px-2 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  GEO_BADGE_COLORS[detail.geography] || 'bg-gray-100 text-gray-700'
                }`}>
                  {detail.geography}
                </span>
              </td>
              <td className="px-2 py-1.5 text-center">
                {detail.status === 'success' && <span className="text-emerald-600">OK</span>}
                {detail.status === 'failed' && <span className="text-rose-600">FAIL</span>}
                {detail.status === 'skipped' && <span className="text-on-surface-variant">SKIP</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {detail.recordsInserted.toLocaleString()}
                {detail.recordsDelta !== 0 && (
                  <span className={detail.recordsDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {' '}{formatDelta(detail.recordsDelta)}
                  </span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                {detail.latestDataDate
                  ? new Date(detail.latestDataDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '\u2014'}
              </td>
              <td className={`px-2 py-1.5 text-right ${getFreshnessColor(detail.freshnessDays)}`}>
                {detail.latestDataDate ? `${detail.freshnessDays}d` : '\u2014'}
              </td>
              <td className="px-4 py-1.5 text-right tabular-nums">
                {detail.coveragePct > 0 ? `${detail.coveragePct.toFixed(1)}%` : '\u2014'}
                {detail.coverageDelta !== 0 && (
                  <span className={detail.coverageDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {' '}{formatDelta(parseFloat(detail.coverageDelta.toFixed(1)))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
