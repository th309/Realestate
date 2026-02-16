'use client';

import React, { useState } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  DollarSign,
  Calendar,
  Star,
  Briefcase,
} from 'lucide-react';

interface PersonalizationPanelProps {
  inputs: Record<string, any>;
  setInput: (key: string, value: any) => void;
  dirty: boolean;
  reset: () => void;
  regenerating: Set<string>;
  userType: string;
  className?: string;
}

const PRIORITIES_HOMEBUYER = [
  { id: 'affordability', label: 'Affordability' },
  { id: 'growth', label: 'Growth Potential' },
  { id: 'market_timing', label: 'Market Timing' },
  { id: 'stability', label: 'Stability' },
  { id: 'value', label: 'Value' },
];

const PRIORITIES_INVESTOR = [
  { id: 'cash_flow', label: 'Cash Flow' },
  { id: 'appreciation', label: 'Appreciation' },
  { id: 'rent_demand', label: 'Rent Demand' },
  { id: 'entry_point', label: 'Entry Price' },
  { id: 'risk', label: 'Low Risk' },
];

const TIMELINES = [
  { id: '3_months', label: '3 months' },
  { id: '6_months', label: '6 months' },
  { id: '1_year', label: '1 year' },
  { id: '2_years', label: '2+ years' },
];

const STRATEGIES = [
  { id: 'buy_and_hold', label: 'Buy & Hold' },
  { id: 'flip', label: 'Fix & Flip' },
  { id: 'brrrr', label: 'BRRRR' },
  { id: 'house_hack', label: 'House Hack' },
];

const RISK_LEVELS = [
  { id: 'conservative', label: 'Conservative' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'aggressive', label: 'Aggressive' },
];

export function PersonalizationPanel({
  inputs,
  setInput,
  dirty,
  reset,
  regenerating,
  userType,
  className = '',
}: PersonalizationPanelProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const isInvestor = userType === 'investor';
  const priorities = isInvestor ? PRIORITIES_INVESTOR : PRIORITIES_HOMEBUYER;
  const selectedPriorities = (inputs.priorities as string[]) || [];

  const togglePriority = (id: string) => {
    const current = [...selectedPriorities];
    const idx = current.indexOf(id);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else if (current.length < 3) {
      current.push(id);
    }
    setInput('priorities', current);
  };

  return (
    <div className={`report-no-print ${className}`}>
      {/* Toggle Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-3 bg-white border-b border-[rgba(27,46,74,0.08)] hover:bg-[var(--report-cream)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--report-navy)]" />
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--report-navy)', fontFamily: 'var(--report-font-body)' }}
          >
            Personalize This Report
          </span>
          {dirty && (
            <span
              className="px-2 py-0.5 rounded-full text-[0.625rem] font-semibold uppercase"
              style={{ backgroundColor: 'var(--report-warning-bg)', color: 'var(--report-warning)' }}
            >
              Modified
            </span>
          )}
          {regenerating.size > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[0.625rem] font-semibold uppercase animate-pulse"
              style={{ backgroundColor: 'var(--report-cream-dark)', color: 'var(--report-stone)' }}
            >
              Updating...
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--report-stone)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--report-stone)]" />
        )}
      </button>

      {/* Expanded Panel */}
      {expanded && (
        <div className="bg-white border-b border-[rgba(27,46,74,0.08)] px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Priorities */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-3"
                  style={{ color: 'var(--report-stone)' }}>
                  <Star className="w-3.5 h-3.5" />
                  Your Priorities (pick up to 3)
                </label>
                <div className="flex flex-wrap gap-2">
                  {priorities.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePriority(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedPriorities.includes(p.id)
                          ? 'text-white'
                          : 'hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: selectedPriorities.includes(p.id)
                          ? 'var(--report-navy)'
                          : 'var(--report-cream)',
                        color: selectedPriorities.includes(p.id)
                          ? 'white'
                          : 'var(--report-navy)',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Financial Inputs */}
              <div className="space-y-4">
                {/* Income / Budget */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--report-stone)' }}>
                    <DollarSign className="w-3.5 h-3.5" />
                    {isInvestor ? 'Investment Budget' : 'Annual Income'}
                  </label>
                  <input
                    type="number"
                    value={isInvestor ? (inputs.investment_budget || '') : (inputs.income || '')}
                    onChange={e => {
                      const val = e.target.value ? Number(e.target.value) : undefined;
                      setInput(isInvestor ? 'investment_budget' : 'income', val);
                    }}
                    placeholder={isInvestor ? 'e.g. 500000' : 'e.g. 85000'}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[rgba(27,46,74,0.15)] focus:outline-none focus:ring-2 focus:ring-[var(--report-navy)]/20 focus:border-[var(--report-navy)]"
                    style={{ fontFamily: 'var(--report-font-body)' }}
                  />
                </div>

                {/* Down Payment */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5"
                    style={{ color: 'var(--report-stone)' }}>
                    <DollarSign className="w-3.5 h-3.5" />
                    Down Payment
                  </label>
                  <input
                    type="number"
                    value={inputs.down_payment || ''}
                    onChange={e => setInput('down_payment', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 100000"
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[rgba(27,46,74,0.15)] focus:outline-none focus:ring-2 focus:ring-[var(--report-navy)]/20 focus:border-[var(--report-navy)]"
                    style={{ fontFamily: 'var(--report-font-body)' }}
                  />
                </div>

                {/* Timeline (homebuyer only) */}
                {!isInvestor && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--report-stone)' }}>
                      <Calendar className="w-3.5 h-3.5" />
                      Purchase Timeline
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TIMELINES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setInput('timeline', t.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors`}
                          style={{
                            backgroundColor: inputs.timeline === t.id ? 'var(--report-navy)' : 'var(--report-cream)',
                            color: inputs.timeline === t.id ? 'white' : 'var(--report-navy)',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Investor: Strategy */}
                {isInvestor && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--report-stone)' }}>
                      <Briefcase className="w-3.5 h-3.5" />
                      Investment Strategy
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {STRATEGIES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setInput('investment_strategy', s.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors`}
                          style={{
                            backgroundColor: inputs.investment_strategy === s.id ? 'var(--report-navy)' : 'var(--report-cream)',
                            color: inputs.investment_strategy === s.id ? 'white' : 'var(--report-navy)',
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Investor: Risk Tolerance */}
                {isInvestor && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--report-stone)' }}>
                      Risk Tolerance
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {RISK_LEVELS.map(r => (
                        <button
                          key={r.id}
                          onClick={() => setInput('risk_tolerance', r.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors`}
                          style={{
                            backgroundColor: inputs.risk_tolerance === r.id ? 'var(--report-navy)' : 'var(--report-cream)',
                            color: inputs.risk_tolerance === r.id ? 'white' : 'var(--report-navy)',
                          }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Reset */}
            {dirty && (
              <div className="mt-4 pt-4 border-t border-[rgba(27,46,74,0.06)] flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--report-stone-light)' }}>
                  Changes are applied automatically. AI insights will refresh shortly.
                </p>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[var(--report-cream)] transition-colors"
                  style={{ color: 'var(--report-stone)' }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalizationPanel;
