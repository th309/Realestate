'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Brain,
  RefreshCw,
  Loader2,
  AlertCircle,
  Save,
  BookOpen,
  ChevronLeft,
} from 'lucide-react';
import { useAiInsights } from '../hooks/useAiInsights';
import { useSavedInsights, type SavedInsight } from '../hooks/useSavedInsights';
import { useRecommendationExecutor } from '../hooks/useRecommendationExecutor';
import { parseRecommendationsFromMarkdown } from '../utils/parseRecommendations';
import type { ParsedRecommendation } from '../utils/parseRecommendations';
import { InsightCategoryCard } from './InsightCategoryCard';
import { InsightsChat } from './InsightsChat';
import { SavedInsightsList } from './SavedInsightsList';
import { ImplementPreview } from './ImplementPreview';

type AiProvider = 'deepseek' | 'claude';
type ViewMode = 'live' | 'saved-list' | 'saved-detail';

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

function parseCategorySections(
  markdown: string,
): Array<{ title: string; icon: string; content: string }> {
  const sections: Array<{ title: string; icon: string; content: string }> = [];

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    const headerIndex = markdown.indexOf(cat.header);
    if (headerIndex === -1) continue;

    const contentStart = headerIndex + cat.header.length;
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
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [activeInsight, setActiveInsight] = useState<SavedInsight | null>(null);
  const [recommendations, setRecommendations] = useState<ParsedRecommendation[]>([]);
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null);
  const [implementingRec, setImplementingRec] = useState<{
    rec: ParsedRecommendation;
    insightId: string;
  } | null>(null);
  const prevStreamingRef = useRef(false);

  const {
    content,
    isStreaming,
    error,
    chatHistory,
    generateInsights,
    sendFollowUp,
    reset,
  } = useAiInsights({ days, provider });

  const saved = useSavedInsights();
  const executor = useRecommendationExecutor();

  // Auto-parse recommendations when streaming completes
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && content) {
      setRecommendations(parseRecommendationsFromMarkdown(content));
      setSavedInsightId(null);
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, content]);

  const currentMarkdown = activeInsight
    ? activeInsight.markdown_content
    : content;
  const sections = parseCategorySections(currentMarkdown);
  const hasContent = currentMarkdown.length > 0;
  const isLiveMode = viewMode === 'live';

  const currentRecs =
    activeInsight && activeInsight.recommendations.length > 0
      ? activeInsight.recommendations
      : recommendations;

  // Handle save — returns the saved insight ID for implement flow
  const handleSave = useCallback(async () => {
    if (!content) return;
    const recs = parseRecommendationsFromMarkdown(content);
    const title = `Insights — ${new Date().toLocaleDateString()} (${provider})`;
    const result = await saved.saveInsight({
      title,
      markdown_content: content,
      recommendations: recs,
      provider,
      days_analyzed: days,
      chat_history: chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    if (result) {
      setRecommendations(result.recommendations);
      setSavedInsightId(result.id);
    }
  }, [content, provider, days, chatHistory, saved]);

  // Handle load saved insight
  const handleLoadInsight = useCallback(
    async (id: string) => {
      const insight = await saved.loadInsight(id);
      if (insight) {
        setActiveInsight(insight);
        setRecommendations(insight.recommendations);
        setViewMode('saved-detail');
      }
    },
    [saved],
  );

  // Back to live mode
  const handleBackToLive = useCallback(() => {
    setActiveInsight(null);
    setRecommendations(
      content ? parseRecommendationsFromMarkdown(content) : [],
    );
    setViewMode('live');
  }, [content]);

  // Get the current insight ID for API calls (saved detail or live-saved)
  const currentInsightId = activeInsight?.id ?? savedInsightId;

  // Implement a recommendation
  const handleImplement = useCallback(
    (rec: ParsedRecommendation) => {
      if (!currentInsightId) return;
      setImplementingRec({ rec, insightId: currentInsightId });
      executor.requestPlan(currentInsightId, rec.id);
    },
    [currentInsightId, executor],
  );

  // Dismiss a recommendation
  const handleDismiss = useCallback(
    async (rec: ParsedRecommendation) => {
      if (!currentInsightId) return;
      const success = await executor.dismissRecommendation(
        currentInsightId,
        rec.id,
      );
      if (success) {
        setRecommendations((prev) =>
          prev.map((r) =>
            r.id === rec.id ? { ...r, status: 'dismissed' } : r,
          ),
        );
      }
    },
    [currentInsightId, executor],
  );

  // Execute the plan
  const handleExecutePlan = useCallback(async () => {
    if (!implementingRec || !executor.currentPlan) return;
    const result = await executor.executePlan(
      implementingRec.insightId,
      implementingRec.rec.id,
      executor.currentPlan,
    );
    if (result?.success) {
      setRecommendations((prev) =>
        prev.map((r) =>
          r.id === implementingRec.rec.id
            ? { ...r, status: 'implemented' }
            : r,
        ),
      );
    }
  }, [implementingRec, executor]);

  // Can we show implement buttons? Only after the report has been saved
  const canImplement = !!currentInsightId;

  return (
    <div className="mt-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {viewMode !== 'live' && (
            <button
              onClick={handleBackToLive}
              className="p-1 rounded-full hover:bg-surface-container-high transition-colors mr-1"
            >
              <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
            </button>
          )}
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-medium text-on-surface">
            AI Marketing Insights
          </h3>
          {activeInsight && (
            <span className="text-sm text-on-surface-variant">
              — {activeInsight.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Saved reports toggle */}
          <button
            onClick={() =>
              setViewMode(viewMode === 'saved-list' ? 'live' : 'saved-list')
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
              viewMode === 'saved-list'
                ? 'border-primary text-primary bg-primary/10'
                : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Saved ({saved.insights.length})
          </button>

          {/* Provider toggle (live mode only) */}
          {isLiveMode && (
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value as AiProvider);
                reset();
                setRecommendations([]);
                setSavedInsightId(null);
              }}
              className="text-sm bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="claude">Claude</option>
            </select>
          )}

          {/* Generate / Save buttons (live mode) */}
          {isLiveMode && (
            <>
              {hasContent && !isStreaming && !savedInsightId && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-on-surface-variant border border-outline-variant rounded-full hover:bg-surface-container transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Report
                </button>
              )}
              {savedInsightId && (
                <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-600">
                  <Save className="w-4 h-4" />
                  Saved
                </span>
              )}
              <button
                onClick={() => {
                  setRecommendations([]);
                  setSavedInsightId(null);
                  generateInsights();
                }}
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
            </>
          )}
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

      {/* Saved insights list */}
      {viewMode === 'saved-list' && (
        <SavedInsightsList
          insights={saved.insights}
          loading={saved.loading}
          onLoad={handleLoadInsight}
          onDelete={saved.deleteInsight}
          onTogglePin={(id, pinned) => saved.updateInsight(id, { is_pinned: pinned })}
        />
      )}

      {/* Live / Saved detail content */}
      {viewMode !== 'saved-list' && (
        <>
          {/* Streaming indicator (before first category appears) */}
          {isLiveMode && isStreaming && !hasContent && (
            <div className="flex items-center gap-3 p-6 bg-surface-container rounded-xl border border-outline-variant">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-on-surface-variant">
                Gathering platform data and generating insights...
              </span>
            </div>
          )}

          {/* Empty state */}
          {isLiveMode && !isStreaming && !hasContent && !error && (
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

          {/* Save prompt — shown in live mode after streaming with no save yet */}
          {isLiveMode &&
            !isStreaming &&
            hasContent &&
            !savedInsightId &&
            currentRecs.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <Save className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-on-surface-variant flex-1">
                  Save this report to unlock Implement and Dismiss actions on
                  each recommendation.
                </span>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                >
                  Save Report
                </button>
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
                  recommendations={currentRecs}
                  onImplement={canImplement ? handleImplement : undefined}
                  onDismiss={canImplement ? handleDismiss : undefined}
                  implementingRecId={implementingRec?.rec.id ?? null}
                />
              ))}
            </div>
          )}

          {/* Streaming partial content (before parseable) */}
          {isLiveMode && isStreaming && hasContent && sections.length === 0 && (
            <div className="bg-surface-container rounded-xl border border-outline-variant p-4">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-on-surface-variant">
                  Generating...
                </span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-on-surface-variant whitespace-pre-wrap">
                {content}
              </div>
            </div>
          )}

          {/* Chat interface (live mode, after generation) */}
          {isLiveMode && hasContent && !isStreaming && (
            <InsightsChat
              chatHistory={chatHistory}
              onSendMessage={sendFollowUp}
              isStreaming={isStreaming}
            />
          )}
        </>
      )}

      {/* Implement Preview Dialog */}
      {executor.currentPlan && implementingRec && (
        <ImplementPreview
          plan={executor.currentPlan}
          recTitle={implementingRec.rec.title}
          onExecute={handleExecutePlan}
          onClose={() => {
            executor.clearPlan();
            setImplementingRec(null);
          }}
          executing={executor.executing}
          executionResult={executor.executionResult}
        />
      )}
    </div>
  );
}
