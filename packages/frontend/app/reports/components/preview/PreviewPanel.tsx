'use client';

import React from 'react';
import { Eye, FileText, MapPin, BarChart3, Sparkles } from 'lucide-react';
import { M3Card } from '@/app/graphs/components/M3Card';
import { USER_TYPE_CONFIG, SCORE_INFO } from '../../constants';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';

interface PreviewPanelProps {
  wizardState: UseWizardStateReturn;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ wizardState }) => {
  const { step, userType, selectedTemplate, primaryGeography, comparisonGeographies } = wizardState;

  const userTypeConfig = USER_TYPE_CONFIG[userType];
  const heroScore = SCORE_INFO[userTypeConfig.heroScore];

  // Empty state - no template selected
  if (!selectedTemplate) {
    return (
      <M3Card variant="outlined" size="md" className="min-h-[500px]">
        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mb-4">
            <Eye className="w-8 h-8 text-on-surface-variant" />
          </div>
          <h3 className="text-lg font-medium text-on-surface mb-2">Report Preview</h3>
          <p className="text-sm text-on-surface-variant max-w-xs">
            Select a template to see a preview of your report structure
          </p>
        </div>
      </M3Card>
    );
  }

  // Outline state - template selected
  return (
    <M3Card variant="outlined" size="md" className="overflow-hidden">
      {/* Preview Header */}
      <div className="px-5 py-4 bg-surface-container border-b border-outline-variant/30">
        <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
          <Eye className="w-4 h-4" />
          Report Preview
        </div>
      </div>

      {/* Preview Content */}
      <div className="p-5 space-y-4">
        {/* Report Title */}
        <div className="p-4 bg-primary-container/30 rounded-xl">
          <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">
            {selectedTemplate.name}
          </div>
          <div className="text-lg font-medium text-on-surface">
            {primaryGeography ? primaryGeography.name : 'Select a market...'}
          </div>
          {comparisonGeographies.length > 0 && (
            <div className="text-sm text-on-surface-variant mt-1">
              vs {comparisonGeographies.map((g) => g.name).join(', ')}
            </div>
          )}
        </div>

        {/* Hero Score Preview */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${heroScore.color}`}>{heroScore.name}</span>
            <span className="text-xs text-on-surface-variant">Hero Metric</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-full ${heroScore.bgClass}/20 flex items-center justify-center`}>
              <span className={`text-2xl font-bold ${heroScore.color}`}>
                {primaryGeography ? '--' : '?'}
              </span>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div className={`h-full ${heroScore.bgClass} w-0`} />
              </div>
              <p className="text-xs text-on-surface-variant mt-2">
                Score will be calculated after generation
              </p>
            </div>
          </div>
        </div>

        {/* Section Preview */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            Report Sections
          </div>

          {/* Dynamic sections based on template pages */}
          {selectedTemplate.config.pages?.slice(0, 4).map((page, index) => (
            <div
              key={page.id || index}
              className="flex items-center gap-3 p-3 bg-surface-container rounded-lg"
            >
              <div className="w-8 h-8 bg-surface-container-high rounded-lg flex items-center justify-center">
                {index === 0 ? (
                  <FileText className="w-4 h-4 text-on-surface-variant" />
                ) : index === 1 ? (
                  <BarChart3 className="w-4 h-4 text-on-surface-variant" />
                ) : (
                  <Sparkles className="w-4 h-4 text-on-surface-variant" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-on-surface">{page.name || `Section ${index + 1}`}</div>
                <div className="text-xs text-on-surface-variant">
                  {page.sections?.length || 0} components
                </div>
              </div>
            </div>
          )) || (
            <>
              <PreviewSectionRow icon={FileText} title="Cover Page" subtitle="Title, scores, metadata" />
              <PreviewSectionRow icon={BarChart3} title="Key Metrics" subtitle="Market indicators" />
              <PreviewSectionRow icon={Sparkles} title="AI Analysis" subtitle="Market summary" />
              <PreviewSectionRow icon={MapPin} title="Trends" subtitle="Historical charts" />
            </>
          )}
        </div>

        {/* Generation Note */}
        {step >= 3 && primaryGeography && (
          <div className="p-3 bg-tertiary-container/30 rounded-xl">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-tertiary shrink-0 mt-0.5" />
              <p className="text-xs text-on-surface-variant">
                Ready to generate! AI will analyze current market data and create personalized insights.
              </p>
            </div>
          </div>
        )}
      </div>
    </M3Card>
  );
};

// Helper component for section rows
const PreviewSectionRow: React.FC<{
  icon: React.FC<{ className?: string }>;
  title: string;
  subtitle: string;
}> = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 p-3 bg-surface-container rounded-lg">
    <div className="w-8 h-8 bg-surface-container-high rounded-lg flex items-center justify-center">
      <Icon className="w-4 h-4 text-on-surface-variant" />
    </div>
    <div className="flex-1">
      <div className="text-sm font-medium text-on-surface">{title}</div>
      <div className="text-xs text-on-surface-variant">{subtitle}</div>
    </div>
  </div>
);
