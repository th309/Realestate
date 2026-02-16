'use client';

import React, { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import type { ReportInstance } from '../../../../types';
import { generateObjections } from './prepObjections.constants';
import { ObjectionCard } from './ObjectionCard';

/**
 * Props for PrepObjectionHandlers section
 */
export interface PrepObjectionHandlersProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * PrepObjectionHandlers - Data-backed responses to common client objections
 *
 * Provides 4-6 common real estate objections with expandable, data-driven
 * responses. Each objection card shows the client question in quotes
 * and reveals a factual response with supporting data points when expanded.
 *
 * Uses the editorial design system from report-theme.css.
 */
export function PrepObjectionHandlers({
  report,
  className = '',
}: PrepObjectionHandlersProps): React.ReactElement {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const objections = generateObjections(report);

  // AI narrative
  const aiNarrative =
    report.ai_narrative?.prep_objections ??
    (report.ai_narratives?.prep_objections as string | string[] | undefined);

  const toggleObjection = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (objections.length === 0) {
    return (
      <SectionCard title="Objection Handlers" icon={Shield} className={className}>
        <div
          className="flex items-center justify-center gap-3 py-8"
          style={{ color: 'var(--report-stone-light)' }}
        >
          <AlertTriangle className="w-5 h-5" />
          <span className="report-body">
            Insufficient data to generate objection handlers for this area.
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Objection Handlers" icon={Shield} className={className}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--report-space-sm)',
        }}
      >
        {objections.map((item) => (
          <ObjectionCard
            key={item.id}
            item={item}
            isOpen={openIds.has(item.id)}
            onToggle={() => toggleObjection(item.id)}
          />
        ))}
      </div>

      {/* AI Analysis */}
      {aiNarrative && (
        <div style={{ marginTop: 'var(--report-space-lg)' }}>
          <AIAnalysisBlock
            content={
              typeof aiNarrative === 'string'
                ? aiNarrative
                : Array.isArray(aiNarrative)
                ? aiNarrative
                : String(aiNarrative)
            }
            title="AI Objection Analysis"
            variant="insight"
          />
        </div>
      )}
    </SectionCard>
  );
}

export default PrepObjectionHandlers;
