'use client';

import { useState, useCallback, useRef } from 'react';
import { fetchAPIRaw } from '@/lib/data';

type AiProvider = 'deepseek' | 'claude';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UseAiInsightsOptions {
  days: number;
  provider: AiProvider;
}

interface UseAiInsightsReturn {
  /** Accumulated markdown from the current stream */
  content: string;
  /** Whether the stream is actively generating */
  isStreaming: boolean;
  /** Error message if stream failed */
  error: string | null;
  /** Chat conversation history */
  chatHistory: ChatMessage[];
  /** Generate initial insights report */
  generateInsights: () => Promise<void>;
  /** Send a follow-up chat message */
  sendFollowUp: (message: string) => Promise<void>;
  /** Clear chat history and content */
  reset: () => void;
}

export function useAiInsights({
  days,
  provider,
}: UseAiInsightsOptions): UseAiInsightsReturn {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const streamFromEndpoint = useCallback(
    async (params: Record<string, string>, appendToChat: boolean) => {
      // Abort any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const abortController = new AbortController();
      abortRef.current = abortController;

      setIsStreaming(true);
      setError(null);

      if (!appendToChat) {
        setContent('');
      }

      let accumulated = '';

      try {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetchAPIRaw(
          `/api/admin/analytics/ai-insights?${queryString}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

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
              if (parsed.type === 'text' && parsed.content) {
                accumulated += parsed.content;
                if (appendToChat) {
                  // Update the last assistant message in chat history
                  setChatHistory((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: accumulated,
                      };
                    }
                    return updated;
                  });
                } else {
                  setContent(accumulated);
                }
              } else if (parsed.type === 'error') {
                setError(parsed.content || 'Stream error');
              }
            } catch {
              // Skip malformed JSON lines (e.g. partial chunks)
            }
          }
        }

        // If initial analysis, store as first assistant message
        if (!appendToChat && accumulated) {
          setContent(accumulated);
          setChatHistory([{ role: 'assistant', content: accumulated }]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to stream insights');
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const generateInsights = useCallback(async () => {
    setChatHistory([]);
    await streamFromEndpoint(
      { days: String(days), provider },
      false,
    );
  }, [days, provider, streamFromEndpoint]);

  const sendFollowUp = useCallback(
    async (message: string) => {
      // Add user message and placeholder assistant message
      setChatHistory((prev) => [
        ...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: '' },
      ]);

      const historyForApi = chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamFromEndpoint(
        {
          days: String(days),
          provider,
          prompt: message,
          history: JSON.stringify(historyForApi),
        },
        true,
      );
    },
    [days, provider, chatHistory, streamFromEndpoint],
  );

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setContent('');
    setChatHistory([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    content,
    isStreaming,
    error,
    chatHistory,
    generateInsights,
    sendFollowUp,
    reset,
  };
}
