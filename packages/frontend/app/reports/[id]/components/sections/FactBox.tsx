'use client';

import React from 'react';
import { SectionProps } from '../types';
import { Lightbulb } from 'lucide-react';

export function FactBox({ section, report }: SectionProps) {
  const facts = section.config?.facts || [];
  const title = section.config?.title || 'Key Facts';

  // Can also pull facts from AI narrative
  const aiFacts = report.ai_narrative?.key_facts;
  const displayFacts = facts.length > 0 ? facts : (Array.isArray(aiFacts) ? aiFacts : []);

  if (displayFacts.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">{title}</h3>
      </div>
      <ul className="space-y-2">
        {displayFacts.map((fact: string, index: number) => (
          <li key={index} className="flex items-start gap-2 text-amber-800">
            <span className="text-amber-500 mt-1">•</span>
            <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
