'use client';

import React from 'react';
import { MyMarket } from '../../hooks/useMyMarkets';
import { TemplateType, VizType } from '../../hooks/useGraphsState';
import { ScoreShowdown } from './ScoreShowdown';
import { PriorityBreakdown } from './PriorityBreakdown';
import { TemplateTabs } from './TemplateTabs';
import { TemplateVisualization } from './TemplateVisualization';

interface HeroComparisonProps {
  primaryMarket: MyMarket | null;
  comparisonMarket: MyMarket | null;
  activeTemplate: TemplateType;
  vizType: VizType;
  userType: 'homebuyer' | 'investor';
  onTemplateChange: (template: TemplateType) => void;
  onVizTypeChange: (viz: VizType) => void;
}

/**
 * HeroComparison - Central zone with score showdown and priority breakdown
 */
export function HeroComparison({
  primaryMarket,
  comparisonMarket,
  activeTemplate,
  vizType,
  userType,
  onTemplateChange,
  onVizTypeChange,
}: HeroComparisonProps) {
  const hasComparison = primaryMarket && comparisonMarket;

  // Template display info
  const templateInfo = TEMPLATE_INFO[activeTemplate];

  if (!primaryMarket) {
    return (
      <div className="bg-surface-container-lowest rounded-[28px] p-8 shadow-sm">
        <div className="text-center py-16">
          <p className="text-lg text-on-surface-variant mb-2">
            Select a market from above to start exploring
          </p>
          <p className="text-sm text-on-surface-variant/70">
            Click on any market chip to begin your comparison
          </p>
        </div>
      </div>
    );
  }

  if (!comparisonMarket) {
    return (
      <div className="bg-surface-container-lowest rounded-[28px] p-8 shadow-sm">
        <div className="text-center py-16">
          <h2 className="text-xl font-medium text-on-surface mb-2">
            {primaryMarket.name}
          </h2>
          <p className="text-sm text-on-surface-variant mb-4">
            Select another market to compare against {primaryMarket.name}
          </p>
          {primaryMarket.score !== null && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container rounded-full">
              <span className="text-on-primary-container font-medium">
                {userType === 'investor' ? 'InvestorEdge' : 'HomeReady'} Score:
              </span>
              <span className="text-on-primary-container font-bold text-lg">
                {Math.round(primaryMarket.score)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-surface-container-lowest rounded-[28px] p-8 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-medium text-on-surface">
            {templateInfo.title}
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            {templateInfo.subtitle}
          </p>
        </div>

        <TemplateTabs
          activeTemplate={activeTemplate}
          onTemplateChange={onTemplateChange}
        />
      </div>

      {/* Score Showdown */}
      <ScoreShowdown
        primaryMarket={primaryMarket}
        comparisonMarket={comparisonMarket}
        userType={userType}
      />

      {/* Priority Breakdown */}
      <PriorityBreakdown
        primaryMarket={primaryMarket}
        comparisonMarket={comparisonMarket}
        template={activeTemplate}
        userType={userType}
      />

      {/* D3 Visualization */}
      <TemplateVisualization
        primaryMarket={primaryMarket}
        comparisonMarket={comparisonMarket}
        template={activeTemplate}
        vizType={vizType}
        onVizTypeChange={onVizTypeChange}
      />
    </section>
  );
}

const TEMPLATE_INFO: Record<TemplateType, { title: string; subtitle: string }> = {
  affordability: {
    title: 'Affordability Showdown',
    subtitle: 'Which market fits your budget better?',
  },
  investment: {
    title: 'Investment Face-off',
    subtitle: 'Which market offers better returns?',
  },
  momentum: {
    title: 'Market Momentum',
    subtitle: 'Which market is heating up faster?',
  },
  cashflow: {
    title: 'Cash Flow Face-off',
    subtitle: 'Which market cash flows better?',
  },
  custom: {
    title: 'Custom Comparison',
    subtitle: 'Compare any metrics you choose',
  },
};

export default HeroComparison;
