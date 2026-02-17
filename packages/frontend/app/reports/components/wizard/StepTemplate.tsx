'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, GitCompare, PiggyBank, Users, Activity, Lock, Loader2 } from 'lucide-react';
import { UserTypeToggle } from './UserTypeToggle';
import { TEMPLATE_INFO, TIER_INFO } from '../../constants';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { ReportTemplate, ReportType, SubscriptionTier } from '../../types';
import { fetchReportTemplates } from '@/lib/data';
import { useEntitlements } from '@/lib/entitlements';

// Default templates with proper AI narrative sections (used if API returns empty)
const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'default-snapshot',
    slug: 'snapshot',
    name: 'Market Snapshot',
    description: 'Quick pulse on any single market. Current conditions, key metrics, and AI-generated summary.',
    icon: 'BarChart3',
    version: 1,
    tier_required: 'free',
    is_active: true,
    is_public: true,
    config: {
      report_type: 'snapshot',
      supported_geography_types: ['national', 'state', 'metro', 'county', 'city', 'zip'],
      user_inputs: [],
      pages: [],
      ai_config: {
        narrative_sections: [
          {
            id: 'market_summary',
            name: 'Market Summary',
            prompt_template: `You are a real estate market analyst. Provide a concise market summary for {{geography_name}} ({{geography_type}}).

Market Scores:
- HomeReady Score: {{scores.scores.homeready.score}}/100 ({{scores.scores.homeready.grade}})
- InvestorEdge Score: {{scores.scores.investoredge.score}}/100 ({{scores.scores.investoredge.grade}})
- MarketHealth Score: {{scores.scores.markethealth.score}}/100 ({{scores.scores.markethealth.grade}})

Recent News & Market Signals:
{{news_context}}

{{market_signal_summary}}

Write a 150-200 word summary covering:
1. Current market conditions and what the scores indicate
2. Key factors driving the market (reference specific news if relevant)
3. Overall outlook for {{user_type}}s

Be specific, data-driven, and actionable.`,
            max_tokens: 400,
            output_format: 'text',
          },
          {
            id: 'trend_observations',
            name: 'Key Trends',
            prompt_template: `Based on the market data for {{geography_name}}:

Scores: HomeReady {{scores.scores.homeready.score}}, InvestorEdge {{scores.scores.investoredge.score}}, MarketHealth {{scores.scores.markethealth.score}}

News & Signals:
{{news_context}}

List 3-4 key market trends as bullet points. Each trend should:
- Reference specific data or news when possible
- Explain the implication for {{user_type}}s
- Be concise (1-2 sentences each)`,
            max_tokens: 350,
            output_format: 'text',
          },
          {
            id: 'affordability_analysis',
            name: 'Affordability Analysis',
            prompt_template: `Analyze affordability in {{geography_name}} for {{user_type}}s.

Market Scores:
{{scores}}

Recent Economic Indicators & News:
{{news_context}}

Provide a brief (100-150 word) affordability analysis covering:
1. Current affordability conditions
2. How this market compares to typical conditions
3. Specific recommendations for {{user_type}}s`,
            max_tokens: 300,
            output_format: 'text',
          },
        ],
        conversation_starter: 'What would you like to know about this market?',
        initial_questions: [
          'How does this market compare to national averages?',
          'What are the risks I should consider?',
          'Is now a good time to buy in this market?',
        ],
      },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: ['homeready', 'investoredge', 'markethealth'] },
    },
    organization_id: null,
    base_template_id: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'default-comparison',
    slug: 'comparison',
    name: 'Market Comparison',
    description: 'Side-by-side comparison of 2-5 markets with rankings and winner badges.',
    icon: 'GitCompare',
    version: 1,
    tier_required: 'basic',
    is_active: true,
    is_public: true,
    config: {
      report_type: 'comparison',
      supported_geography_types: ['national', 'state', 'metro', 'county', 'city', 'zip'],
      comparison: { min_geographies: 2, max_geographies: 5 },
      user_inputs: [],
      pages: [],
      ai_config: {
        narrative_sections: [
          {
            id: 'market_summary',
            name: 'Comparison Summary',
            prompt_template: `Compare {{geography_name}} with other selected markets for a {{user_type}}.

Primary Market Scores:
{{scores}}

News & Market Context:
{{news_context}}

{{market_signal_summary}}

Provide a 150-200 word comparison summary highlighting:
1. How the primary market ranks overall
2. Key advantages and disadvantages
3. Which market type of buyer/investor each market suits best`,
            max_tokens: 400,
            output_format: 'text',
          },
        ],
        conversation_starter: 'Which aspects of these markets would you like to compare?',
        initial_questions: [],
      },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: ['homeready', 'investoredge', 'markethealth'] },
    },
    organization_id: null,
    base_template_id: null,
    created_at: '',
    updated_at: '',
  },
];

