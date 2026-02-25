'use client';

/**
 * Recommendation Executor Hook
 *
 * Handles the "Implement" button lifecycle:
 * request plan (SSE stream) → preview → execute/dismiss.
 */

import { useState, useCallback, useRef } from 'react';
import { fetchAPIRaw } from '@/lib/data';

export interface ImplementationPlan {
  action_type: 'db_change' | 'code_change' | 'manual';
  summary: string;
  risk_level: 'low' | 'medium' | 'high';
  db_operations?: Array<{
    entity: string;
    field: string;
    current_value: unknown;
    new_value: unknown;
    tier_slug?: string;
    feature_slug?: string;
  }>;
  code_files?: Array<{
    file_path: string;
    description: string;
    code: string;
    language: string;
  }>;
  manual_steps?: Array<{
    step_number: number;
    description: string;
    effort_estimate?: string;
  }>;
}

interface ExecutionResult {
  success: boolean;
  executed: string[];
  errors: string[];
}

const BASE = '/api/admin/analytics/insights';

export function useRecommendationExecutor() {
  const [planLoading, setPlanLoading] = useState(false);
  const [planStreamText, setPlanStreamText] = useState('');
  const [currentPlan, setCurrentPlan] = useState<ImplementationPlan | null>(
    null,
  );
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const requestPlan = useCallback(
    async (insightId: string, recId: string) => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setPlanLoading(true);
      setPlanStreamText('');
      setCurrentPlan(null);
      setExecutionResult(null);
      setError(null);

      try {
        const res = await fetchAPIRaw(
          `${BASE}/${insightId}/recommendations/${recId}/plan`,
          { method: 'POST', signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'text') {
                accumulated += parsed.content;
                setPlanStreamText(accumulated);
              } else if (parsed.type === 'plan') {
                setCurrentPlan(parsed.content);
              } else if (parsed.type === 'error') {
                setError(parsed.content || 'Plan generation failed');
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to generate plan');
        }
      } finally {
        setPlanLoading(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const executePlan = useCallback(
    async (insightId: string, recId: string, plan: ImplementationPlan) => {
      setExecuting(true);
      setError(null);

      try {
        const res = await fetchAPIRaw(
          `${BASE}/${insightId}/recommendations/${recId}/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        setExecutionResult(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Execution failed');
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [],
  );

  const dismissRecommendation = useCallback(
    async (insightId: string, recId: string) => {
      try {
        await fetchAPIRaw(
          `${BASE}/${insightId}/recommendations/${recId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'dismissed' }),
          },
        );
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const clearPlan = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setPlanLoading(false);
    setPlanStreamText('');
    setCurrentPlan(null);
    setExecutionResult(null);
    setError(null);
  }, []);

  return {
    planLoading,
    planStreamText,
    currentPlan,
    executing,
    executionResult,
    error,
    requestPlan,
    executePlan,
    dismissRecommendation,
    clearPlan,
  };
}
