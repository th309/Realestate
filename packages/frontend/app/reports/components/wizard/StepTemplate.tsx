'use client';

import React from 'react';
import { BarChart3, GitCompare, PiggyBank, Users, Activity, Lock } from 'lucide-react';
import { UserTypeToggle } from './UserTypeToggle';
import { TEMPLATE_INFO, TIER_INFO } from '../../constants';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { ReportTemplate, ReportType, SubscriptionTier } from '../../types';

// Mock templates until API is connected
const MOCK_TEMPLATES: ReportTemplate[] = [
  {
    id: '1',
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
      supported_geography_types: ['metro', 'county', 'zip'],
      user_inputs: [],
      pages: [],
      ai_config: { narrative_sections: [], conversation_starter: '', initial_questions: [] },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: [] },
    },
    organization_id: null,
    base_template_id: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: '2',
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
      supported_geography_types: ['metro', 'county'],
      comparison: { min_geographies: 2, max_geographies: 5 },
      user_inputs: [],
      pages: [],
      ai_config: { narrative_sections: [], conversation_starter: '', initial_questions: [] },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: [] },
    },
    organization_id: null,
    base_template_id: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: '3',
    slug: 'investment',
    name: 'Investment Analysis',
    description: 'Deep dive for investors with pro forma, cash flow projections, and ROI scenarios.',
    icon: 'PiggyBank',
    version: 1,
    tier_required: 'basic',
    is_active: true,
    is_public: true,
    config: {
      report_type: 'investment',
      supported_geography_types: ['metro', 'county', 'zip'],
      user_inputs: [
        { field_name: 'purchase_price', label: 'Purchase Price', type: 'number', required: true },
        { field_name: 'down_payment_pct', label: 'Down Payment %', type: 'number', default: 20 },
      ],
      pages: [],
      ai_config: { narrative_sections: [], conversation_starter: '', initial_questions: [] },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: [] },
    },
    organization_id: null,
    base_template_id: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: '4',
    slug: 'affordability',
    name: 'Affordability & Migration',
    description: 'Demographics, population flow analysis, and affordability metrics.',
    icon: 'Users',
    version: 1,
    tier_required: 'basic',
    is_active: true,
    is_public: true,
    config: {
      report_type: 'affordability',
      supported_geography_types: ['metro', 'county'],
      user_inputs: [
        { field_name: 'household_income', label: 'Household Income', type: 'number' },
      ],
      pages: [],
      ai_config: { narrative_sections: [], conversation_starter: '', initial_questions: [] },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: [] },
    },
    organization_id: null,
    base_template_id: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: '5',
    slug: 'cycle',
    name: 'Market Cycle & Risk',
    description: 'Cycle position analysis with scenario modeling and risk assessment.',
    icon: 'Activity',
    version: 1,
    tier_required: 'pro',
    is_active: true,
    is_public: true,
    config: {
      report_type: 'cycle',
      supported_geography_types: ['metro'],
      user_inputs: [],
      pages: [],
      ai_config: { narrative_sections: [], conversation_starter: '', initial_questions: [] },
      data_requirements: { current_metrics: [], historical_metrics: [], benchmarks: [], scores: [] },
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

  // Sort templates by user type relevance
  const sortedTemplates = [...MOCK_TEMPLATES].sort((a, b) => {
    const aRelevance = TEMPLATE_INFO[a.config.report_type as ReportType]?.userTypeRelevance[userType] || 99;
    const bRelevance = TEMPLATE_INFO[b.config.report_type as ReportType]?.userTypeRelevance[userType] || 99;
    return aRelevance - bRelevance;
  });

  // TODO: Get from user authentication context
  const currentTier: SubscriptionTier = 'pro';
  const tierOrder: SubscriptionTier[] = ['free', 'basic', 'pro', 'enterprise'];

  const canAccessTemplate = (template: ReportTemplate): boolean => {
    const requiredTierIndex = tierOrder.indexOf(template.tier_required);
    const currentTierIndex = tierOrder.indexOf(currentTier);
    return currentTierIndex >= requiredTierIndex;
  };

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
