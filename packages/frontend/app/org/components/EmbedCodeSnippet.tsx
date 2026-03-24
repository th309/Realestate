"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface EmbedCodeSnippetProps {
  token: string;
  baseUrl: string;
}

type SnippetTab = "score" | "metric" | "map";

const TAB_LABELS: Record<SnippetTab, string> = {
  score: "Score Ring",
  metric: "Metric Card",
  map: "Interactive Map",
};

function buildSnippet(tab: SnippetTab, baseUrl: string, token: string): string {
  switch (tab) {
    case "score":
      return `<iframe src="${baseUrl}/embed/score/metro/31080?token=${token}&scoreType=homeready" width="280" height="320" style="border:none;border-radius:16px" />`;
    case "metric":
      return `<iframe src="${baseUrl}/embed/metric-card/home_value/metro/31080?token=${token}" width="300" height="200" style="border:none;border-radius:16px" />`;
    case "map":
      return `<iframe src="${baseUrl}/embed/map/metro?token=${token}&metric=home_value" width="100%" height="400" style="border:none;border-radius:16px" />`;
  }
}

/**
 * Tabbed code snippet component showing copy-pasteable iframe HTML
 * for each embed widget type: Score Ring, Metric Card, Interactive Map.
 */
export function EmbedCodeSnippet({ token, baseUrl }: EmbedCodeSnippetProps) {
  const [activeTab, setActiveTab] = useState<SnippetTab>("score");
  const [copied, setCopied] = useState(false);

  const snippet = buildSnippet(activeTab, baseUrl, token);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in non-secure contexts — silent fallback
    }
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-container p-1">
        {(Object.keys(TAB_LABELS) as SnippetTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCopied(false);
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="relative">
        <pre className="rounded-xl bg-surface-container p-4 text-xs leading-relaxed text-on-surface overflow-x-auto">
          <code>{snippet}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Copy snippet"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Help note */}
      <p className="text-xs text-on-surface-variant">
        Replace <code className="font-mono text-primary">metro/31080</code> with
        your target geography.
      </p>
    </div>
  );
}
