'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { MyMarket } from '../../hooks/useMyMarkets';

interface QuinnInsightProps {
  primaryMarket: MyMarket;
  comparisonMarket: MyMarket;
  userType: 'homebuyer' | 'investor';
}

/**
 * QuinnInsight - AI-generated comparison insight
 */
export function QuinnInsight({
  primaryMarket,
  comparisonMarket,
  userType,
}: QuinnInsightProps) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function generateInsight() {
      setLoading(true);

      // Simulate AI insight generation
      // In production, this calls the Gemini service
      await new Promise(resolve => setTimeout(resolve, 800));

      const winnerName = (primaryMarket.score ?? 0) >= (comparisonMarket.score ?? 0)
        ? primaryMarket.name.split(',')[0]
        : comparisonMarket.name.split(',')[0];

      const loserName = winnerName === primaryMarket.name.split(',')[0]
        ? comparisonMarket.name.split(',')[0]
        : primaryMarket.name.split(',')[0];

      const insights = userType === 'investor'
        ? [
            `${winnerName} edges ahead for your priorities. While ${loserName} has stronger appreciation, ${winnerName}'s better rent yields and lower entry prices make it the better fit for cash flow investors.`,
            `Looking at the numbers, ${winnerName} offers a more attractive investment profile. The cap rate spread of 0.8% could mean an extra $200/month on a typical property.`,
          ]
        : [
            `${winnerName} edges ahead for your priorities. While ${loserName} has stronger job growth, ${winnerName}'s lower price-to-income ratio (4.2 vs 5.8) and higher 5-year appreciation make it the better fit for first-time buyers focused on affordability.`,
            `For homebuyers, ${winnerName} presents a compelling case. Your dollar stretches further here, and the market fundamentals support continued growth.`,
          ];

      setInsight(insights[Math.floor(Math.random() * insights.length)]);
      setLoading(false);
    }

    generateInsight();
  }, [primaryMarket.id, comparisonMarket.id, userType]);

  return (
    <div className="bg-gradient-to-br from-primary-container to-tertiary-container rounded-[20px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-primary text-on-primary rounded-md flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-medium text-on-primary-container uppercase tracking-wide">
          Quinn's Insight
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-surface-container rounded w-full" />
          <div className="h-3 bg-surface-container rounded w-5/6" />
          <div className="h-3 bg-surface-container rounded w-4/6" />
        </div>
      ) : (
        <p className="text-sm text-on-surface leading-relaxed">
          <strong className="text-primary">
            {primaryMarket.score && comparisonMarket.score && primaryMarket.score >= comparisonMarket.score
              ? primaryMarket.name.split(',')[0]
              : comparisonMarket.name.split(',')[0]
            } edges ahead
          </strong>{' '}
          {insight?.replace(/^[^.]+\./, '').trim()}
        </p>
      )}
    </div>
  );
}

export default QuinnInsight;
