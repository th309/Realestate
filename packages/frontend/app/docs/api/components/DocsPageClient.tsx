"use client";

import { useEffect, useState } from "react";
import {
  TABS,
  DEFAULT_TAB,
  type TabId,
  SCOPES,
  ERROR_CODES,
} from "./api-docs-data";
import { EndpointsReference } from "./EndpointsReference";
import { GettingStartedTab } from "./GettingStartedTab";
import { UseCasesTab } from "./UseCasesTab";
import { TroubleshootingTab } from "./TroubleshootingTab";

/* -------------------------------------------------------------------------- */
/* Tab content: API Reference                                                  */
/* -------------------------------------------------------------------------- */

function ApiReferenceTab() {
  return (
    <div className="space-y-12">
      {/* Authentication & Scopes */}
      <section>
        <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-4">
          Authentication &amp; Scopes
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          All requests require a Bearer token in the{" "}
          <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded">
            Authorization
          </code>{" "}
          header. API keys are scoped to your organization and can be restricted
          to specific endpoint groups.
        </p>
        <h3 className="text-base font-medium text-on-surface mt-6 mb-3">
          Available Scopes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                <th className="py-2 pr-4 font-medium">Scope</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {SCOPES.map((s) => (
                <tr
                  key={s.scope}
                  className="border-b border-outline-variant/50"
                >
                  <td className="py-2 pr-4 font-mono text-xs text-primary">
                    {s.scope}
                  </td>
                  <td className="py-2 text-on-surface-variant">
                    {s.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Endpoints */}
      <section>
        <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-4">
          Endpoints Reference
        </h2>
        <EndpointsReference />
      </section>

      {/* Error Codes */}
      <section>
        <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-4">
          Error Codes
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-on-surface-variant">
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 font-medium">HTTP Status</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {ERROR_CODES.map((e) => (
                <tr key={e.code} className="border-b border-outline-variant/50">
                  <td className="py-2 pr-4 font-mono text-xs text-error">
                    {e.code}
                  </td>
                  <td className="py-2 pr-4 text-on-surface-variant">
                    {e.status}
                  </td>
                  <td className="py-2 text-on-surface-variant">
                    {e.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tab content router                                                           */
/* -------------------------------------------------------------------------- */

function TabContent({ activeTab }: { activeTab: TabId }) {
  switch (activeTab) {
    case "getting-started":
      return <GettingStartedTab />;
    case "use-cases":
      return <UseCasesTab />;
    case "reference":
      return <ApiReferenceTab />;
    case "troubleshooting":
      return <TroubleshootingTab />;
  }
}

/* -------------------------------------------------------------------------- */
/* DocsPageClient — hash-driven tab state                                      */
/* -------------------------------------------------------------------------- */

export function DocsPageClient() {
  const [activeTab, setActiveTab] = useState<TabId>(DEFAULT_TAB);

  // Read hash on mount to restore tab from URL
  useEffect(() => {
    const hashValue = window.location.hash.replace("#", "") as TabId;
    const isValidTab = TABS.some((t) => t.id === hashValue);
    if (isValidTab) {
      setActiveTab(hashValue);
    }
  }, []);

  // Listen for browser back/forward hash navigation
  useEffect(() => {
    function handleHashChange() {
      const hashValue = window.location.hash.replace("#", "") as TabId;
      const isValidTab = TABS.some((t) => t.id === hashValue);
      setActiveTab(isValidTab ? hashValue : DEFAULT_TAB);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function handleTabChange(tabId: TabId) {
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
              PropertyIQ API Documentation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary">
              v1
            </span>
          </div>
          <p className="text-lg text-on-surface-variant">
            Access real estate analytics data programmatically.
          </p>
        </header>

        {/* Sticky tab bar */}
        <div className="sticky top-0 z-10 bg-surface border-b border-outline-variant -mx-6 px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {TABS.map((tab) => (
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
