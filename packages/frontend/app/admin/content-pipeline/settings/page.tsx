"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSettings,
  pausePipeline,
  resumePipeline,
  updateSettings,
} from "../lib/content-pipeline-api";
import { FormatDefaults } from "./format-defaults";
import type { FormatRowData } from "./format-row";

type Strictness = "relaxed" | "balanced" | "strict";

interface SettingsPayload {
  strictness: Strictness;
  paused: boolean;
  formatDefaults: FormatRowData[];
}

const SETTINGS_QUERY_KEY = ["content-pipeline-settings"] as const;
const STRICTNESS_OPTIONS: Strictness[] = ["relaxed", "balanced", "strict"];

/**
 * Admin: Content-Pipeline Settings.
 *   - Gate strictness (relaxed/balanced/strict)
 *   - Per-format defaults: enabled, approval mode, voice, platforms
 *     (delegated to <FormatDefaults>)
 *   - Pause/resume the whole pipeline
 */
export default function SettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<SettingsPayload>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
  });

  const strictnessMutation = useMutation({
    mutationFn: (strictness: Strictness) => updateSettings({ strictness }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
  });

  const togglePauseMutation = useMutation({
    mutationFn: (nextPaused: boolean) =>
      nextPaused ? pausePipeline() : resumePipeline(),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY }),
  });

  if (isLoading) {
    return <SettingsSkeleton />;
  }
  if (error || !data) {
    return (
      <div className="p-8">
        <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm">
          Couldn&apos;t load settings.{" "}
          <button
            type="button"
            onClick={() =>
              qc.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
            }
            className="underline font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold text-on-surface">Settings</h1>

      <section className="rounded-xl bg-surface-container-low p-6 shadow-sm">
        <h2 className="font-semibold mb-2 text-on-surface">Gate Strictness</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          Controls how harshly Gate A (data accuracy) and Gate B (brand voice)
          reject content. Relaxed lets more runs through for operator review;
          strict auto-rejects borderline cases.
        </p>
        <div className="flex gap-2">
          {STRICTNESS_OPTIONS.map((s) => {
            const isActive = data.strictness === s;
            return (
              <button
                key={s}
                type="button"
                disabled={strictnessMutation.isPending}
                onClick={() => strictnessMutation.mutate(s)}
                className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3 text-on-surface px-1">
          Format Defaults
        </h2>
        <p className="text-xs text-on-surface-variant mb-4 px-1">
          Click any format to expand its voice and platforms. Toggle the switch
          to enable / disable. Edits save automatically.
        </p>
        <FormatDefaults formats={data.formatDefaults} />
      </section>

      <section className="rounded-xl border border-error bg-error/5 p-6">
        <h2 className="font-semibold mb-3 text-on-surface">
          Pause all automation
        </h2>
        <p className="text-sm text-on-surface-variant mb-4">
          New runs will be rejected. Ongoing runs complete gracefully.
        </p>
        <button
          type="button"
          disabled={togglePauseMutation.isPending}
          onClick={() => togglePauseMutation.mutate(!data.paused)}
          className="bg-error text-on-error rounded-full px-6 py-3 font-semibold disabled:opacity-60"
        >
          {data.paused ? "Resume" : "Pause"}
        </button>
      </section>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="h-8 bg-surface-container-low rounded animate-pulse w-32" />
      <div className="h-32 bg-surface-container-low rounded-xl animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 bg-surface-container-low rounded-xl animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
