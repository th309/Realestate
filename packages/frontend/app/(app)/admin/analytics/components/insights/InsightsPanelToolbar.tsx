"use client";

import {
  Brain,
  RefreshCw,
  Loader2,
  Save,
  BookOpen,
  ChevronLeft,
} from "lucide-react";

type ViewMode = "live" | "saved-list" | "saved-detail";

interface InsightsPanelToolbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeInsightTitle: string | null;
  onBackToLive: () => void;
  savedCount: number;
  isLiveMode: boolean;
  provider: string;
  onProviderChange: (provider: string) => void;
  hasContent: boolean;
  isStreaming: boolean;
  savedInsightId: string | null;
  saving: boolean;
  onSave: () => void;
  onGenerate: () => void;
}

export function InsightsPanelToolbar({
  viewMode,
  setViewMode,
  activeInsightTitle,
  onBackToLive,
  savedCount,
  isLiveMode,
  provider,
  onProviderChange,
  hasContent,
  isStreaming,
  savedInsightId,
  saving,
  onSave,
  onGenerate,
}: InsightsPanelToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {viewMode !== "live" && (
          <button
            onClick={onBackToLive}
            className="p-1 rounded-full hover:bg-surface-container-high transition-colors mr-1"
          >
            <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
          </button>
        )}
        <Brain className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-medium text-on-surface">
          AI Marketing Insights
        </h3>
        {activeInsightTitle && (
          <span className="text-sm text-on-surface-variant">
            — {activeInsightTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            setViewMode(viewMode === "saved-list" ? "live" : "saved-list")
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
            viewMode === "saved-list"
              ? "border-primary text-primary bg-primary/10"
              : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Saved ({savedCount})
        </button>

        {isLiveMode && (
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="text-sm bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-on-surface"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="claude">Claude</option>
          </select>
        )}

        {isLiveMode && (
          <>
            {hasContent && !isStreaming && !savedInsightId && (
              <button
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-on-surface-variant border border-outline-variant rounded-full hover:bg-surface-container disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save Report"}
              </button>
            )}
            {savedInsightId && (
              <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-green-600">
                <Save className="w-4 h-4" /> Saved
              </span>
            )}
            <button
              onClick={onGenerate}
              disabled={isStreaming}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />{" "}
                  {hasContent ? "Refresh Analysis" : "Generate Insights"}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
