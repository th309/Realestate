'use client';

/**
 * Hook for managing saved queries
 */

import { useState, useCallback, useEffect } from 'react';
import type { SavedQuery } from './types';

interface UseSavedQueriesOptions {
  userId: string;
  autoLoad?: boolean;
}

interface UseSavedQueriesReturn {
  queries: SavedQuery[];
  favorites: SavedQuery[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveQuery: (name: string, queryText: string, description?: string) => Promise<SavedQuery | null>;
  updateQuery: (id: string, updates: Partial<SavedQuery>) => Promise<void>;
  deleteQuery: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  runQuery: (id: string) => Promise<SavedQuery | null>;
}

export function useSavedQueries({
  userId,
  autoLoad = true,
}: UseSavedQueriesOptions): UseSavedQueriesReturn {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analytics/persistence/saved-queries?userId=${userId}`
      );
      const data = await response.json();

      if (data.success) {
        setQueries(data.data || []);
      } else {
        setError(data.error || 'Failed to load saved queries');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved queries');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoad && userId) {
      refresh();
    }
  }, [autoLoad, userId, refresh]);

  const saveQuery = useCallback(
    async (
      name: string,
      queryText: string,
      description?: string
    ): Promise<SavedQuery | null> => {
      try {
        const response = await fetch('/api/analytics/persistence/saved-queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            name,
            query_text: queryText,
            description,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setQueries((prev) => [data.data, ...prev]);
          return data.data;
        } else {
          setError(data.error);
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save query');
        return null;
      }
    },
    [userId]
  );

  const updateQuery = useCallback(
    async (id: string, updates: Partial<SavedQuery>) => {
      try {
        const response = await fetch(`/api/analytics/persistence/saved-queries/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...updates }),
        });

        const data = await response.json();

        if (data.success) {
          setQueries((prev) =>
            prev.map((q) => (q.id === id ? { ...q, ...data.data } : q))
          );
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update query');
      }
    },
    [userId]
  );

  const deleteQuery = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/analytics/persistence/saved-queries/${id}?userId=${userId}`,
          { method: 'DELETE' }
        );

        const data = await response.json();

        if (data.success) {
          setQueries((prev) => prev.filter((q) => q.id !== id));
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete query');
      }
    },
    [userId]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const query = queries.find((q) => q.id === id);
      if (query) {
        await updateQuery(id, { is_favorite: !query.is_favorite });
      }
    },
    [queries, updateQuery]
  );

  const runQuery = useCallback(
    async (id: string): Promise<SavedQuery | null> => {
      try {
        const response = await fetch(
          `/api/analytics/persistence/saved-queries/${id}/run`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }
        );

        const data = await response.json();

        if (data.success) {
          setQueries((prev) =>
            prev.map((q) => (q.id === id ? data.data : q))
          );
          return data.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [userId]
  );

  const favorites = queries.filter((q) => q.is_favorite);

  return {
    queries,
    favorites,
    isLoading,
    error,
    refresh,
    saveQuery,
    updateQuery,
    deleteQuery,
    toggleFavorite,
    runQuery,
  };
}
