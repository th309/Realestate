'use client';

import React from 'react';
import { SectionProps } from '../types';
import { ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';

export function ProsConsTable({ section, report }: SectionProps) {
  // AI-generated pros and cons from narrative - no hardcoded fallbacks
  const pros = section.config?.pros || report.ai_narrative?.pros || [];
  const cons = section.config?.cons || report.ai_narrative?.cons || [];

  const prosArray = Array.isArray(pros) ? pros : [];
  const consArray = Array.isArray(cons) ? cons : [];
  const hasData = prosArray.length > 0 || consArray.length > 0;

  if (!hasData) {
    return (
      <div className="bg-surface-container rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-on-surface mb-4">{report.primary_geography_name}</h3>
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Pros and cons analysis not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-on-surface mb-4">{report.primary_geography_name}</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ThumbsUp className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-700">Pros</span>
          </div>
          {prosArray.length > 0 ? (
            <ul className="space-y-2">
              {prosArray.map((pro: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-on-surface">
                  <span className="text-green-500 mt-1">+</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">No pros identified yet</p>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ThumbsDown className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-700">Cons</span>
          </div>
          {consArray.length > 0 ? (
            <ul className="space-y-2">
              {consArray.map((con: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-on-surface">
                  <span className="text-red-500 mt-1">-</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-on-surface-variant text-sm">No cons identified yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
