"use client";

import { useEffect, useState } from "react";
import { MCP_TABS, DEFAULT_MCP_TAB, type McpTabId } from "./mcp-docs-data";
import { SetupTab } from "./SetupTab";
import { ToolsReferenceTab } from "./ToolsReferenceTab";
import { ExamplesTab } from "./ExamplesTab";
import { McpTroubleshootingTab } from "./McpTroubleshootingTab";

/* ─── Tab content router ─── */

function TabContent({ activeTab }: { activeTab: McpTabId }) {
  switch (activeTab) {
    case "setup":
      return <SetupTab />;
    case "tools":
      return <ToolsReferenceTab />;
    case "examples":
      return <ExamplesTab />;
    case "troubleshooting":
      return <McpTroubleshootingTab />;
  }
}

/* ─── McpDocsPageClient ─── */

export function McpDocsPageClient() {
  const [activeTab, setActiveTab] = useState<McpTabId>(DEFAULT_MCP_TAB);

  useEffect(() => {
    const hashValue = window.location.hash.replace("#", "") as McpTabId;
    const isValidTab = MCP_TABS.some((t) => t.id === hashValue);
    if (isValidTab) setActiveTab(hashValue);
  }, []);

  useEffect(() => {
    function handleHashChange() {
      const hashValue = window.location.hash.replace("#", "") as McpTabId;
      const isValidTab = MCP_TABS.some((t) => t.id === hashValue);
      setActiveTab(isValidTab ? hashValue : DEFAULT_MCP_TAB);
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function handleTabChange(tabId: McpTabId) {
    setActiveTab(tabId);
    window.history.pushState(null, "", `#${tabId}`);
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6">
        {/* Page header */}
        <header className="pt-10 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-on-surface tracking-tight">
              MCP Integration
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary">
              44 tools
            </span>
          </div>
          <p className="text-lg text-on-surface-variant">
            Connect PropertyIQ to your AI assistant and get real estate market
            intelligence in natural language.
          </p>
        </header>

        {/* Sticky tab bar */}
        <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant -mx-6 px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {MCP_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <main className="py-10">
          <TabContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}
