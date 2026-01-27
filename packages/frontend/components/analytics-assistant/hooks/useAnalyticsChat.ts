/**
 * Hook for Analytics Assistant chat functionality
 */

import { useState, useCallback, useRef } from 'react';
import { Message, AnalyticsContext } from '../types';

interface UseChatOptions {
  context?: AnalyticsContext;
  onError?: (error: Error) => void;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  conversationId: string;
}

export function useAnalyticsChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate stable conversation ID
  const conversationIdRef = useRef(
    `analytics-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        // Build request body
        const requestBody: Record<string, unknown> = {
          message: content.trim(),
        };

        if (options.context) {
          requestBody.context = options.context;
        }

        const response = await fetch(
          `/api/analytics/chat/${conversationIdRef.current}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to get response');
        }

        let content = typeof data.response === 'string' ? data.response.trim() : '';
        if (!content && data.structuredData?.rankings?.items?.length) {
          const r = data.structuredData.rankings;
          const label = r.direction === 'bottom' ? 'Bottom' : 'Top';
          const top = r.items.slice(0, 5);
          content = `${label} markets:\n${top.map((i: { rank: number; name: string; score?: number; state?: string }) => `${i.rank}. ${i.name}${i.score != null ? ` (${i.score})` : ''}${i.state ? `, ${i.state}` : ''}`).join('\n')}`;
        }
        if (!content && data.structuredData?.errorMessage) {
          content = `Unable to retrieve rankings: ${data.structuredData.errorMessage}`;
        }
        if (!content) content = 'I received your message but had trouble showing a response. Please try again.';

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content,
          toolsUsed: data.toolsUsed,
          timestamp: new Date().toISOString(),
          // Include structured data for visual rendering if present
          data: data.structuredData,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        options.onError?.(err instanceof Error ? err : new Error(errorMessage));

        // Add error message to chat
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content:
              'I encountered an error processing your request. Please try again.',
            timestamp: new Date().toISOString(),
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, options]
  );

  const clearMessages = useCallback(async () => {
    try {
      await fetch(`/api/analytics/chat/${conversationIdRef.current}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore cleanup errors
    }
    setMessages([]);
    setError(null);
    // Generate new conversation ID
    conversationIdRef.current = `analytics-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    conversationId: conversationIdRef.current,
  };
}
