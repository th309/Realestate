/**
 * ShadowConfigFields
 *
 * Collapsible shadow A/B config for one purpose: enable toggle, shadow
 * provider/model selectors, and a sample-rate slider (0-100%). Populated
 * from the backend presets so model options stay in sync.
 */

"use client";

import type {
  ProviderPresets,
  ProviderModelOption,
} from "@/lib/data/fetchers/ai-models";

const PROVIDERS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google (Gemini)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
] as const;

interface ShadowConfigFieldsProps {
  presets: ProviderPresets;
  shadowProvider: string | null;
  shadowModel: string | null;
  shadowSampleRate: number;
  onChange: (patch: {
    shadowProvider?: string | null;
    shadowModel?: string | null;
    shadowSampleRate?: number;
  }) => void;
}

export function ShadowConfigFields({
  presets,
  shadowProvider,
  shadowModel,
  shadowSampleRate,
  onChange,
}: ShadowConfigFieldsProps) {
  const enabled = !!shadowProvider;
  const modelOptions: ProviderModelOption[] = shadowProvider
    ? (presets[shadowProvider]?.availableModels ?? [])
    : [];

  const toggle = (on: boolean) => {
    if (on) {
      const firstProvider = "deepseek";
      onChange({
        shadowProvider: firstProvider,
        shadowModel: presets[firstProvider]?.defaultModel ?? "",
        shadowSampleRate: shadowSampleRate || 0.1,
      });
    } else {
      onChange({
        shadowProvider: null,
        shadowModel: null,
        shadowSampleRate: 0,
      });
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-outline-variant bg-surface-container p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="accent-primary"
        />
        Shadow A/B (mirror traffic to a second model)
      </label>

      {enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Shadow Provider
            </label>
            <select
              value={shadowProvider ?? ""}
              onChange={(e) =>
                onChange({
                  shadowProvider: e.target.value,
                  shadowModel: presets[e.target.value]?.defaultModel ?? "",
                })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Shadow Model
            </label>
            {modelOptions.length > 0 ? (
              <select
                value={
                  modelOptions.some((m) => m.id === shadowModel)
                    ? (shadowModel ?? "")
                    : ""
                }
                onChange={(e) => onChange({ shadowModel: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.context ? ` (${m.context})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={shadowModel ?? ""}
                onChange={(e) => onChange({ shadowModel: e.target.value })}
                placeholder="Enter model ID"
                className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Sample Rate: {Math.round(shadowSampleRate * 100)}% of calls
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={shadowSampleRate}
              onChange={(e) =>
                onChange({ shadowSampleRate: parseFloat(e.target.value) })
              }
              className="w-full accent-primary"
            />
          </div>
        </div>
      )}
    </div>
  );
}
