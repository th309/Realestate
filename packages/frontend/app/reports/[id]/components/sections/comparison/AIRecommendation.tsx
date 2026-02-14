'use client';

import React from 'react';
import { Sparkles, CheckCircle, ArrowRight, MessageSquare } from 'lucide-react';
import { SectionProps } from '../../types';

/**
 * AIRecommendation - Claude-generated personalized recommendation
 *
 * Part 3 of the redesigned comparison report.
 * The "money shot" - personalized, actionable recommendation.
 */
export function AIRecommendation({ section, report }: SectionProps) {
  const isInvestor = report.user_type === 'investor';

  // Get AI-generated recommendation from report data
  const aiNarratives = report.ai_narratives || report.ai_narrative || {};
  const recommendation = aiNarratives.final_recommendation as string | undefined;
  const nextSteps = aiNarratives.next_steps as string[] | undefined;
  const tradeOffs = aiNarratives.trade_offs as string | undefined;

  // Get winner info
  const priorityWinner = report.populated_data?.priority_weighted_winner as {
    winnerId: string;
    winnerName: string;
  } | undefined;

  // Get user inputs for personalization context
  const userInputs = report.user_inputs || {};
  const priorities = userInputs.priorities as string[] || [];
  const income = userInputs.annual_income || userInputs.household_income;
  const downPayment = userInputs.down_payment;

  // Format priorities for display
  const priorityLabels: Record<string, string> = {
    affordability: 'Affordability',
    appreciation: 'Appreciation',
    job_market: 'Job Market',
    market_timing: 'Market Timing',
    lifestyle: 'Lifestyle',
    cash_flow: 'Cash Flow',
    tenant_demand: 'Tenant Demand',
    entry_price: 'Entry Price',
    stability: 'Stability',
  };

  const formattedPriorities = priorities
    .slice(0, 3)
    .map(p => priorityLabels[p] || p)
    .join(' → ');

  // Default next steps if not provided by AI
  const defaultNextSteps = isInvestor
    ? [
        'Run detailed cash flow analysis for specific properties',
        'Connect with local property managers for rental insights',
        'Review recent comparable sales in target neighborhoods',
      ]
    : [
        'Get pre-approved with a local lender',
        'Explore neighborhoods that match your budget',
        'Ask Quinn any follow-up questions about this analysis',
      ];

  const displayNextSteps = nextSteps && nextSteps.length > 0 ? nextSteps : defaultNextSteps;

  return (
    <div className="report-section report-animate-in">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-container p-8 text-on-primary">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">PropertyIQ Recommendation</h2>
          </div>

          {/* Context Line */}
          {(formattedPriorities || income) && (
            <p className="text-sm text-on-primary/80 mb-4">
              Based on your priorities ({formattedPriorities || 'not specified'})
              {income && ` and financial profile ($${formatCurrency(income)} income${downPayment ? `, $${formatCurrency(downPayment)} down` : ''})`}:
            </p>
          )}

          {/* Main Recommendation */}
          {priorityWinner ? (
            <div className="text-2xl font-bold mb-4">
              <span className="text-on-primary/90">{priorityWinner.winnerName}</span> is the stronger choice for you.
            </div>
          ) : (
            <div className="text-2xl font-bold mb-4">
              See our detailed analysis below.
            </div>
          )}

          {/* AI-Generated Detail */}
          {recommendation ? (
            <p className="text-on-primary/90 leading-relaxed">
              {recommendation}
            </p>
          ) : (
            <p className="text-on-primary/90 leading-relaxed">
              Based on your selected priorities and market data, this market offers the best combination
              of factors that matter to you. Review the detailed analysis above for specifics.
            </p>
          )}
        </div>
      </div>

      {/* Trade-Offs Section */}
      {tradeOffs && (
        <div className="mt-6 p-5 bg-amber-500/5 rounded-xl border border-amber-500/20">
          <h3 className="text-sm font-semibold text-amber-600 mb-2">
            The Trade-Off to Consider
          </h3>
          <p className="text-sm text-on-surface leading-relaxed">
            {tradeOffs}
          </p>
        </div>
      )}

      {/* Next Steps */}
      <div className="mt-6 p-6 bg-surface-container rounded-xl border border-outline-variant">
        <h3 className="flex items-center gap-2 text-base font-semibold text-on-surface mb-4">
          <ArrowRight className="w-5 h-5 text-primary" />
          Next Steps
        </h3>

        <div className="space-y-3">
          {displayNextSteps.map((step, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 bg-surface rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-on-surface">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA: Talk to Quinn */}
      <div className="mt-6 p-5 bg-primary/5 rounded-xl border border-primary/20 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="font-semibold text-primary">Have Questions?</span>
        </div>
        <p className="text-sm text-on-surface-variant">
          Ask Quinn to dive deeper into any aspect of this analysis.
          Our AI assistant can provide additional insights tailored to your situation.
        </p>
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-[10px] text-on-surface-variant text-center">
        This recommendation is based on available market data and your stated priorities.
        It is not financial advice. Consult with local professionals before making decisions.
      </p>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}K`;
  }
  return value.toString();
}

export default AIRecommendation;
