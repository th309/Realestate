import React from 'react';
import { Loader2, TrendingUp, Newspaper, Sparkles } from 'lucide-react';
import { ReportWithTemplate } from './types';

export const GENERATION_STEPS = [
  { id: 'scores', label: 'Calculating market scores', icon: TrendingUp, description: 'Analyzing market health indicators' },
  { id: 'news', label: 'Gathering market signals', icon: Newspaper, description: 'Collecting recent market data' },
  { id: 'ai', label: 'Generating AI analysis', icon: Sparkles, description: 'Creating personalized insights' },
];

interface GeneratingStateProps {
  report: ReportWithTemplate;
  step: number;
}

export function GeneratingState({ report, step }: GeneratingStateProps) {
  const currentStep = GENERATION_STEPS[step];

  return (
    <div className="report-page min-h-screen flex items-center justify-center">
      <div className="text-center max-w-lg px-6">
        {/* Animated Loader */}
        <div className="relative mb-10">
          <div className="w-28 h-28 mx-auto rounded-full bg-[var(--report-cream-dark)] flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-inner">
              <Loader2 className="w-10 h-10 text-[var(--report-navy)] animate-spin" />
            </div>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white px-4 py-1.5 rounded-full shadow-md border border-[rgba(27,46,74,0.08)]">
            <span className="text-sm font-medium text-[var(--report-navy)]">
              Step {step + 1} of {GENERATION_STEPS.length}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="report-heading-lg mb-2">Generating Your Report</h2>
        <p className="report-body mb-8">{report.primary_geography_name}</p>

        {/* Progress Steps */}
        <div className="report-card p-5 text-left">
          {GENERATION_STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = index === step;
            const isComplete = index < step;

            return (
              <div
                key={s.id}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${isActive ? 'bg-[var(--report-cream)]' : ''}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isComplete
                      ? 'bg-[var(--report-success)] text-white'
                      : isActive
                      ? 'bg-[var(--report-navy)] text-white'
                      : 'bg-[var(--report-cream-dark)] text-[var(--report-stone-light)]'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isActive ? 'text-[var(--report-navy)]' : 'text-[var(--report-stone)]'}`}>
                    {s.label}
                  </p>
                  <p className="text-xs text-[var(--report-stone-light)]">{s.description}</p>
                </div>
                {isActive && <Loader2 className="w-5 h-5 text-[var(--report-navy)] animate-spin" />}
              </div>
            );
          })}
        </div>

        <p className="report-body-sm mt-6">This usually takes 10-30 seconds</p>
      </div>
    </div>
  );
}
