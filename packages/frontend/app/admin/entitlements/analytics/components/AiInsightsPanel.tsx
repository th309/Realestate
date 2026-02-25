'use client';

import { useState } from 'react';
import { Brain, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useAiInsights } from '../hooks/useAiInsights';
import { InsightCategoryCard } from './InsightCategoryCard';
import { InsightsChat } from './InsightsChat';

type AiProvider = 'deepseek' | 'claude';

interface AiInsightsPanelProps {
  days: number;
}

const CATEGORIES = [
  { icon: '\u{1F534}', header: '## \u{1F534} Conversion Blockers', title: 'Conversion Blockers' },
  { icon: '\u26A1', header: '## \u26A1 Quick Wins', title: 'Quick Wins' },
  { icon: '\u{1F4C8}', header: '## \u{1F4C8} Growth Opportunities', title: 'Growth Opportunities' },
  { icon: '\u{1F50D}', header: '## \u{1F50D} Missing Tracking', title: 'Missing Tracking' },
  { icon: '\u{1F4CA}', header: '## \u{1F4CA} Retention Signals', title: 'Retention Signals' },
  { icon: '\u{1F4B0}', header: '## \u{1F4B0} Pricing & Packaging', title: 'Pricing & Packaging' },
  { icon: '\u{1F9EA}', header: '## \u{1F9EA} Trial Health', title: 'Trial Health' },
  { icon: '\u{1F4B8}', header: '## \u{1F4B8} Revenue Leaks', title: 'Revenue Leaks' },
  { icon: '\u{1F310}', header: '## \u{1F310} Acquisition Channels', title: 'Acquisition Channels' },
  { icon: '\u{1F3DB}\uFE0F', header: '## \u{1F3DB}\uFE0F Brand & Authority', title: 'Brand & Authority' },
  { icon: '\u{1F91D}', header: '## \u{1F91D} Monetization & Partnerships', title: 'Monetization & Partnerships' },
];

/**
 * Parse the streaming markdown into category sections.
 * Splits on category headers (## emoji Title).
 */
function parseCategorySections(
  markdown: string,
): Array<{ title: string; icon: string; content: string }> {
  const sections: Array<{ title: string; icon: string; content: string }> = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const headerIndex = markdown.indexOf(cat.header);
    if (headerIndex === -1) continue;

    const contentStart = headerIndex + cat.header.length;

    // Find where the next category starts
    let contentEnd = markdown.length;
    for (let j = i + 1; j < CATEGORIES.length; j++) {
      const nextIndex = markdown.indexOf(CATEGORIES[j].header, contentStart);
      if (nextIndex !== -1) {
        contentEnd = nextIndex;
        break;
      }
    }

    const content = markdown.slice(contentStart, contentEnd).trim();
    if (content) {
      sections.push({ title: cat.title, icon: cat.icon, content });
    }
  }

  return sections;
}

export function AiInsightsPanel({ days }: AiInsightsPanelProps) {
  const [provider, setProvider] = useState<AiProvider>('deepseek');
  const {
    content,
    isStreaming,
    error,
    chatHistory,
    generateInsights,
    sendFollowUp,
    reset,
  } = useAiInsights({ days, provider });

  const sections = parseCategorySections(content);
  const hasContent = content.length > 0;

  return (
    <div className="mt-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">
            AI Marketing Insights
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {/* Provider toggle */}
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as AiProvider);
              reset();
            }}
            className="text-sm bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="claude">Claude</option>
          </select>

          {/* Generate / Refresh */}
          <button
            onClick={generateInsights}
            disabled={isStreaming}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {hasContent ? 'Refresh Analysis' : 'Generate Insights'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button
            onClick={generateInsights}
            className="ml-auto text-sm font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Streaming indicator (before first category appears) */}
      {isStreaming && !hasContent && (
        <div className="flex items-center gap-3 p-6 bg-surface-container rounded-xl border border-outline-variant">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-on-surface-variant">
            Gathering platform data and generating insights...
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isStreaming && !hasContent && !error && (
        <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant">
          <Brain className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
          <p className="text-on-surface-variant">
            Click &quot;Generate Insights&quot; to analyze your platform data
          </p>
          <p className="text-sm text-on-surface-variant/60 mt-1">
            The AI will review paywall events, revenue, trials, and feature
            usage to create your marketing playbook.
          </p>
        </div>
      )}

      {/* Insight category cards */}
      {sections.length > 0 && (
        <div className="space-y-3">
          {sections.map((section) => (
            <InsightCategoryCard
              key={section.title}
              icon={section.icon}
              title={section.title}
              content={section.content}
            />
          ))}
        </div>
      )}

      {/* Streaming partial content (before it is parseable into categories) */}
      {isStreaming && hasContent && sections.length === 0 && (
        <div className="bg-surface-container rounded-xl border border-outline-variant p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-on-surface-variant">Generating...</span>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-on-surface-variant whitespace-pre-wrap">
            {content}
          </div>
        </div>
      )}

      {/* Chat interface (shown after initial insights are generated) */}
      {hasContent && !isStreaming && (
        <InsightsChat
          chatHistory={chatHistory}
          onSendMessage={sendFollowUp}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}
