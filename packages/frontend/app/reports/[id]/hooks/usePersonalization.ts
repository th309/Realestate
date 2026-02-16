'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UserInputs {
  income?: number;
  down_payment?: number;
  timeline?: string;
  priorities?: string[];
  first_time_buyer?: boolean;
  risk_tolerance?: string;
  // Investor inputs
  investment_budget?: number;
  investment_strategy?: string;
  portfolio_size?: number;
}

interface AffordabilityCalc {
  monthlyPITI: number;
  dtiRatio: number;
  maxAffordablePrice: number;
  downPaymentPct: number;
}

interface PersonalizationState {
  inputs: UserInputs;
  setInput: (key: keyof UserInputs, value: any) => void;
  setInputs: (updates: Partial<UserInputs>) => void;
  affordabilityCalc: AffordabilityCalc | null;
  regenerating: Set<string>;
  dirty: boolean;
  reset: () => void;
}

function calculateAffordability(
  income: number,
  downPayment: number | undefined,
  medianPrice: number | null,
): AffordabilityCalc {
  const monthlyIncome = income / 12;
  const price = medianPrice || 400000; // fallback
  const dp = downPayment || price * 0.2;
  const dpPct = dp / price;
  const loanAmount = price - dp;
  const monthlyRate = 0.07 / 12; // 7% rate assumption
  const numPayments = 360; // 30 years

  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  const monthlyTax = (price * 0.012) / 12;
  const monthlyInsurance = (price * 0.005) / 12;
  const monthlyPITI = monthlyMortgage + monthlyTax + monthlyInsurance;

  const dtiRatio = monthlyPITI / monthlyIncome;

  // Max affordable: 28% DTI target
  const targetMonthly = monthlyIncome * 0.28;
  const maxLoan = targetMonthly / (monthlyRate * Math.pow(1 + monthlyRate, numPayments) /
    (Math.pow(1 + monthlyRate, numPayments) - 1));
  const maxAffordablePrice = maxLoan + (downPayment || maxLoan * 0.25);

  return {
    monthlyPITI: Math.round(monthlyPITI),
    dtiRatio: Math.round(dtiRatio * 100) / 100,
    maxAffordablePrice: Math.round(maxAffordablePrice),
    downPaymentPct: Math.round(dpPct * 100) / 100,
  };
}

export function usePersonalization(
  reportId: string,
  initialInputs: UserInputs | undefined,
  medianPrice: number | null,
): PersonalizationState {
  const [inputs, setInputsState] = useState<UserInputs>(initialInputs || {});
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialRef = useRef(initialInputs);

  const setInput = useCallback((key: keyof UserInputs, value: any) => {
    setInputsState(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const setInputsBatch = useCallback((updates: Partial<UserInputs>) => {
    setInputsState(prev => ({ ...prev, ...updates }));
    setDirty(true);
  }, []);

  const reset = useCallback(() => {
    setInputsState(initialRef.current || {});
    setDirty(false);
  }, []);

  // Client-side affordability recalculation
  const affordabilityCalc = useMemo(() => {
    if (!inputs.income) return null;
    return calculateAffordability(inputs.income, inputs.down_payment, medianPrice);
  }, [inputs.income, inputs.down_payment, medianPrice]);

  // Debounced narrative regeneration
  useEffect(() => {
    if (!dirty) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      // Determine which narratives need regeneration based on what changed
      const narrativeKeys = new Set<string>();
      if (inputs.income !== initialRef.current?.income || inputs.down_payment !== initialRef.current?.down_payment) {
        narrativeKeys.add('affordability_narrative');
        narrativeKeys.add('affordability_personalized');
      }
      if (JSON.stringify(inputs.priorities) !== JSON.stringify(initialRef.current?.priorities)) {
        narrativeKeys.add('priorities_narrative');
        narrativeKeys.add('priorities_personalized');
      }
      // Always regenerate bottom line when anything changes
      narrativeKeys.add('bottom_line_narrative');
      narrativeKeys.add('bottom_line_actions');

      if (narrativeKeys.size === 0) return;

      setRegenerating(narrativeKeys);

      try {
        await fetch(`${API_URL}/api/reports/${reportId}/regenerate-narratives`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_inputs: inputs }),
        });
      } catch {
        // Silently fail — narratives will keep showing old values
      } finally {
        setRegenerating(new Set());
      }
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputs, dirty, reportId]);

  return {
    inputs,
    setInput,
    setInputs: setInputsBatch,
    affordabilityCalc,
    regenerating,
    dirty,
    reset,
  };
}
