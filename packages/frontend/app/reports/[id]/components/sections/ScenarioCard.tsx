'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, Target, AlertTriangle } from 'lucide-react';
import { getMetricWithAliases } from '../utils/metricHelpers';

interface Scenario {
  name: string;
  appreciation: number;
  rent_growth: number;
}

export function ScenarioCard({ section, report }: SectionProps): React.ReactElement {
  const scenarios: Scenario[] = section.config?.scenarios || [
    { name: 'Conservative', appreciation: 2, rent_growth: 2 },
    { name: 'Moderate', appreciation: 4, rent_growth: 3 },
    { name: 'Optimistic', appreciation: 6, rent_growth: 4 },
  ];

  const basePrice = getMetricWithAliases(report, 'zhvi');
  const baseRent = getMetricWithAliases(report, 'zori');
  const holdPeriod = section.config?.hold_period || 5;

  // Check if we have the required data
  if (basePrice === null) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          {holdPeriod}-Year Scenarios
        </h3>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant py-8">
          <AlertTriangle className="w-5 h-5" />
          <span>Home value data not available for scenario projections</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        {holdPeriod}-Year Scenarios
      </h3>

      <div className="grid md:grid-cols-3 gap-4">
        {scenarios.map((scenario) => {
          const futureValue = basePrice * Math.pow(1 + scenario.appreciation / 100, holdPeriod);
          const futureRent = baseRent !== null
            ? baseRent * Math.pow(1 + scenario.rent_growth / 100, holdPeriod)
            : null;
          const appreciation = futureValue - basePrice;

          const getBgColor = (): string => {
            if (scenario.name === 'Conservative') return 'bg-blue-50';
            if (scenario.name === 'Optimistic') return 'bg-green-50';
            return 'bg-surface';
          };

          return (
            <div key={scenario.name} className={`p-4 rounded-xl ${getBgColor()}`}>
              <h4 className="font-semibold text-on-surface mb-3">{scenario.name}</h4>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-on-surface-variant">Home Value</p>
                  <p className="text-lg font-bold text-on-surface">{formatMetricValue(futureValue, 'currency')}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{formatMetricValue(appreciation, 'currency')}
                  </p>
                </div>

                {futureRent !== null && (
                  <div>
                    <p className="text-xs text-on-surface-variant">Monthly Rent</p>
                    <p className="text-lg font-bold text-on-surface">{formatMetricValue(futureRent, 'currency')}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-outline-variant">
                  <p className="text-xs text-on-surface-variant">Assumptions</p>
                  <p className="text-sm text-on-surface">{scenario.appreciation}% annual appreciation</p>
                  {futureRent !== null && (
                    <p className="text-sm text-on-surface">{scenario.rent_growth}% rent growth</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
