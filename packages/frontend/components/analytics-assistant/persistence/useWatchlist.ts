'use client';

/**
 * Hook for managing market watchlist
 */

import { useState, useCallback, useEffect } from 'react';
import type { WatchlistItem } from './types';

interface UseWatchlistOptions {
  userId: string;
  autoLoad?: boolean;
}

interface UseWatchlistReturn {
  items: WatchlistItem[];
  folders: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addToWatchlist: (
    geographyType: string,
    geographyId: string,
    geographyName?: string,
    scoreAtAdd?: number
  ) => Promise<WatchlistItem | null>;
  removeFromWatchlist: (id: string) => Promise<void>;
  isInWatchlist: (geographyType: string, geographyId: string) => boolean;
  updateItem: (id: string, updates: { tags?: string[]; folder?: string }) => Promise<void>;
  getByFolder: (folder: string | null) => WatchlistItem[];
}

export function useWatchlist({
  userId,
  autoLoad = true,
}: UseWatchlistOptions): UseWatchlistReturn {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [itemsRes, foldersRes] = await Promise.all([
        fetch(`/api/analytics/persistence/watchlist?userId=${userId}`),
        fetch(`/api/analytics/persistence/watchlist/folders?userId=${userId}`),
      ]);

      const itemsData = await itemsRes.json();
      const foldersData = await foldersRes.json();

      if (itemsData.success) {
        setItems(itemsData.data || []);
      }
      if (foldersData.success) {
        setFolders(foldersData.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoad && userId) {
      refresh();
    }
  }, [autoLoad, userId, refresh]);

  const addToWatchlist = useCallback(
    async (
      geographyType: string,
      geographyId: string,
      geographyName?: string,
      scoreAtAdd?: number
    ): Promise<WatchlistItem | null> => {
      try {
        const response = await fetch('/api/analytics/persistence/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            geography_type: geographyType,
            geography_id: geographyId,
            geography_name: geographyName,
            score_at_add: scoreAtAdd,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setItems((prev) => [data.data, ...prev]);
          return data.data;
        } else {
          setError(data.error);
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add to watchlist');
        return null;
      }
    },
    [userId]
  );

  const removeFromWatchlist = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(
          `/api/analytics/persistence/watchlist/${id}?userId=${userId}`,
          { method: 'DELETE' }
        );

        const data = await response.json();

        if (data.success) {
          setItems((prev) => prev.filter((item) => item.id !== id));
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove from watchlist');
      }
    },
    [userId]
  );

  const isInWatchlist = useCallback(
    (geographyType: string, geographyId: string): boolean => {
      return items.some(
        (item) =>
          item.geography_type === geographyType &&
          item.geography_id === geographyId
      );
    },
    [items]
  );

  const updateItem = useCallback(
    async (id: string, updates: { tags?: string[]; folder?: string }) => {
      try {
        const response = await fetch(`/api/analytics/persistence/watchlist/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...updates }),
        });

        const data = await response.json();

        if (data.success) {
          setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...data.data } : item))
          );

          // Update folders if needed
          if (updates.folder && !folders.includes(updates.folder)) {
            setFolders((prev) => [...prev, updates.folder!].sort());
          }
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update watchlist item');
      }
    },
    [userId, folders]
  );

  const getByFolder = useCallback(
    (folder: string | null): WatchlistItem[] => {
      if (folder === null) {
        return items.filter((item) => !item.folder);
      }
      return items.filter((item) => item.folder === folder);
    },
    [items]
  );

  return {
    items,
    folders,
    isLoading,
    error,
    refresh,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    updateItem,
    getByFolder,
  };
}
