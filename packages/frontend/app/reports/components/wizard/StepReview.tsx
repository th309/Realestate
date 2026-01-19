'use client';

import React from 'react';
import { MapPin, FileText, User, Settings } from 'lucide-react';
import { USER_TYPE_CONFIG, SCORE_INFO } from '../../constants';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';

interface StepReviewProps {
  wizardState: UseWizardStateReturn;
}

export const StepReview: React.FC<StepReviewProps> = ({ wizardState }) => {
  const {
    userType,
    selectedTemplate,
    primaryGeography,
    comparisonGeographies,
    userInputs,
  } = wizardState;

  const userTypeConfig = USER_TYPE_CONFIG[userType];
  const heroScore = SCORE_INFO[userTypeConfig.heroScore];

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-on-surface mb-2">Review Your Selections</h3>
        <p className="text-sm text-on-surface-variant">
          Confirm your report configuration before generating.
        </p>
      </div>

      <div className="space-y-4">
        {/* User Type */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <User className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-on-surface">User Type</span>
          </div>
          <div className="pl-8">
            <div className="font-medium text-on-surface">{userTypeConfig.label}</div>
            <div className="text-xs text-on-surface-variant mt-1">
              Hero Score: <span className={heroScore.color}>{heroScore.name}</span>
            </div>
          </div>
        </div>

        {/* Report Template */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-on-surface">Report Template</span>
          </div>
          <div className="pl-8">
            <div className="font-medium text-on-surface">{selectedTemplate?.name}</div>
            <div className="text-xs text-on-surface-variant mt-1">{selectedTemplate?.description}</div>
          </div>
        </div>

        {/* Geography */}
        <div className="p-4 bg-surface-container rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-on-surface">
              {comparisonGeographies.length > 0 ? 'Markets' : 'Market'}
            </span>
          </div>
          <div className="pl-8 space-y-2">
            {primaryGeography && (
              <div>
                <div className="font-medium text-on-surface">{primaryGeography.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Primary Market • {primaryGeography.state}
                </div>
              </div>
            )}
            {comparisonGeographies.map((geo) => (
              <div key={geo.id}>
                <div className="font-medium text-on-surface">{geo.name}</div>
                <div className="text-xs text-on-surface-variant">
                  Comparison Market • {geo.state}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Inputs (if any) */}
        {Object.keys(userInputs).length > 0 && (
          <div className="p-4 bg-surface-container rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-on-surface">Custom Inputs</span>
            </div>
            <div className="pl-8 space-y-1">
              {selectedTemplate?.config.user_inputs
                .filter((input) => userInputs[input.field_name] !== undefined)
                .map((input) => (
                  <div key={input.field_name} className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">{input.label}</span>
                    <span className="font-medium text-on-surface">
                      {typeof userInputs[input.field_name] === 'boolean'
                        ? userInputs[input.field_name]
                          ? 'Yes'
                          : 'No'
                        : userInputs[input.field_name]}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Generation Note */}
      <div className="mt-6 p-4 bg-primary-container/30 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/20 rounded-lg shrink-0">
            <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-on-surface text-sm">AI-Powered Analysis</div>
            <p className="text-xs text-on-surface-variant mt-1">
              Your report will include AI-generated insights tailored to your {userType === 'investor' ? 'investment' : 'homebuying'} goals. You&apos;ll be able to ask follow-up questions after generation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
