/**
 * ShadowControls
 *
 * Top-bar controls for the AI Shadow Mode review page.
 * Exposes the global enable toggle and the daily USD ceiling input,
 * both backed by `useUpdateShadowConfig()`.
 *
 * Material Design 3 compliant.
 */

"use client";

import { useState } from "react";
import {
  useShadowConfig,
  useUpdateShadowConfig,
} from "@/lib/data/fetchers/ai-shadow";

export function ShadowControls() {
  const { data: config, isLoading } = useShadowConfig();
  const update = useUpdateShadowConfig();
  const [ceilingDraft, setCeilingDraft] = useState<string>("");

  if (isLoading || !config) {
    return <div className="text-sm text-on-surface-variant">Loading…</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-xl bg-surface-container-low p-4 shadow-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update.mutate({ enabled: e.target.checked })}
          className="h-5 w-5 rounded border-outline"
        />
        <span className="font-medium">Shadow mode enabled</span>
      </label>

      <div className="flex items-center gap-2">
        <span className="text-sm text-on-surface-variant">
          Daily ceiling ($USD):
        </span>
        <input
          type="number"
          step="0.5"
          min="0"
          defaultValue={config.daily_usd_ceiling}
          onChange={(e) => setCeilingDraft(e.target.value)}
          onBlur={() => {
            const n = Number(ceilingDraft);
            if (!Number.isNaN(n) && n !== config.daily_usd_ceiling) {
              update.mutate({ daily_usd_ceiling: n });
            }
          }}
          className="w-24 rounded-lg border border-outline px-2 py-1"
        />
      </div>

      {config.updated_at && (
        <span className="ml-auto text-xs text-on-surface-variant">
          Updated {new Date(config.updated_at).toLocaleString()}
        </span>
      )}
    </div>
  );
}
