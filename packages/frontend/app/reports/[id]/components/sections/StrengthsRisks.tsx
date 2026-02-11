'use client';

import React from 'react';
import { SectionProps } from '../types';
import { Shield, AlertTriangle } from 'lucide-react';

export function StrengthsRisks({ section, report }: SectionProps) {
  const strengths = section.config?.strengths || report.ai_narrative?.strengths || [];
  const risks = section.config?.risks || report.ai_narrative?.risks || [];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-green-800">Strengths</h3>
        </div>
        <ul className="space-y-2">
          {(Array.isArray(strengths) && strengths.length > 0 ? strengths : ['Market data analysis in progress']).map((item: string, i: number) => (
            <li key={i} className="text-green-700">{item}</li>
          ))}
        </ul>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-red-800">Risks</h3>
        </div>
        <ul className="space-y-2">
          {(Array.isArray(risks) && risks.length > 0 ? risks : ['Risk analysis in progress']).map((item: string, i: number) => (
            <li key={i} className="text-red-700">{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
