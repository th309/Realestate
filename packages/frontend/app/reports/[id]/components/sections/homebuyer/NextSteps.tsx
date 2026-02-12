'use client';

import React from 'react';
import { CheckCircle2, ArrowRight, Clock, DollarSign, MapPin, Target, AlertTriangle } from 'lucide-react';

import { SectionCard, AIAnalysisBlock } from '../core';
import { getMetricWithAliases } from '../../utils/metricHelpers';
import type { ReportInstance } from '../../../../types';

export interface NextStepsProps {
  /** The full report data */
  report: ReportInstance;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Action item configuration with contextual logic
 */
interface ActionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: 'high' | 'medium' | 'low';
  /** Condition function to determine if this action applies */
  condition?: (context: MarketContext) => boolean;
}

/**
 * Market context derived from report data for generating recommendations
 */
interface MarketContext {
  isHotMarket: boolean;
  isAffordabilityTight: boolean;
  isPricesRising: boolean;
  hotnessScore: number | null;
  affordabilityIndex: number | null;
  priceChangePercent: number | null;
  daysOnMarket: number | null;
  userType: 'homebuyer' | 'investor';
}

/**
 * Extract market context from report data
 */
function getMarketContext(report: ReportInstance): MarketContext {
  // Get hotness score
  const hotnessScore =
    getMetricWithAliases(report, 'hotness_score') ??
    getMetricWithAliases(report, 'market_hotness');

  // Get affordability metrics
  const affordabilityIndex = getMetricWithAliases(report, 'affordability_index');
  const homeValue = getMetricWithAliases(report, 'zhvi') ?? getMetricWithAliases(report, 'home_value');
  const medianIncome = getMetricWithAliases(report, 'median_household_income');

  // Calculate price-to-income ratio if direct affordability not available
  const priceToIncomeRatio = homeValue && medianIncome ? homeValue / medianIncome : null;

  // Get price trend data
  const priceHistorical = report.populated_data?.historical?.zhvi ??
    report.populated_data?.historical?.home_value;
  const priceChangePercent = priceHistorical?.change_pct ?? null;

  // Get days on market
  const daysOnMarket = getMetricWithAliases(report, 'days_on_market');

  // Determine market conditions
  const isHotMarket = hotnessScore !== null ? hotnessScore >= 65 : daysOnMarket !== null ? daysOnMarket <= 25 : false;

  const isAffordabilityTight = affordabilityIndex !== null
    ? affordabilityIndex < 100
    : priceToIncomeRatio !== null
      ? priceToIncomeRatio > 5
      : false;

  const isPricesRising = priceChangePercent !== null && priceChangePercent > 3;

  return {
    isHotMarket,
    isAffordabilityTight,
    isPricesRising,
    hotnessScore,
    affordabilityIndex,
    priceChangePercent,
    daysOnMarket,
    userType: report.user_type,
  };
}

/**
 * Base action items for homebuyers
 */
const BASE_HOMEBUYER_ACTIONS: ActionItem[] = [
  {
    id: 'get-preapproved',
    title: 'Get Pre-Approved for a Mortgage',
    description: 'A pre-approval letter shows sellers you are a serious buyer and gives you a clear budget.',
    icon: DollarSign,
    priority: 'high',
  },
  {
    id: 'research-neighborhoods',
    title: 'Research Target Neighborhoods',
    description: 'Explore schools, amenities, commute times, and future development plans in your preferred areas.',
    icon: MapPin,
    priority: 'medium',
  },
  {
    id: 'define-priorities',
    title: 'Define Your Must-Haves',
    description: 'Create a prioritized list of features (bedrooms, yard, garage) to guide your search effectively.',
    icon: Target,
    priority: 'medium',
  },
];

/**
 * Conditional action items based on market conditions
 */
const CONDITIONAL_ACTIONS: ActionItem[] = [
  {
    id: 'act-quickly',
    title: 'Be Prepared to Act Quickly',
    description: 'In this competitive market, desirable homes sell fast. Have your documents ready and be prepared to make swift decisions.',
    icon: Clock,
    priority: 'high',
    condition: (ctx) => ctx.isHotMarket,
  },
  {
    id: 'consider-alternatives',
    title: 'Consider More Affordable Areas',
    description: 'With affordability stretched in this market, explore nearby neighborhoods or towns that offer better value.',
    icon: MapPin,
    priority: 'high',
    condition: (ctx) => ctx.isAffordabilityTight,
  },
  {
    id: 'lock-in-soon',
    title: 'Lock In Sooner Rather Than Later',
    description: 'With prices trending upward, acting sooner may help you secure a better deal before further appreciation.',
    icon: ArrowRight,
    priority: 'high',
    condition: (ctx) => ctx.isPricesRising,
  },
  {
    id: 'take-time',
    title: 'Take Your Time to Find the Right Fit',
    description: 'Market conditions favor buyers. You have time to negotiate and find the perfect home without rushing.',
    icon: Clock,
    priority: 'medium',
    condition: (ctx) => !ctx.isHotMarket && ctx.daysOnMarket !== null && ctx.daysOnMarket > 45,
  },
  {
    id: 'negotiate-aggressively',
    title: 'Negotiate for Better Terms',
    description: 'With favorable market conditions, you may have leverage to negotiate on price, closing costs, or repairs.',
    icon: DollarSign,
    priority: 'medium',
    condition: (ctx) => !ctx.isHotMarket && !ctx.isPricesRising,
  },
];

