"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  MCP_TABS,
  DEFAULT_MCP_TAB,
  type McpTabId,
} from "../../components/mcp-docs-data";
import { ToolsReferenceTab } from "../../components/ToolsReferenceTab";
import { ExamplesTab } from "../../components/ExamplesTab";
import { McpTroubleshootingTab } from "../../components/McpTroubleshootingTab";

function TabContent({ activeTab }: { activeTab: McpTabId }) {
  switch (activeTab) {
    case "tools":
      return <ToolsReferenceTab />;
    case "examples":
      return <ExamplesTab />;
    case "troubleshooting":
      return <McpTroubleshootingTab />;
  }
}

export function McpReferenceClient() {
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
        <header className="pt-10 pb-6">
          <Link
            href="/docs/mcp"
            className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to MCP Integration
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-on-surface tracking-tight">
              MCP Reference
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary">
              44 tools
            </span>
          </div>
          <p className="text-lg text-on-surface-variant">
            Full parameter docs, worked examples, and troubleshooting for the
            PropertyIQ MCP server.
          </p>
        </header>

        <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant -mx-6 px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {MCP_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
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

        <main className="py-10">
          <TabContent activeTab={activeTab} />
        </main>
      </div>
    </div>
  );
}
