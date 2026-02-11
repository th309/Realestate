'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { Sliders } from 'lucide-react';

export function ProFormaSensitivity({ section, report }: SectionProps) {
  const proforma = report.populated_data?.pro_forma;
  const sensitivity = proforma?.sensitivity;

  if (!sensitivity) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Sensitivity Analysis</h3>
        <p className="text-on-surface-variant text-center py-4">Sensitivity data not available</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Sliders className="w-5 h-5 text-primary" />
        Sensitivity Analysis
      </h3>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Rent Scenarios */}
        <div>
          <h4 className="font-semibold text-on-surface mb-3">Rent Change Impact</h4>
          <div className="space-y-2">
            {(sensitivity.rent_scenarios || []).map((scenario: { rent_change_pct: number; cash_flow: number }) => (
              <div key={scenario.rent_change_pct} className="flex justify-between items-center p-2 bg-surface rounded-lg">
                <span className={`${scenario.rent_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {scenario.rent_change_pct > 0 ? '+' : ''}{scenario.rent_change_pct}% rent
                </span>
                <span className={`font-medium ${scenario.cash_flow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatMetricValue('price', scenario.cash_flow)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rate Scenarios */}
        <div>
          <h4 className="font-semibold text-on-surface mb-3">Interest Rate Impact</h4>
          <div className="space-y-2">
            {(sensitivity.rate_scenarios || []).map((scenario: { rate: number; cash_flow: number }) => (
              <div key={scenario.rate} className="flex justify-between items-center p-2 bg-surface rounded-lg">
                <span className="text-on-surface">{scenario.rate}% rate</span>
                <span className={`font-medium ${scenario.cash_flow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatMetricValue('price', scenario.cash_flow)}/mo
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
