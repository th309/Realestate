'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  calculatePITI,
  calculateMaxAffordablePrice,
} from '../components/utils/affordabilityCalc';

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
): AffordabilityCalc | null {
  if (!medianPrice) return null;
  const monthlyIncome = income / 12;

  const piti = calculatePITI({
    price: medianPrice,
    downPayment: downPayment || undefined,
  });

  const dtiRatio = piti.monthlyPITI / monthlyIncome;

  const maxAffordablePrice = calculateMaxAffordablePrice(monthlyIncome, {
    downPayment,
  });

  return {
    monthlyPITI: Math.round(piti.monthlyPITI),
    dtiRatio: Math.round(dtiRatio * 100) / 100,
    maxAffordablePrice,
    downPaymentPct: Math.round(piti.downPaymentPct * 100) / 100,
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
  const abortRef = useRef<AbortController | null>(null);
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

      // Cancel any in-flight request before starting a new one
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setRegenerating(narrativeKeys);

      try {
        await fetch(`${API_URL}/api/reports/${reportId}/regenerate-narratives`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_inputs: inputs }),
          signal: controller.signal,
        });
      } catch (e) {
        // Ignore abort errors; silently fail on network errors
        if (e instanceof DOMException && e.name === 'AbortError') return;
      } finally {
        // Only clear regenerating if this is still the active request
        if (abortRef.current === controller) {
          setRegenerating(new Set());
        }
      }
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
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
