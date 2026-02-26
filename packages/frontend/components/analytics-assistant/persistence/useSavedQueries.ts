"use client";

/**
 * Hook for managing saved queries
 *
 * Uses JWT auth headers — userId is extracted from the token on the backend.
 */

import { useState, useCallback, useEffect } from "react";
import { getAuthHeaders } from "@/lib/data/fetchers/auth-headers";
import type { SavedQuery } from "./types";

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
  saveQuery: (
    name: string,
    queryText: string,
    description?: string,
  ) => Promise<SavedQuery | null>;
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
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/analytics/persistence/saved-queries`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (data.success) {
        setQueries(data.data || []);
      } else {
        setError(data.error || "Failed to load saved queries");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load saved queries",
      );
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
      description?: string,
    ): Promise<SavedQuery | null> => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          "/api/analytics/persistence/saved-queries",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              name,
              query_text: queryText,
              description,
            }),
          },
        );

        const data = await response.json();

        if (data.success) {
          setQueries((prev) => [data.data, ...prev]);
          return data.data;
        } else {
          setError(data.error);
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save query");
        return null;
      }
    },
    [],
  );

  const updateQuery = useCallback(
    async (id: string, updates: Partial<SavedQuery>) => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          `/api/analytics/persistence/saved-queries/${id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify(updates),
          },
        );

        const data = await response.json();

        if (data.success) {
          setQueries((prev) =>
            prev.map((q) => (q.id === id ? { ...q, ...data.data } : q)),
          );
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update query");
      }
    },
    [],
  );

  const deleteQuery = useCallback(async (id: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `/api/analytics/persistence/saved-queries/${id}`,
        { method: "DELETE", headers: authHeaders },
      );

      const data = await response.json();

      if (data.success) {
        setQueries((prev) => prev.filter((q) => q.id !== id));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete query");
    }
  }, []);

  const toggleFavorite = useCallback(
    async (id: string) => {
      const query = queries.find((q) => q.id === id);
      if (query) {
        await updateQuery(id, { is_favorite: !query.is_favorite });
      }
    },
    [queries, updateQuery],
  );

  const runQuery = useCallback(
    async (id: string): Promise<SavedQuery | null> => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          `/api/analytics/persistence/saved-queries/${id}/run`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({}),
          },
        );

        const data = await response.json();

        if (data.success) {
          setQueries((prev) => prev.map((q) => (q.id === id ? data.data : q)));
          return data.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [],
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
