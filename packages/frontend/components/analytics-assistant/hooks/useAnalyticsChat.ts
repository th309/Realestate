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
  isExplaining: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  explainResult: (messageId: string) => Promise<void>;
  clearMessages: () => void;
  conversationId: string;
}

export function useAnalyticsChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
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
        const requestBody: {
          message: string;
          context?: AnalyticsContext;
        } = {
          message: content.trim(),
          ...(options.context && { context: options.context }),
        };

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

        let responseContent = typeof data.response === 'string' ? data.response.trim() : '';
        if (!responseContent && data.structuredData?.rankings?.items?.length) {
          const r = data.structuredData.rankings;
          const label = r.direction === 'bottom' ? 'Bottom' : 'Top';
          const top = r.items.slice(0, 5);
          responseContent = `${label} markets:\n${top.map((i: { rank: number; name: string; score?: number; state?: string }) => `${i.rank}. ${i.name}${i.score != null ? ` (${i.score})` : ''}${i.state ? `, ${i.state}` : ''}`).join('\n')}`;
        }
        if (!responseContent && data.structuredData?.errorMessage) {
          responseContent = `Unable to retrieve rankings: ${data.structuredData.errorMessage}`;
        }
        if (!responseContent) responseContent = 'I received your message but had trouble showing a response. Please try again.';

        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: responseContent,
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

  const explainResult = useCallback(
    async (messageId: string) => {
      if (isExplaining) return;

      // Find the assistant message and preceding user message
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1 || messages[messageIndex].role !== 'assistant') {
        console.error('Message not found or not an assistant message');
        return;
      }

      const assistantMessage = messages[messageIndex];

      // Find the preceding user message
      let userQuery = '';
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userQuery = messages[i].content;
          break;
        }
      }

      if (!userQuery) {
        console.error('No user query found');
        return;
      }

      // Build result context from structured data
      let resultContext = assistantMessage.content;

      if (assistantMessage.data) {
        const data = assistantMessage.data;

        if (data.rankings?.items) {
          const items = data.rankings.items.slice(0, 10);
          resultContext += `\n\nRankings Data:\n${items.map((item: any) =>
            `${item.rank}. ${item.name} - Score: ${item.score?.toFixed(1) || 'N/A'}${item.appreciation ? `, 12M Appreciation: ${(item.appreciation * 100).toFixed(1)}%` : ''}`
          ).join('\n')}`;
        }

        if (data.comparison?.metrics) {
          resultContext += `\n\nComparison Data:\n${data.comparison.metrics.map((m: any) =>
            `${m.label}: Filtered=${m.filtered?.toFixed(1)}, Benchmark=${m.benchmark?.toFixed(1)}`
          ).join('\n')}`;
        }

        if (data.table?.rows) {
          const rows = data.table.rows.slice(0, 5);
          resultContext += `\n\nTable Data:\n${rows.map((r: any) =>
            `${r.name || r.geography_name}: Score=${r.score?.toFixed(1)}, Appreciation=${r.appreciation ? (r.appreciation * 100).toFixed(1) + '%' : 'N/A'}`
          ).join('\n')}`;
        }
      }

      setIsExplaining(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analytics/chat/${conversationIdRef.current}/explain`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userQuery,
              resultContext,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to generate explanation');
        }

        const explanationMessage: Message = {
          id: `explanation-${Date.now()}`,
          role: 'assistant',
          content: data.response || 'Here is the detailed explanation.',
          timestamp: new Date().toISOString(),
          isExplanation: true,
        };

        setMessages((prev) => [...prev, explanationMessage]);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to generate explanation';
        setError(errorMessage);
        options.onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setIsExplaining(false);
      }
    },
    [isExplaining, messages, options]
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
    isExplaining,
    error,
    sendMessage,
    explainResult,
    clearMessages,
    conversationId: conversationIdRef.current,
  };
}
