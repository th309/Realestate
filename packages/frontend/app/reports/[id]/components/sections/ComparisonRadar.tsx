'use client';

import React from 'react';
import { SectionProps } from '../types';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const COLORS = ['#2563eb', '#dc2626', '#16a34a'];

export function ComparisonRadar({ section, report }: SectionProps) {
  const details = report.user_type === 'investor'
    ? report.scores_snapshot?.investoredge_details
    : report.scores_snapshot?.homeready_details;

  if (!details) {
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

  const data = Object.entries(details).map(([key, value]) => ({
    metric: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    [report.primary_geography_name]: value,
  }));

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">Score Comparison</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
            <Radar
              name={report.primary_geography_name}
              dataKey={report.primary_geography_name}
              stroke={COLORS[0]}
              fill={COLORS[0]}
              fillOpacity={0.3}
            />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
