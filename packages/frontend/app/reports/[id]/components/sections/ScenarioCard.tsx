'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

export function ScenarioCard({ section, report }: SectionProps) {
  const scenarios = section.config?.scenarios || [
    { name: 'Conservative', appreciation: 2, rent_growth: 2 },
    { name: 'Moderate', appreciation: 4, rent_growth: 3 },
    { name: 'Optimistic', appreciation: 6, rent_growth: 4 },
  ];

  const basePrice = report.populated_data?.current?.zhvi as number || 400000;
  const baseRent = report.populated_data?.current?.zori as number || 2000;
  const holdPeriod = section.config?.hold_period || 5;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-primary" />
        {holdPeriod}-Year Scenarios
      </h3>

      <div className="grid md:grid-cols-3 gap-4">
        {scenarios.map((scenario: { name: string; appreciation: number; rent_growth: number }) => {
          const futureValue = basePrice * Math.pow(1 + scenario.appreciation / 100, holdPeriod);
          const futureRent = baseRent * Math.pow(1 + scenario.rent_growth / 100, holdPeriod);
          const appreciation = futureValue - basePrice;

          const bgColor = scenario.name === 'Conservative' ? 'bg-blue-50' :
                         scenario.name === 'Optimistic' ? 'bg-green-50' : 'bg-surface';

          return (
            <div key={scenario.name} className={`p-4 rounded-xl ${bgColor}`}>
              <h4 className="font-semibold text-on-surface mb-3">{scenario.name}</h4>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-on-surface-variant">Home Value</p>
                  <p className="text-lg font-bold text-on-surface">{formatMetricValue('price', futureValue)}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{formatMetricValue('price', appreciation)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-on-surface-variant">Monthly Rent</p>
                  <p className="text-lg font-bold text-on-surface">{formatMetricValue('price', futureRent)}</p>
                </div>

                <div className="pt-2 border-t border-outline-variant">
                  <p className="text-xs text-on-surface-variant">Assumptions</p>
                  <p className="text-sm text-on-surface">{scenario.appreciation}% annual appreciation</p>
                  <p className="text-sm text-on-surface">{scenario.rent_growth}% rent growth</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