/**
 * Base action items for investors
 */
const BASE_INVESTOR_ACTIONS: ActionItem[] = [
  {
    id: 'analyze-cash-flow',
    title: 'Run a Detailed Cash Flow Analysis',
    description: 'Calculate potential rental income, expenses, and cash-on-cash returns before making offers.',
    icon: DollarSign,
    priority: 'high',
  },
  {
    id: 'research-rental-market',
    title: 'Research the Local Rental Market',
    description: 'Understand vacancy rates, average rents, and tenant demand in your target areas.',
    icon: MapPin,
    priority: 'high',
  },
  {
    id: 'build-team',
    title: 'Build Your Investment Team',
    description: 'Connect with property managers, contractors, and lenders who specialize in investment properties.',
    icon: Target,
    priority: 'medium',
  },
];

/**
 * Generate personalized action items based on market context
 */
function generateActionItems(context: MarketContext): ActionItem[] {
  const baseActions = context.userType === 'investor' ? BASE_INVESTOR_ACTIONS : BASE_HOMEBUYER_ACTIONS;

  // Filter conditional actions that apply to current context
  const applicableConditionalActions = CONDITIONAL_ACTIONS.filter(
    (action) => !action.condition || action.condition(context)
  );

  // Combine and sort by priority
  const allActions = [...applicableConditionalActions, ...baseActions];

  // Sort: high priority first, then medium, then low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  allActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Return top 5 most relevant actions
  return allActions.slice(0, 5);
}

/**
 * Get priority badge styling
 */
function getPriorityBadgeStyle(priority: 'high' | 'medium' | 'low'): {
  bg: string;
  text: string;
  label: string;
} {
  switch (priority) {
    case 'high':
      return {
        bg: 'var(--report-error-bg)',
        text: 'var(--report-error)',
        label: 'Priority',
      };
    case 'medium':
      return {
        bg: 'var(--report-warning-bg)',
        text: 'var(--report-warning)',
        label: 'Recommended',
      };
    case 'low':
      return {
        bg: 'var(--report-cream)',
        text: 'var(--report-stone)',
        label: 'Consider',
      };
  }
}

/**
 * NextSteps - Actionable recommendations for homebuyers
 *
 * This section provides personalized, contextual recommendations based on:
 * - Current market conditions (hot/cold market)
 * - Affordability situation
 * - Price trends
 * - User type (homebuyer vs investor)
 *
 * Includes AI-generated recommendations and numbered action items.
 * Uses the editorial design system from report-theme.css.
 */
