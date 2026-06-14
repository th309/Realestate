/**
 * TopicSelector
 *
 * First step of the research brief flow. Presents contextual topic
 * suggestion chips and a free-text input for custom research questions.
 * Follows M3 card + Filter Chip patterns.
 */

"use client";

import React, { useState } from "react";
import { Search, Sparkles, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Suggested research topics
// ---------------------------------------------------------------------------

const SUGGESTED_TOPICS = [
  {
    label: "Best markets for first-time buyers",
    description: "Affordable metros with strong fundamentals",
  },
  {
    label: "Highest rental yield metros",
    description: "Top cash flow markets for investors",
  },
  {
    label: "Markets with fastest appreciation",
    description: "Where home values are rising quickest",
  },
  {
    label: "Affordable metros with strong job growth",
    description: "Value markets powered by employment",
  },
  {
    label: "Best markets for house flipping",
    description: "High margin, quick turnaround opportunities",
  },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TopicSelectorProps {
  onSubmit: (topic: string) => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopicSelector({
  onSubmit,
  loading = false,
}: TopicSelectorProps) {
  const [customTopic, setCustomTopic] = useState("");

  const handleChipClick = (label: string) => {
    if (loading) return;
    onSubmit(label);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = customTopic.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-medium text-on-surface tracking-tight">
          Custom Research Brief
        </h1>
        <p className="text-base text-on-surface-variant mt-2">
          Ask a real estate research question and get an AI-powered analysis
          backed by PropertyIQ data.
        </p>
      </div>

      {/* Suggestion chips (M3 Filter Chips) */}
      <div className="bg-surface-container-low rounded-xl p-5 shadow-sm mb-6">
        <p className="text-sm font-medium text-on-surface-variant mb-3">
          Popular topics
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((topic) => (
            <button
              key={topic.label}
              type="button"
              disabled={loading}
              onClick={() => handleChipClick(topic.label)}
              className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                border border-outline bg-surface text-on-surface
                hover:bg-primary/8 hover:border-primary
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200 text-sm"
              title={topic.description}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>

      {/* Free-text input */}
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-on-surface-variant" />
          </div>
          <input
            type="text"
            value={customTopic}
            onChange={(event) => setCustomTopic(event.target.value)}
            placeholder="What do you want to research?"
            disabled={loading}
            className="w-full h-14 pl-12 pr-14 rounded-full
              bg-surface-container-high text-on-surface
              placeholder:text-on-surface-variant/60
              border-none outline-none
              focus:ring-2 focus:ring-primary
              disabled:opacity-50
              text-base"
          />
          <button
            type="submit"
            disabled={!customTopic.trim() || loading}
            className="absolute inset-y-2 right-2 w-10 h-10 rounded-full
              bg-primary text-on-primary
              flex items-center justify-center
              hover:bg-primary/90
              disabled:bg-on-surface/12 disabled:text-on-surface/38
              transition-colors duration-200"
            aria-label="Submit research question"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </form>

      {loading && (
        <p className="text-sm text-on-surface-variant text-center mt-4 animate-pulse">
          Generating clarifying questions...
        </p>
      )}
    </div>
  );
}
