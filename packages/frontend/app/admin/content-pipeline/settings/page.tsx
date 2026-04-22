"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSettings,
  pausePipeline,
  resumePipeline,
  updateSettings,
} from "../lib/content-pipeline-api";

type Strictness = "relaxed" | "balanced" | "strict";

interface FormatDefault {
  format: string;
  display_name?: string;
  default_approval_mode?: string;
  default_tts_voice_id?: string | null;
  default_platforms?: string[];
}

interface SettingsPayload {
  strictness: Strictness;
  paused: boolean;
  formatDefaults: FormatDefault[];
}

const SETTINGS_QUERY_KEY = ["content-pipeline-settings"] as const;
const STRICTNESS_OPTIONS: Strictness[] = ["relaxed", "balanced", "strict"];

/**
 * Admin page: Content-Pipeline Settings.
 * Exposes gate strictness, per-format defaults (read-only in P1), and
 * a pause/resume toggle that short-circuits new runs in the orchestrator.
 */
export default function SettingsPage() {
  const qc = useQueryClient();

  const { data } = useQuery<SettingsPayload>({
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

  if (!data) {
    return <div className="p-8 text-outline">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-on-surface">Settings</h1>

      <section className="rounded-xl bg-surface-container-low p-6 shadow-sm">
        <h2 className="font-semibold mb-2 text-on-surface">Gate Strictness</h2>
        <p className="text-xs text-outline mb-4">
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

      <section className="rounded-xl bg-surface-container-low p-6 shadow-sm">
        <h2 className="font-semibold mb-4 text-on-surface">Format Defaults</h2>
        {data.formatDefaults.length === 0 ? (
          <p className="text-sm text-outline">
            No format templates configured yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-outline">
                <th className="py-2 font-medium">Format</th>
                <th className="py-2 font-medium">Approval mode</th>
                <th className="py-2 font-medium">Voice</th>
                <th className="py-2 font-medium">Platforms</th>
              </tr>
            </thead>
            <tbody>
              {data.formatDefaults.map((f) => (
                <tr key={f.format} className="border-t border-outline-variant">
                  <td className="py-2 text-on-surface">
                    {f.display_name ?? f.format}
                  </td>
                  <td className="py-2 text-on-surface">
                    {f.default_approval_mode ?? "--"}
                  </td>
                  <td className="py-2 text-on-surface">
                    {f.default_tts_voice_id ?? "(long-form)"}
                  </td>
                  <td className="py-2 text-on-surface">
                    {f.default_platforms?.join(", ") ?? "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl border border-error bg-error/5 p-6">
        <h2 className="font-semibold mb-3 text-on-surface">
          Pause all automation
        </h2>
        <p className="text-sm text-outline mb-4">
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
