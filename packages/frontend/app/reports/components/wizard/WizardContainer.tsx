'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { M3Card } from '@/app/graphs/components/M3Card';
import { StepIndicator } from './StepIndicator';
import { StepTemplate } from './StepTemplate';
import { StepGeography } from './StepGeography';
import { StepUserInputs } from './StepUserInputs';
import { StepReview } from './StepReview';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';

interface WizardContainerProps {
  wizardState: UseWizardStateReturn;
}

export const WizardContainer: React.FC<WizardContainerProps> = ({ wizardState }) => {
  const { step, canGoNext, canGoPrev, nextStep, prevStep } = wizardState;

  const renderStep = () => {
    switch (step) {
      case 1:
        return <StepTemplate wizardState={wizardState} />;
      case 2:
        return <StepGeography wizardState={wizardState} />;
      case 3:
        return <StepUserInputs wizardState={wizardState} />;
      case 4:
        return <StepReview wizardState={wizardState} />;
      default:
        return null;
    }
  };

  const isGenerateStep = step === 4;

  return (
    <M3Card variant="elevated" size="lg" className="overflow-hidden">
      {/* Step Indicator */}
      <div className="px-6 pt-6 pb-4 border-b border-outline-variant/30">
        <StepIndicator currentStep={step} onStepClick={wizardState.goToStep} />
      </div>

      {/* Step Content */}
      <div className="p-6 min-h-[400px]">{renderStep()}</div>

      {/* Navigation Footer */}
      <div className="px-6 py-4 bg-surface-container border-t border-outline-variant/30 flex justify-between items-center">
        <button
          onClick={prevStep}
          disabled={!canGoPrev()}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
            transition-all duration-200
            ${
              canGoPrev()
                ? 'text-on-surface hover:bg-surface-container-high'
                : 'text-on-surface/30 cursor-not-allowed'
            }
          `}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {isGenerateStep ? (
          <button
            onClick={() => {
              // TODO: Trigger report generation
              console.log('Generate report:', wizardState);
            }}
            disabled={!wizardState.isStepValid(step)}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium
              transition-all duration-200
              ${
                wizardState.isStepValid(step)
                  ? 'bg-primary text-on-primary hover:bg-primary/90 elevation-1'
                  : 'bg-on-surface/10 text-on-surface/30 cursor-not-allowed'
              }
            `}
          >
            <Sparkles className="w-4 h-4" />
            Generate Report
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={!canGoNext()}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium
              transition-all duration-200
              ${
                canGoNext()
                  ? 'bg-primary text-on-primary hover:bg-primary/90 elevation-1'
                  : 'bg-on-surface/10 text-on-surface/30 cursor-not-allowed'
              }
            `}
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </M3Card>
  );
};
