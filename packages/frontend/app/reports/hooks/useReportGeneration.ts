import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEntitlements } from '@/lib/entitlements/EntitlementsContext';
import { useAuth } from '@/lib/auth';
import { generateReport as generateReportAPI } from '@/lib/data';
import type { WizardState, GenerateReportRequest, GenerateReportResponse } from '../types';

export interface UseReportGenerationReturn {
  isGenerating: boolean;
  error: string | null;
  generateReport: (wizardState: WizardState) => Promise<void>;
  clearError: () => void;
}

export function useReportGeneration(): UseReportGenerationReturn {
  const router = useRouter();
  const { user } = useAuth();
  const { simulatedTier, tier } = useEntitlements();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async (wizardState: WizardState) => {
    const { selectedTemplate, userType, primaryGeography, comparisonGeographies, userInputs } = wizardState;

    // Validation
    if (!selectedTemplate) {
      setError('Please select a report template');
      return;
    }

    if (!primaryGeography) {
      setError('Please select a primary market');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const requestBody: GenerateReportRequest = {
        template_slug: selectedTemplate.slug,
        user_type: userType,
        primary_geography: {
          id: primaryGeography.id,
          type: primaryGeography.type,
          name: primaryGeography.name,
          state: primaryGeography.state,
        },
        comparison_geographies: comparisonGeographies.length > 0
          ? comparisonGeographies.map((geo) => ({
            id: geo.id,
            type: geo.type,
            name: geo.name,
            state: geo.state,
          }))
          : undefined,
        user_inputs: Object.keys(userInputs).length > 0 ? userInputs : undefined,
      };

      const userId = user?.id;
      if (!userId) {
        setError('You must be signed in to generate a report.');
        setIsGenerating(false);
        return;
      }

      const effectiveTier = simulatedTier || tier;
      const data = await generateReportAPI(requestBody, {
        userId,
        userTier: effectiveTier || undefined,
      });

      // Navigate to the report page
      router.push(`/reports/${data.report_id}`);
    } catch (err) {
      console.error('Report generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setIsGenerating(false);
    }
  }, [router, user, simulatedTier, tier]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isGenerating,
    error,
    generateReport,
    clearError,
  };
}
