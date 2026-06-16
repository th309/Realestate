/**
 * AI Model Configuration Admin Page
 *
 * Allows admins to configure which AI models are used for each report
 * generation purpose (narrative writing, research, scoring, etc.).
 *
 * Material Design 3 compliant.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useAiModelConfigs,
  useProviderPresets,
  useUpdateAiModelConfig,
} from "@/lib/data/hooks";
import type { AiModelConfig } from "@/lib/data/fetchers/ai-models";
import { ModelConfigCard } from "./components/ModelConfigCard";

export default function AiModelConfigPage() {
  const configsQuery = useAiModelConfigs();
  const presetsQuery = useProviderPresets();
  const updateMutation = useUpdateAiModelConfig();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const configs = configsQuery.data ?? [];
  const presets = presetsQuery.data ?? {};
  const loading = configsQuery.isLoading || presetsQuery.isLoading;
  const error =
    configsQuery.isError || presetsQuery.isError
      ? "Failed to load AI model configurations."
      : null;

  const handleSave = async (
    purpose: string,
    update: Partial<AiModelConfig>,
  ): Promise<boolean> => {
    try {
      const result = await updateMutation.mutateAsync({ purpose, update });
      const ok = !!result;
      setToast({
        message: ok
          ? `${purpose} configuration saved.`
          : `Failed to save ${purpose} configuration.`,
        type: ok ? "success" : "error",
      });
      setTimeout(() => setToast(null), 4000);
      return ok;
    } catch (err) {
      console.error(`Error saving ${purpose} config:`, err);
      setToast({
        message: `Error saving ${purpose} configuration.`,
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-on-surface">
                AI Model Configuration
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Configure which AI models are used for each report generation
                purpose.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin/ai-models/evaluation"
                className="px-4 py-2 text-sm font-medium rounded-full bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 transition-colors duration-200"
              >
                Evaluation Lab →
              </Link>
              <button
                onClick={() => configsQuery.refetch()}
                disabled={configsQuery.isFetching}
                className="px-4 py-2 text-sm font-medium rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors duration-200"
              >
                {configsQuery.isFetching ? "Loading..." : "Refresh"}
              </button>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-tertiary-container text-on-tertiary-container">
                Admin Access
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-sm">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && configs.length === 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-surface-container-low rounded-xl shadow-sm p-6 animate-pulse"
              >
                <div className="h-5 w-40 bg-surface-container rounded mb-3" />
                <div className="h-4 w-24 bg-surface-container rounded mb-6" />
                <div className="space-y-4">
                  <div className="h-9 bg-surface-container rounded" />
                  <div className="h-9 bg-surface-container rounded" />
                  <div className="h-6 bg-surface-container rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && configs.length === 0 && !error && (
          <div className="text-center py-16">
            <p className="text-on-surface-variant text-sm">
              No AI model configurations loaded. Check the browser console for
              errors. If you see a 401, try refreshing the page — the session
              may not have been ready yet.
            </p>
            <button
              onClick={() => configsQuery.refetch()}
              className="mt-4 px-5 py-2 text-sm font-medium rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Config cards grid */}
        {configs.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {configs.map((config) => (
              <ModelConfigCard
                key={config.purpose}
                config={config}
                presets={presets}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50 transition-opacity duration-200 ${
            toast.type === "success"
              ? "bg-green-700 text-white"
              : "bg-red-700 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
