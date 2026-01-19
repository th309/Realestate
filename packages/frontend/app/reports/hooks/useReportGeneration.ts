import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { WizardState, GenerateReportRequest, GenerateReportResponse } from '../types';

// Backend API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UseReportGenerationReturn {
  isGenerating: boolean;
  error: string | null;
  generateReport: (wizardState: WizardState) => Promise<void>;
  clearError: () => void;
}

export function useReportGeneration(): UseReportGenerationReturn {
  const router = useRouter();
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

      // TODO: Get actual user ID from auth context
      const userId = 'demo-user-001';

      const response = await fetch(`${API_BASE_URL}/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate report: ${response.status}`);
      }

      const data: GenerateReportResponse = await response.json();

      // Navigate to the report page
      router.push(`/reports/${data.report_id}`);
    } catch (err) {
      console.error('Report generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
      setIsGenerating(false);
    }
  }, [router]);

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
