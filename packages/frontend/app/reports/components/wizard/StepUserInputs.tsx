'use client';

import React, { useEffect } from 'react';
import { Info } from 'lucide-react';
import type { UseWizardStateReturn } from '../../hooks/useWizardState';
import type { UserInputField } from '../../types';

interface StepUserInputsProps {
  wizardState: UseWizardStateReturn;
}

export const StepUserInputs: React.FC<StepUserInputsProps> = ({ wizardState }) => {
  const { selectedTemplate, userInputs, setUserInput, setUserInputs } = wizardState;

  const inputs = selectedTemplate?.config.user_inputs || [];

  // Initialize user inputs with default values on mount
  useEffect(() => {
    if (inputs.length === 0) return;

    const defaults: Record<string, any> = {};
    let hasNewDefaults = false;

    inputs.forEach((input) => {
      if (input.default !== undefined && userInputs[input.field_name] === undefined) {
        defaults[input.field_name] = input.default;
        hasNewDefaults = true;
      }
    });

    if (hasNewDefaults) {
      setUserInputs({ ...userInputs, ...defaults });
    }
  }, [inputs, userInputs, setUserInputs]);

  if (inputs.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-surface-container rounded-full flex items-center justify-center">
          <Info className="w-8 h-8 text-on-surface-variant" />
        </div>
        <h3 className="text-lg font-medium text-on-surface mb-2">No customization needed</h3>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">
          This report template doesn&apos;t require any additional inputs. You can proceed to review
          your selections.
        </p>
      </div>
    );
  }

  const renderInput = (input: UserInputField) => {
    const value = userInputs[input.field_name] ?? input.default ?? '';

    switch (input.type) {
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => setUserInput(input.field_name, parseFloat(e.target.value) || '')}
            min={input.min}
            max={input.max}
            step={input.step}
            placeholder={input.placeholder}
            className="w-full px-4 py-3 bg-surface-container rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => setUserInput(input.field_name, e.target.value)}
            className="w-full px-4 py-3 bg-surface-container rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select...</option>
            {input.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'range':
        return (
          <div>
            <input
              type="range"
              value={value || input.min || 0}
              onChange={(e) => setUserInput(input.field_name, parseFloat(e.target.value))}
              min={input.min}
              max={input.max}
              step={input.step}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-on-surface-variant mt-1">
              <span>{input.min}</span>
              <span className="font-medium text-on-surface">{value || input.default || input.min}</span>
              <span>{input.max}</span>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => setUserInput(input.field_name, e.target.checked)}
              className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span className="text-sm text-on-surface">{input.label}</span>
          </label>
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => setUserInput(input.field_name, e.target.value)}
            placeholder={input.placeholder}
            className="w-full px-4 py-3 bg-surface-container rounded-xl text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-on-surface mb-2">Customize Your Report</h3>
        <p className="text-sm text-on-surface-variant">
          Provide additional details to personalize your {selectedTemplate?.name} report.
        </p>
      </div>

      <div className="space-y-5">
        {inputs.map((input) => (
          <div key={input.field_name}>
            {input.type !== 'boolean' && (
              <label className="block text-sm font-medium text-on-surface mb-2">
                {input.label}
                {input.required && <span className="text-error ml-1">*</span>}
              </label>
            )}
            {renderInput(input)}
          </div>
        ))}
      </div>
    </div>
  );
};
