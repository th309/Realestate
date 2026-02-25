'use client';

/**
 * Saved Insights CRUD Hook
 *
 * Manages the lifecycle of saved AI insight reports:
 * list, load, save, delete, pin/unpin.
 */

import { useState, useCallback, useEffect } from 'react';
import { fetchAPIRaw } from '@/lib/data';
import type {
  ParsedRecommendation,
} from '../utils/parseRecommendations';

export interface SavedInsightSummary {
  id: string;
  title: string;
  provider: 'deepseek' | 'claude';
  days_analyzed: number;
  is_pinned: boolean;
  recommendation_count: number;
  implemented_count: number;
  created_at: string;
  updated_at: string;
}

export interface SavedInsight {
  id: string;
  user_id: string;
  title: string;
  markdown_content: string;
  recommendations: ParsedRecommendation[];
  provider: 'deepseek' | 'claude';
  days_analyzed: number;
  chat_history: Array<{ role: string; content: string }>;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateInsightPayload {
  title: string;
  markdown_content: string;
  recommendations: ParsedRecommendation[];
  provider: 'deepseek' | 'claude';
  days_analyzed: number;
  chat_history?: Array<{ role: string; content: string }>;
}

const BASE = '/api/admin/analytics/insights';

export function useSavedInsights() {
  const [insights, setInsights] = useState<SavedInsightSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAPIRaw(BASE);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const saveInsight = useCallback(
    async (payload: CreateInsightPayload): Promise<SavedInsight | null> => {
      try {
        const res = await fetchAPIRaw(BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = await res.json();
        await fetchList();
        return saved;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save insight',
        );
        return null;
      }
    },
    [fetchList],
  );

  const loadInsight = useCallback(
    async (id: string): Promise<SavedInsight | null> => {
      try {
        const res = await fetchAPIRaw(`${BASE}/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load insight',
        );
        return null;
      }
    },
    [],
  );

  const updateInsight = useCallback(
    async (
      id: string,
      updates: { title?: string; is_pinned?: boolean },
    ): Promise<boolean> => {
      try {
        const res = await fetchAPIRaw(`${BASE}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchList();
        return true;
      } catch {
        return false;
      }
    },
    [fetchList],
  );

  const deleteInsight = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetchAPIRaw(`${BASE}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchList();
        return true;
      } catch {
        return false;
      }
    },
    [fetchList],
  );

  return {
    insights,
    loading,
    error,
    saveInsight,
    loadInsight,
    updateInsight,
    deleteInsight,
    refetch: fetchList,
  };
}