const icons: Record<string, React.FC<{ className?: string }>> = {
  BarChart3,
  GitCompare,
  PiggyBank,
  Users,
  Activity,
};

interface StepTemplateProps {
  wizardState: UseWizardStateReturn;
}

export const StepTemplate: React.FC<StepTemplateProps> = ({ wizardState }) => {
  const { userType, setUserType, selectedTemplate, setSelectedTemplate } = wizardState;
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch templates from API
  useEffect(() => {
    fetchReportTemplates<ReportTemplate>()
      .then((data) => {
        // Use API templates if available, otherwise use defaults
        const templateList = data.length > 0 ? data : DEFAULT_TEMPLATES;
        setTemplates(templateList);
      })
      .catch((err) => {
        console.warn('Using default templates:', err.message);
        setTemplates(DEFAULT_TEMPLATES);
      })
      .finally(() => setLoading(false));
  }, []);

  // Sort templates by user type relevance
  const sortedTemplates = [...templates].sort((a, b) => {
    const aRelevance = TEMPLATE_INFO[a.config.report_type as ReportType]?.userTypeRelevance[userType] || 99;
    const bRelevance = TEMPLATE_INFO[b.config.report_type as ReportType]?.userTypeRelevance[userType] || 99;
    return aRelevance - bRelevance;
  });

  const { tier, simulatedTier } = useEntitlements();
  const currentTier: SubscriptionTier = (simulatedTier || tier || 'free') as SubscriptionTier;
  const tierOrder: SubscriptionTier[] = ['free', 'basic', 'pro', 'enterprise'];

  const canAccessTemplate = (template: ReportTemplate): boolean => {
    const requiredTierIndex = tierOrder.indexOf(template.tier_required);
    const currentTierIndex = tierOrder.indexOf(currentTier);
    return currentTierIndex >= requiredTierIndex;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* User Type Toggle */}
      <UserTypeToggle value={userType} onChange={setUserType} />

      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-3">
          Select a report template
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedTemplates.map((template) => {
            const Icon = icons[template.icon] || BarChart3;
            const isSelected = selectedTemplate?.id === template.id;
            const tierInfo = TIER_INFO[template.tier_required];
            const canAccess = canAccessTemplate(template);

            return (
              <button
                key={template.id}
                onClick={() => canAccess && setSelectedTemplate(template)}
                disabled={!canAccess}
                className={`
                  relative p-4 rounded-2xl text-left transition-all duration-200
                  ${
                    isSelected
                      ? 'bg-primary-container border-2 border-primary'
                      : canAccess
                      ? 'bg-surface-container border-2 border-transparent hover:border-outline-variant'
                      : 'bg-surface-container/50 border-2 border-transparent cursor-not-allowed opacity-60'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`
                      p-2.5 rounded-xl shrink-0
                      ${isSelected ? 'bg-primary/20' : 'bg-surface-container-high'}
                    `}
                  >
                    <Icon
                      className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className={`
                          font-medium text-sm truncate
                          ${isSelected ? 'text-on-primary-container' : 'text-on-surface'}
                        `}
                      >
                        {template.name}
                      </div>
                      {template.tier_required !== 'free' && (
                        <span
                          className={`
                            text-[9px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0
                            ${tierInfo.bgColor} ${tierInfo.color}
                          `}
                        >
                          {tierInfo.label}
                        </span>
                      )}
                    </div>
                    <div
                      className={`
                        text-xs line-clamp-2
                        ${isSelected ? 'text-on-primary-container/70' : 'text-on-surface-variant'}
                      `}
                    >
                      {template.description}
                    </div>
                  </div>
                </div>

                {/* Lock icon for inaccessible templates */}
                {!canAccess && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-4 h-4 text-on-surface-variant" />
                  </div>
                )}

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
