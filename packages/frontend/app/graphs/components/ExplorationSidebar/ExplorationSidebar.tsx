'use client';

import React from 'react';
import { MyMarket } from '../../hooks/useMyMarkets';
import { TemplateType } from '../../hooks/useGraphsState';
import { QuestionCards } from './QuestionCards';
import { QuinnInsight } from './QuinnInsight';
import { MetricExplorer } from './MetricExplorer';
import { ReportCTA } from './ReportCTA';

interface ExplorationSidebarProps {
  primaryMarket: MyMarket | null;
  comparisonMarket: MyMarket | null;
  template: TemplateType;
  activeMetric: string;
  onMetricChange: (metric: string) => void;
  userType: 'homebuyer' | 'investor';
}

/**
 * ExplorationSidebar - Right zone with questions, AI insights, metrics, and report CTA
 */
export function ExplorationSidebar({
  primaryMarket,
  comparisonMarket,
  template,
  activeMetric,
  onMetricChange,
  userType,
}: ExplorationSidebarProps) {
  const hasComparison = primaryMarket && comparisonMarket;

  return (
    <aside className="flex flex-col gap-5">
      {/* Question Cards */}
      <QuestionCards
        primaryMarket={primaryMarket}
        comparisonMarket={comparisonMarket}
        template={template}
      />

      {/* Quinn's AI Insight */}
      {hasComparison && (
        <QuinnInsight
          primaryMarket={primaryMarket}
          comparisonMarket={comparisonMarket}
          userType={userType}
        />
      )}

      {/* Metric Explorer */}
      <MetricExplorer
        activeMetric={activeMetric}
        onMetricChange={onMetricChange}
        template={template}
      />

      {/* Report CTA */}
      {hasComparison && (
        <ReportCTA
          primaryMarket={primaryMarket}
          comparisonMarket={comparisonMarket}
        />
      )}
    </aside>
  );
}

export default ExplorationSidebar;
