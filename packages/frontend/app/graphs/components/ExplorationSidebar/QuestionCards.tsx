'use client';

import React from 'react';
import { MyMarket } from '../../hooks/useMyMarkets';
import { TemplateType } from '../../hooks/useGraphsState';

interface QuestionCardsProps {
  primaryMarket: MyMarket | null;
  comparisonMarket: MyMarket | null;
  template: TemplateType;
}

interface Question {
  icon: string;
  text: string;
}

/**
 * QuestionCards - Curated questions based on template and markets
 */
export function QuestionCards({
  primaryMarket,
  comparisonMarket,
  template,
}: QuestionCardsProps) {
  const questions = getQuestionsForTemplate(template, primaryMarket, comparisonMarket);

  return (
    <div className="bg-surface-container-lowest rounded-[20px] p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-on-surface">Explore Questions</h3>
        <button className="text-xs font-medium text-primary hover:underline">
          See All
        </button>
      </div>

      <div className="space-y-2.5">
        {questions.map((q, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-3 p-3.5 bg-surface-container rounded-xl text-left hover:bg-primary-container transition-colors"
          >
            <span className="text-base w-8 h-8 flex items-center justify-center bg-primary-container rounded-lg">
              {q.icon}
            </span>
            <span className="text-[13px] text-on-surface leading-tight">
              {q.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getQuestionsForTemplate(
  template: TemplateType,
  primary: MyMarket | null,
  comparison: MyMarket | null
): Question[] {
  const primaryName = primary?.name.split(',')[0] || 'this market';
  const comparisonName = comparison?.name.split(',')[0] || 'the other market';

  const templateQuestions: Record<TemplateType, Question[]> = {
    affordability: [
      { icon: '💰', text: `Can I afford to buy in ${primaryName} with $85K income?` },
      { icon: '📈', text: `Which market appreciated faster in the last 5 years?` },
      { icon: '🏠', text: `What's the rent vs buy breakeven in ${comparisonName}?` },
    ],
    investment: [
      { icon: '💵', text: `Which market has better cash flow potential?` },
      { icon: '📊', text: `What's the cap rate comparison?` },
      { icon: '🎯', text: `Where should I invest for appreciation?` },
    ],
    momentum: [
      { icon: '🔥', text: `Which market is heating up faster?` },
      { icon: '📉', text: `Is ${primaryName} becoming a buyer's market?` },
      { icon: '⏱️', text: `How long are homes staying on market?` },
    ],
    cashflow: [
      { icon: '💰', text: `Which market offers better rent yields?` },
      { icon: '🏢', text: `What's the price-to-rent ratio comparison?` },
      { icon: '📈', text: `Where is rent growing faster?` },
    ],
    custom: [
      { icon: '🔍', text: `How do these markets compare overall?` },
      { icon: '📊', text: `Show me the key differences` },
      { icon: '💡', text: `What should I know about each market?` },
    ],
  };

  return templateQuestions[template] || templateQuestions.custom;
}

export default QuestionCards;
