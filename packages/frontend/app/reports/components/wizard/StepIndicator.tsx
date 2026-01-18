'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { WIZARD_STEPS } from '../../constants';

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  return (
    <div className="flex items-center justify-between">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;
        const isClickable = step.id <= currentStep;

        return (
          <React.Fragment key={step.id}>
            {/* Step */}
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={`
                flex flex-col items-center gap-2 transition-all duration-200
                ${isClickable ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              {/* Circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  text-sm font-medium transition-all duration-200
                  ${
                    isCompleted
                      ? 'bg-primary text-on-primary'
                      : isCurrent
                      ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                      : 'bg-surface-container text-on-surface-variant'
                  }
                `}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : step.id}
              </div>

              {/* Label */}
              <div className="text-center">
                <div
                  className={`
                    text-xs font-medium
                    ${isCurrent || isCompleted ? 'text-on-surface' : 'text-on-surface-variant'}
                  `}
                >
                  {step.name}
                </div>
                <div className="text-[10px] text-on-surface-variant hidden sm:block">
                  {step.description}
                </div>
              </div>
            </button>

            {/* Connector Line */}
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 mx-4 transition-colors duration-200
                  ${currentStep > step.id ? 'bg-primary' : 'bg-outline-variant/50'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
