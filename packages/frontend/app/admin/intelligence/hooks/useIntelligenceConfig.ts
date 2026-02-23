/**
 * useIntelligenceConfig Hook
 *
 * Fetches config entries for intelligence, news, and llm categories
 * from the admin config API. Provides update functionality with
 * optimistic updates and "Saved" confirmation feedback.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAPIRaw } from '@/lib/data';

export interface ConfigEntry {
  key: string;
  value: string;
  description: string | null;
  field_type: string | null;
  field_options: Record<string, unknown> | null;
  category: string | null;
  display_order: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface ConfigCategory {
  label: string;
  entries: ConfigEntry[];
  loading: boolean;
  error: string | null;
}

interface UseIntelligenceConfigReturn {
  categories: Record<string, ConfigCategory>;
  updateConfigValue: (key: string, value: string) => Promise<void>;
  recentlySaved: Set<string>;
  refreshAll: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  intelligence: 'Intelligence Features',
  news: 'News API',
  llm: 'LLM Provider',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

export function useIntelligenceConfig(): UseIntelligenceConfigReturn {
  const [categories, setCategories] = useState<Record<string, ConfigCategory>>(
    () =>
      Object.fromEntries(
        CATEGORIES.map((cat) => [
          cat,
          { label: CATEGORY_LABELS[cat], entries: [], loading: true, error: null },
        ]),
      ) as Record<string, ConfigCategory>,
  );

  const [recentlySaved, setRecentlySaved] = useState<Set<string>>(new Set());
  const savedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const fetchCategory = useCallback(async (category: string) => {
    setCategories((prev) => ({
      ...prev,
      [category]: { ...prev[category], loading: true, error: null },
    }));

    try {
      const res = await fetchAPIRaw(`/api/admin/config/${category}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const entries: ConfigEntry[] = json.data ?? [];

      setCategories((prev) => ({
        ...prev,
        [category]: { ...prev[category], entries, loading: false },
      }));
    } catch (err) {
      setCategories((prev) => ({
        ...prev,
        [category]: {
          ...prev[category],
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load',
        },
      }));
    }
  }, []);

  const refreshAll = useCallback(() => {
    CATEGORIES.forEach(fetchCategory);
  }, [fetchCategory]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const updateConfigValue = useCallback(
    async (key: string, value: string) => {
      // Optimistic update in local state
      setCategories((prev) => {
        const updated = { ...prev };
        for (const cat of CATEGORIES) {
          const idx = updated[cat].entries.findIndex((e) => e.key === key);
          if (idx !== -1) {
            const newEntries = [...updated[cat].entries];
            newEntries[idx] = { ...newEntries[idx], value };
            updated[cat] = { ...updated[cat], entries: newEntries };
            break;
          }
        }
        return updated;
      });

      // PUT to the backend
      const res = await fetchAPIRaw(`/api/admin/config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save ${key}: HTTP ${res.status}`);
      }

      // Show "Saved" indicator for 2 seconds
      setRecentlySaved((prev) => new Set(prev).add(key));
      const existingTimer = savedTimers.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        setRecentlySaved((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        savedTimers.current.delete(key);
      }, 2000);
      savedTimers.current.set(key, timer);
    },
    [],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      savedTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return { categories, updateConfigValue, recentlySaved, refreshAll };
}
