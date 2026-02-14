'use client';

import React from 'react';
import type { ReportInstance } from '../../../types';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#f59e0b'];

interface ComparisonRadarProps {
  report: ReportInstance;
}

interface Geography {
  id: string;
  name: string;
}

interface ScoreDetails {
  [key: string]: number;
}

function getScoreDetails(
  report: ReportInstance,
  geoId: string,
  scoreType: 'homeready' | 'investoredge'
): ScoreDetails | undefined {
  if (geoId === report.primary_geography_id) {
    // Get score details from the scores_snapshot
    if (scoreType === 'homeready') {
      return report.scores_snapshot?.homeready_details as ScoreDetails | undefined;
    } else {
      return report.scores_snapshot?.investoredge_details as ScoreDetails | undefined;
    }
  }
  // For comparison geographies, get from comparisons data
  const compData = report.populated_data?.comparisons?.[geoId];
  if (compData?.scores) {
    const detailsKey = `${scoreType}_details`;
    const scoreData = compData.scores[detailsKey];
    if (scoreData && typeof scoreData === 'object' && !('score' in scoreData)) {
      return scoreData as unknown as ScoreDetails;
    }
  }
  return undefined;
}

function formatMetricName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export function ComparisonRadar({ report }: ComparisonRadarProps): React.ReactElement {
  const geographies: Geography[] = [
    { id: report.primary_geography_id, name: report.primary_geography_name },
    ...(report.comparison_geographies || []),
  ];

  const scoreType = report.user_type === 'investor' ? 'investoredge' : 'homeready';

  const primaryDetails = getScoreDetails(report, report.primary_geography_id, scoreType);

  if (!primaryDetails) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Score Comparison</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Score data not available</span>
        </div>
      </div>
    );
  }

  const metrics = Object.keys(primaryDetails);
  const radarData = metrics.map((metric) => {
    const point: Record<string, string | number> = {
      metric: formatMetricName(metric),
    };
    geographies.forEach((geo) => {
      const details = getScoreDetails(report, geo.id, scoreType);
      point[geo.name] = details?.[metric] ?? 0;
    });
    return point;
  });

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Score Comparison</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
            {geographies.map((geo, index) => (
              <Radar
                key={geo.id}
                name={geo.name}
                dataKey={geo.name}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
