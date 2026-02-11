'use client';

import React from 'react';
import { SectionProps } from '../types';
import { formatMetricValue } from '@/lib/data';
import { Settings } from 'lucide-react';

export function ProFormaAssumptions({ section, report }: SectionProps) {
  const proforma = report.populated_data?.pro_forma;
  const assumptions = proforma?.assumptions;

  if (!assumptions) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Investment Assumptions</h3>
        <p className="text-on-surface-variant text-center py-4">Pro forma data not available</p>
      </div>
    );
  }

  const rows = [
    { label: 'Purchase Price', value: formatMetricValue('price', assumptions.purchase_price) },
    { label: 'Down Payment', value: `${formatMetricValue('price', assumptions.down_payment)} (${assumptions.down_payment_pct}%)` },
    { label: 'Loan Amount', value: formatMetricValue('price', assumptions.loan_amount) },
    { label: 'Interest Rate', value: `${assumptions.interest_rate}%` },
    { label: 'Loan Term', value: `${assumptions.loan_term_years} years` },
    { label: 'Expected Rent', value: `${formatMetricValue('price', assumptions.expected_rent)}/mo` },
    { label: 'Vacancy Rate', value: `${assumptions.vacancy_pct}%` },
    { label: 'Management Fee', value: `${assumptions.management_pct}%` },
    { label: 'Maintenance', value: `${assumptions.maintenance_pct}%` },
    { label: 'Property Tax', value: `${formatMetricValue('price', assumptions.property_tax_annual)}/yr` },
    { label: 'Insurance', value: `${formatMetricValue('price', assumptions.insurance_annual)}/yr` },
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