export function NextSteps({
  report,
  className = '',
}: NextStepsProps): React.ReactElement {
  const context = getMarketContext(report);
  const actionItems = generateActionItems(context);

  // Get AI recommendations
  const aiRecommendations =
    report.ai_narrative?.recommendations ??
    report.ai_narrative?.next_steps ??
    report.ai_narratives?.recommendations ??
    report.ai_narratives?.next_steps;

  // Build market condition summary
  const marketConditions: string[] = [];
  if (context.isHotMarket) {
    marketConditions.push('competitive market conditions');
  }
  if (context.isAffordabilityTight) {
    marketConditions.push('stretched affordability');
  }
  if (context.isPricesRising) {
    marketConditions.push('rising prices');
  }

  const hasMarketContext = marketConditions.length > 0;
  const userTypeLabel = report.user_type === 'investor' ? 'investors' : 'homebuyers';

  return (
    <SectionCard
      title="Next Steps"
      icon={CheckCircle2}
      className={className}
    >
      {/* Market Context Summary */}
      {hasMarketContext && (
        <div
          className="rounded-[var(--report-radius-md)] p-4 mb-6"
          style={{
            backgroundColor: 'var(--report-cream)',
            borderLeft: '4px solid var(--report-gold)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              style={{ color: 'var(--report-gold)' }}
            />
            <div>
              <p
                className="font-semibold text-sm mb-1"
                style={{ color: 'var(--report-navy)' }}
              >
                Market Conditions to Consider
              </p>
              <p
                className="text-sm"
                style={{ color: 'var(--report-stone)' }}
              >
                Based on our analysis, {report.primary_geography_name} is currently experiencing{' '}
                {marketConditions.join(', ').replace(/, ([^,]*)$/, ' and $1')}.
                The recommendations below are tailored for {userTypeLabel} in these conditions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {aiRecommendations && (
        <div className="mb-6">
          <AIAnalysisBlock
            title="Personalized Recommendations"
            content={typeof aiRecommendations === 'string' ? aiRecommendations : Array.isArray(aiRecommendations) ? aiRecommendations : String(aiRecommendations)}
            variant="recommendation"
          />
        </div>
      )}

      {/* Action Items Checklist */}
      <div>
        <h4
          className="report-label mb-4"
          style={{ color: 'var(--report-navy)' }}
        >
          Your Action Checklist
        </h4>

        <div className="space-y-3">
          {actionItems.map((item, index) => {
            const Icon = item.icon;
            const priorityStyle = getPriorityBadgeStyle(item.priority);

            return (
              <div
                key={item.id}
                className="rounded-[var(--report-radius-md)] p-4 transition-all duration-200"
                style={{
                  backgroundColor: 'white',
                  border: '1px solid rgba(27, 46, 74, 0.08)',
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Step Number */}
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                    style={{
                      backgroundColor: 'var(--report-navy)',
                      color: 'white',
                      fontFamily: 'var(--report-font-display)',
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h5
                        className="font-semibold text-[0.9375rem]"
                        style={{ color: 'var(--report-navy)' }}
                      >
                        {item.title}
                      </h5>
                      {item.priority === 'high' && (
                        <span
                          className="text-[0.625rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: priorityStyle.bg,
                            color: priorityStyle.text,
                          }}
                        >
                          {priorityStyle.label}
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--report-stone)' }}
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* Icon */}
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-[var(--report-radius-sm)] flex items-center justify-center"
                    style={{ backgroundColor: 'var(--report-cream)' }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: 'var(--report-navy-light)' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Summary */}
      {report.homeready_score !== null && report.user_type === 'homebuyer' && (
        <div
          className="mt-6 p-4 rounded-[var(--report-radius-md)] text-center"
          style={{ backgroundColor: 'var(--report-cream-dark)' }}
        >
          <p
            className="text-sm mb-2"
            style={{ color: 'var(--report-stone)' }}
          >
            Overall HomeReady Score for {report.primary_geography_name}
          </p>
          <p
            className="text-3xl font-bold"
            style={{
              color:
                report.homeready_score >= 70
                  ? 'var(--report-success)'
                  : report.homeready_score >= 50
                    ? 'var(--report-warning)'
                    : 'var(--report-error)',
              fontFamily: 'var(--report-font-display)',
            }}
          >
            {report.homeready_score}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--report-stone-light)' }}
          >
            {report.homeready_score >= 70
              ? 'Favorable conditions for homebuyers'
              : report.homeready_score >= 50
                ? 'Moderate conditions - proceed with research'
                : 'Challenging market - consider alternatives'}
          </p>
        </div>
      )}

      {/* Investor Score Summary */}
      {report.investoredge_score !== null && report.user_type === 'investor' && (
        <div
          className="mt-6 p-4 rounded-[var(--report-radius-md)] text-center"
          style={{ backgroundColor: 'var(--report-cream-dark)' }}
        >
          <p
            className="text-sm mb-2"
            style={{ color: 'var(--report-stone)' }}
          >
            Overall InvestorEdge Score for {report.primary_geography_name}
          </p>
          <p
            className="text-3xl font-bold"
            style={{
              color:
                report.investoredge_score >= 70
                  ? 'var(--report-success)'
                  : report.investoredge_score >= 50
                    ? 'var(--report-warning)'
                    : 'var(--report-error)',
              fontFamily: 'var(--report-font-display)',
            }}
          >
            {report.investoredge_score}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--report-stone-light)' }}
          >
            {report.investoredge_score >= 70
              ? 'Strong investment potential'
              : report.investoredge_score >= 50
                ? 'Moderate opportunity - analyze carefully'
                : 'Higher risk market - proceed with caution'}
          </p>
        </div>
      )}

      {/* Closing CTA */}
      <div
        className="mt-6 pt-6"
        style={{ borderTop: '1px solid rgba(27, 46, 74, 0.08)' }}
      >
        <p
          className="text-sm text-center"
          style={{ color: 'var(--report-stone-light)' }}
        >
          Ready to take the next step? Use this report as your guide and revisit it as market conditions change.
        </p>
      </div>
    </SectionCard>
  );
}

export default NextSteps;
