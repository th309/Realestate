"use client";

/**
 * Hook for managing conversation history
 *
 * Uses JWT auth headers — userId is extracted from the token on the backend.
 */

import { useState, useCallback, useEffect } from "react";
import { getAuthHeaders } from "@/lib/data/fetchers/auth-headers";
import type { Conversation, ConversationMessage } from "./types";

interface UseConversationsOptions {
  userId: string;
  autoLoad?: boolean;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getConversation: (conversationId: string) => Promise<Conversation | null>;
  saveConversation: (
    conversationId: string,
    messages: ConversationMessage[],
    title?: string,
  ) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  updateTitle: (conversationId: string, title: string) => Promise<void>;
}

export function useConversations({
  userId,
  autoLoad = true,
}: UseConversationsOptions): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/analytics/persistence/conversations`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (data.success) {
        setConversations(data.data || []);
      } else {
        setError(data.error || "Failed to load conversations");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversations",
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

  const getConversation = useCallback(
    async (conversationId: string): Promise<Conversation | null> => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          `/api/analytics/persistence/conversations/${conversationId}`,
          { headers: authHeaders },
        );
        const data = await response.json();

        if (data.success && data.data) {
          return data.data;
        }
        return null;
      } catch {
        return null;
      }
    },
    [],
  );

  const saveConversation = useCallback(
    async (
      conversationId: string,
      messages: ConversationMessage[],
      title?: string,
    ) => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          "/api/analytics/persistence/conversations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              conversation_id: conversationId,
              messages,
              title,
            }),
          },
        );

        const data = await response.json();

        if (data.success) {
          // Update local state
          setConversations((prev) => {
            const existing = prev.find(
              (c) => c.conversation_id === conversationId,
            );
            if (existing) {
              return prev.map((c) =>
                c.conversation_id === conversationId ? data.data : c,
              );
            }
            return [data.data, ...prev];
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save conversation",
        );
      }
    },
    [],
  );

  const archiveConversation = useCallback(async (conversationId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `/api/analytics/persistence/conversations/${conversationId}/archive`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({}),
        },
      );

      const data = await response.json();

      if (data.success) {
        setConversations((prev) =>
          prev.filter((c) => c.conversation_id !== conversationId),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to archive conversation",
      );
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `/api/analytics/persistence/conversations/${conversationId}`,
        { method: "DELETE", headers: authHeaders },
      );

      const data = await response.json();

      if (data.success) {
        setConversations((prev) =>
          prev.filter((c) => c.conversation_id !== conversationId),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete conversation",
      );
    }
  }, []);

  const updateTitle = useCallback(
    async (conversationId: string, title: string) => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(
          `/api/analytics/persistence/conversations/${conversationId}/title`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ title }),
          },
        );

        const data = await response.json();

        if (data.success) {
          setConversations((prev) =>
            prev.map((c) =>
              c.conversation_id === conversationId
                ? { ...c, title: data.data.title }
                : c,
            ),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update title");
      }
    },
    [],
  );

  return {
    conversations,
    isLoading,
    error,
    refresh,
    getConversation,
    saveConversation,
    archiveConversation,
    deleteConversation,
    updateTitle,
  };
}
