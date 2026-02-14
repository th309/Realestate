'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { AlertTriangle, DollarSign, Plus, Minus, Equal } from 'lucide-react';

export function ProFormaCashFlow({ section, report }: SectionProps) {
  const proforma = report.populated_data?.pro_forma;
  const cashFlow = proforma?.monthly_cash_flow;

  if (!cashFlow) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Monthly Cash Flow
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
          <AlertTriangle className="w-8 h-8 mb-2 text-outline" />
          <p>Cash flow data not available</p>
        </div>
      </div>
    );
  }

  const isPositive = cashFlow.net_cash_flow > 0;

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        Monthly Cash Flow
      </h3>

      <div className="space-y-3">
        {/* Income */}
        <div className="p-4 bg-green-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-700">Income</span>
          </div>
          <div className="flex justify-between">
            <span className="text-green-600">Gross Rent</span>
            <span className="font-medium text-green-700">{formatMetricValue(cashFlow.gross_rent, 'currency')}</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="p-4 bg-red-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Minus className="w-4 h-4 text-red-600" />
            <span className="font-semibold text-red-700">Expenses</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-red-600">Vacancy</span>
              <span className="text-red-700">-{formatMetricValue(cashFlow.vacancy, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Management</span>
              <span className="text-red-700">-{formatMetricValue(cashFlow.management, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Maintenance</span>
              <span className="text-red-700">-{formatMetricValue(cashFlow.maintenance, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Mortgage P&I</span>
              <span className="text-red-700">-{formatMetricValue(cashFlow.mortgage_pi, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Property Tax</span>
              <span className="text-red-700">-{formatMetricValue(cashFlow.property_tax, 'currency')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">Insurance</span>
              <span className="text-red-700">-{formatMetricValue(cashFlow.insurance, 'currency')}</span>
            </div>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className={`p-4 rounded-xl ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Equal className={`w-4 h-4 ${isPositive ? 'text-green-700' : 'text-red-700'}`} />
              <span className={`font-semibold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>Net Cash Flow</span>
            </div>
            <span className={`text-xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              {isPositive ? '+' : ''}{formatMetricValue(cashFlow.net_cash_flow, 'currency')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
