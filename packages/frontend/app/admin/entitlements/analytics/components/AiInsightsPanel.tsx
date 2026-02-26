"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Brain, Loader2, AlertCircle, Save } from "lucide-react";
import { useAiInsights } from "../hooks/useAiInsights";
import { useSavedInsights, type SavedInsight } from "../hooks/useSavedInsights";
import { fetchAPIRaw } from "@/lib/data";
import { parseRecommendationsFromMarkdown } from "../utils/parseRecommendations";
import { parseCategorySections } from "../utils/insightCategories";
import type { ParsedRecommendation } from "../utils/parseRecommendations";
import { InsightCategoryCard } from "./InsightCategoryCard";
import { InsightsChat } from "./InsightsChat";
import { SavedInsightsList } from "./SavedInsightsList";
import { buildImplementPrompt } from "../utils/buildImplementPrompt";
import { InsightsPanelToolbar } from "./InsightsPanelToolbar";

type AiProvider = "deepseek" | "claude";
type ViewMode = "live" | "saved-list" | "saved-detail";

export function AiInsightsPanel({ days }: { days: number }) {
  const [provider, setProvider] = useState<AiProvider>("deepseek");
  const [viewMode, setViewMode] = useState<ViewMode>("live");
  const [activeInsight, setActiveInsight] = useState<SavedInsight | null>(null);
  const [recommendations, setRecommendations] = useState<
    ParsedRecommendation[]
  >([]);
  const [savedInsightId, setSavedInsightId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  const isLiveMode = viewMode === "live";
  const currentRecs = activeInsight?.recommendations?.length
    ? activeInsight.recommendations
    : recommendations;
  const currentInsightId = activeInsight?.id ?? savedInsightId;
  const displayError = error || saveError;

  const handleSave = useCallback(async () => {
    if (!content || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
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
      setRecommendations(result.recommendations);
      setSavedInsightId(result.id);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save report.",
      );
    } finally {
      setSaving(false);
    }
  }, [content, provider, days, chatHistory, saved, saving]);

  const handleLoadInsight = useCallback(
    async (id: string) => {
      const insight = await saved.loadInsight(id);
      if (insight) {
        setActiveInsight(insight);
        setRecommendations(insight.recommendations);
        setViewMode("saved-detail");
      }
    },
    [saved],
  );

  const handleBackToLive = useCallback(() => {
    setActiveInsight(null);
    setRecommendations(
      content ? parseRecommendationsFromMarkdown(content) : [],
    );
    setViewMode("live");
  }, [content]);

  const handleProviderChange = useCallback(
    (v: string) => {
      setProvider(v as AiProvider);
      reset();
      setRecommendations([]);
      setSavedInsightId(null);
    },
    [reset],
  );

  const handleGenerate = useCallback(() => {
    setRecommendations([]);
    setSavedInsightId(null);
    setSaveError(null);
    generateInsights();
  }, [generateInsights]);

  const handleCopyPrompt = useCallback(
    async (rec: ParsedRecommendation) => {
      const prompt = buildImplementPrompt(rec, currentMarkdown);
      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        // Silent fail — button shows "Copied!" via RecommendationItem local state
      }
    },
    [currentMarkdown],
  );

  const handleDismiss = useCallback(
    async (rec: ParsedRecommendation) => {
      if (!currentInsightId) return;
      try {
        const res = await fetchAPIRaw(
          `/api/admin/analytics/insights/${currentInsightId}/recommendations/${rec.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "dismissed" }),
          },
        );
        if (res.ok) {
          setRecommendations((prev) =>
            prev.map((r) =>
              r.id === rec.id ? { ...r, status: "dismissed" } : r,
            ),
          );
        }
      } catch {
        // Silent fail — user can retry
      }
    },
    [currentInsightId],
  );

  return (
    <div className="mt-8 space-y-4">
      <InsightsPanelToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        activeInsightTitle={activeInsight?.title ?? null}
        onBackToLive={handleBackToLive}
        savedCount={saved.insights.length}
        isLiveMode={isLiveMode}
        provider={provider}
        onProviderChange={handleProviderChange}
        hasContent={hasContent}
        isStreaming={isStreaming}
        savedInsightId={savedInsightId}
        saving={saving}
        onSave={handleSave}
        onGenerate={handleGenerate}
      />

      {displayError && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{displayError}</span>
          {error && (
            <button
              onClick={generateInsights}
              className="ml-auto text-sm font-medium underline"
            >
              Retry
            </button>
          )}
          {saveError && (
            <button
              onClick={() => setSaveError(null)}
              className="ml-auto text-sm font-medium underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {viewMode === "saved-list" && (
        <SavedInsightsList
          insights={saved.insights}
          loading={saved.loading}
          onLoad={handleLoadInsight}
          onDelete={saved.deleteInsight}
          onTogglePin={(id, pinned) =>
            saved.updateInsight(id, { is_pinned: pinned })
          }
        />
      )}

      {viewMode !== "saved-list" && (
        <>
          {isLiveMode && isStreaming && !hasContent && (
            <div className="flex items-center gap-3 p-6 bg-surface-container rounded-xl border border-outline-variant">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-on-surface-variant">
                Gathering platform data and generating insights...
              </span>
            </div>
          )}

          {isLiveMode && !isStreaming && !hasContent && !error && (
            <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant">
              <Brain className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-3" />
              <p className="text-on-surface-variant">
                Click &quot;Generate Insights&quot; to analyze your platform
                data
              </p>
              <p className="text-sm text-on-surface-variant/60 mt-1">
                The AI will review paywall events, revenue, trials, and feature
                usage to create your marketing playbook.
              </p>
            </div>
          )}

          {isLiveMode &&
            !isStreaming &&
            hasContent &&
            !savedInsightId &&
            currentRecs.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <Save className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-on-surface-variant flex-1">
                  Save this report to unlock actions on each recommendation.
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save Report"}
                </button>
              </div>
            )}

          {sections.length > 0 && (
            <div className="space-y-3">
              {sections.map((section) => (
                <InsightCategoryCard
                  key={section.title}
                  icon={section.icon}
                  title={section.title}
                  content={section.content}
                  recommendations={currentRecs}
                  onCopyPrompt={handleCopyPrompt}
                  onDismiss={currentInsightId ? handleDismiss : undefined}
                />
              ))}
            </div>
          )}

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

          {isLiveMode && hasContent && !isStreaming && (
            <InsightsChat
              chatHistory={chatHistory}
              onSendMessage={sendFollowUp}
              isStreaming={isStreaming}
            />
          )}
        </>
      )}
    </div>
  );
}
