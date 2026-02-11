'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { AlertTriangle, Settings } from 'lucide-react';

export function ProFormaAssumptions({ section, report }: SectionProps) {
  const proforma = report.populated_data?.pro_forma;
  const assumptions = proforma?.assumptions;

  if (!assumptions) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Investment Assumptions
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-on-surface-variant">
          <AlertTriangle className="w-8 h-8 mb-2 text-outline" />
          <p>Pro forma data not available</p>
        </div>
      </div>
    );
  }

  const rows = [
    { label: 'Purchase Price', value: formatMetricValue(assumptions.purchase_price, 'currency') },
    { label: 'Down Payment', value: `${formatMetricValue(assumptions.down_payment, 'currency')} (${assumptions.down_payment_pct}%)` },
    { label: 'Loan Amount', value: formatMetricValue(assumptions.loan_amount, 'currency') },
    { label: 'Interest Rate', value: `${assumptions.interest_rate}%` },
    { label: 'Loan Term', value: `${assumptions.loan_term_years} years` },
    { label: 'Expected Rent', value: `${formatMetricValue(assumptions.expected_rent, 'currency')}/mo` },
    { label: 'Vacancy Rate', value: `${assumptions.vacancy_pct}%` },
    { label: 'Management Fee', value: `${assumptions.management_pct}%` },
    { label: 'Maintenance', value: `${assumptions.maintenance_pct}%` },
    { label: 'Property Tax', value: `${formatMetricValue(assumptions.property_tax_annual, 'currency')}/yr` },
    { label: 'Insurance', value: `${formatMetricValue(assumptions.insurance_annual, 'currency')}/yr` },
  ];

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary" />
        Investment Assumptions
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between p-3 bg-surface rounded-xl">
            <span className="text-on-surface-variant">{row.label}</span>
            <span className="font-medium text-on-surface">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
