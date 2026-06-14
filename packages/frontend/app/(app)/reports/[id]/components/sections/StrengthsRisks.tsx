'use client';

import React from 'react';
import { SectionProps } from '../types';
import { Shield, AlertTriangle } from 'lucide-react';

export function StrengthsRisks({ section, report }: SectionProps) {
  const strengths = section.config?.strengths || report.ai_narrative?.strengths || [];
  const risks = section.config?.risks || report.ai_narrative?.risks || [];

  const strengthsArray = Array.isArray(strengths) ? strengths : [];
  const risksArray = Array.isArray(risks) ? risks : [];
  const hasData = strengthsArray.length > 0 || risksArray.length > 0;

  if (!hasData) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">Strengths & Risks</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Strengths and risks analysis not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-green-800">Strengths</h3>
        </div>
        {strengthsArray.length > 0 ? (
          <ul className="space-y-2">
            {strengthsArray.map((item: string, i: number) => (
              <li key={i} className="text-green-700">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-green-600 text-sm italic">No strengths identified yet</p>
        )}
      </div>
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-semibold text-red-800">Risks</h3>
        </div>
        {risksArray.length > 0 ? (
          <ul className="space-y-2">
            {risksArray.map((item: string, i: number) => (
              <li key={i} className="text-red-700">{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-red-600 text-sm italic">No risks identified yet</p>
        )}
      </div>
    </div>
  );
}
