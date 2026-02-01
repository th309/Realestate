'use client';

/**
 * Analytics Assistant Panel
 *
 * Core chat UI - can be used standalone or inside a modal.
 */

import React, { useRef, useEffect, useState } from 'react';
import { Send, Sparkles, Loader2, RotateCcw, Trophy, Medal, MessageCircle } from 'lucide-react';
import { useAnalyticsChat } from './hooks/useAnalyticsChat';
import { AnalyticsAssistantProps, Message, RankingsData } from './types';
import { ChartRenderer, DataTable, ComparisonCard } from './visuals';

const DEFAULT_PROMPTS = [
  'Show me the top 10 metros by score',
  'How does Texas compare to the national average?',
  'What markets are undervalued right now?',
  'Show me the correlation with 3-year returns',
];

/** Render rankings as a compact list */
function RankingsList({ data }: { data: RankingsData }) {
  const isTop = data.direction === 'top';
  
  return (
    <div className="mt-3">
      {data.title && (
        <div className="flex items-center gap-2 mb-2">
          {isTop ? (
            <Trophy className="w-4 h-4 text-yellow-500" />
          ) : (
            <Medal className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-xs font-medium text-on-surface-variant">
            {data.title}
          </span>
        </div>
      )}
      <div className="space-y-1">
        {data.items.map((item) => (
          <div
            key={item.rank}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-container/50"
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                isTop && item.rank <= 3
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {item.rank}
            </span>
            <span className="flex-1 text-sm text-on-surface truncate">
              {item.name}
              {item.state && (
                <span className="text-on-surface-variant ml-1">({item.state})</span>
              )}
            </span>
            {item.score !== undefined && (
              <span
                className={`text-sm font-medium ${
                  item.score >= 70
                    ? 'text-green-600 dark:text-green-400'
                    : item.score >= 40
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                }`}
              >
                {item.score.toFixed(1)}
              </span>
            )}
            {item.appreciation !== undefined && (
              <span
                className={`text-sm font-medium ${
                  item.appreciation > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {item.appreciation > 0 ? '+' : ''}
                {item.appreciation.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onExplain,
  isExplaining
}: {
  message: Message;
  onExplain?: (messageId: string) => void;
  isExplaining?: boolean;
}) {
  const isUser = message.role === 'user';
  const hasVisuals = message.data && (
    message.data.chart || message.data.table || message.data.comparison || message.data.rankings
  );
  const canExplain = !isUser && hasVisuals && !message.isError && !message.isExplanation;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'max-w-[85%] bg-primary text-on-primary rounded-br-md'
            : message.isError
              ? 'max-w-[85%] bg-error-container text-on-error-container rounded-bl-md'
              : message.isExplanation
                ? 'max-w-[95%] w-full bg-tertiary-container text-on-tertiary-container rounded-bl-md'
                : hasVisuals
                  ? 'max-w-[95%] w-full bg-surface-container-high text-on-surface rounded-bl-md'
                  : 'max-w-[85%] bg-surface-container-high text-on-surface rounded-bl-md'
        }`}
      >
        {message.isExplanation && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-current/10">
            <MessageCircle className="w-4 h-4 opacity-70" />
            <span className="text-xs font-medium opacity-70">Detailed Explanation</span>
          </div>
        )}

        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>

        {/* Render visuals if present */}
        {message.data?.chart && (
          <div className="mt-4 pt-3 border-t border-outline-variant/30">
            <ChartRenderer config={message.data.chart} />
          </div>
        )}

        {message.data?.table && (
          <div className="mt-4 pt-3 border-t border-outline-variant/30">
            <DataTable config={message.data.table} />
          </div>
        )}

        {message.data?.comparison && (
          <div className="mt-4 pt-3 border-t border-outline-variant/30">
            <ComparisonCard config={message.data.comparison} />
          </div>
        )}

        {message.data?.rankings && (
          <RankingsList data={message.data.rankings} />
        )}

        {/* Explain This button for assistant messages with data */}
        {canExplain && onExplain && (
          <div className="mt-3 pt-3 border-t border-outline-variant/30">
            <button
              onClick={() => onExplain(message.id)}
              disabled={isExplaining}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExplaining ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Generating explanation...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-3 h-3" />
                  <span>Explain This</span>
                </>
              )}
            </button>
          </div>
        )}

        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="mt-2 pt-2 border-t border-current/10 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 opacity-60" />
            <span className="text-xs opacity-60">
              Analyzed using {message.toolsUsed.length} data source
              {message.toolsUsed.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyticsAssistantPanel({
  context,
  starterPrompts = DEFAULT_PROMPTS,
  title = 'Analytics Assistant',
  subtitle = 'Ask questions about market data in plain English',
}: AnalyticsAssistantProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, isExplaining, sendMessage, explainResult, clearMessages } = useAnalyticsChat({
    context,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleStarterClick = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-on-surface">{title}</h2>
            <p className="text-xs text-on-surface-variant">{subtitle}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            title="Start over"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Context Badge (if scoped) */}
      {context?.geographyName && (
        <div className="px-5 py-2 bg-surface-container-low border-b border-outline-variant">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary-container text-on-secondary-container rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Focused on {context.geographyName}
          </span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-medium text-on-surface mb-2">
              What would you like to know?
            </h3>
            <p className="text-sm text-on-surface-variant mb-6 max-w-xs">
              I can analyze market data, compare regions, find top performers,
              and more.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleStarterClick(prompt)}
                  className="px-3 py-2 bg-surface-container rounded-full text-sm text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onExplain={explainResult}
                isExplaining={isExplaining}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-container-high rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            {isExplaining && (
              <div className="flex justify-start">
                <div className="bg-tertiary-container/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2 text-on-tertiary-container">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating detailed explanation...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-outline-variant">
        <div className="flex items-center gap-2 bg-surface-container rounded-2xl border border-outline-variant focus-within:border-primary transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about market data..."
            className="flex-1 px-4 py-3 bg-transparent text-on-surface placeholder:text-on-surface-variant focus:outline-none text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="m-1.5 p-2.5 rounded-xl bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs text-on-surface-variant mt-2">
          Powered by Claude AI
        </p>
      </form>
    </div>
  );
}
