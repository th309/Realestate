/**
 * ModelConfigCard
 *
 * Displays and edits a single AI model configuration purpose.
 * Allows selecting provider, model, temperature, base URL (custom only),
 * and notes. Saves via PATCH to the backend.
 *
 * Material Design 3 compliant.
 */

"use client";

import { useState, useCallback } from "react";
import type {
  AiModelConfig,
  ProviderPresets,
} from "@/lib/data/fetchers/ai-models";
import { ShadowConfigFields } from "./ShadowConfigFields";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google (Gemini)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "custom", label: "Custom" },
] as const;

/** Human-readable description of what each purpose does in the pipeline. */
const PURPOSE_DESCRIPTIONS: Record<string, string> = {
  report_outline:
    "Pass 1 of report generation. Creates a short outline (~200 words) with title and subtitle to guide all sections. 1 call per report.",
  report_narrative:
    "Pass 2 of report generation. Writes each section's prose (executive verdict, market deep dive, scenarios, etc.). Runs 4-6 calls in parallel per report.",
  research_agent:
    "Custom research data gathering. When a user asks a free-form question, this agent uses tool calls to search data and scores. 1 call per research brief.",
  research_narrative:
    "Second step of custom research. Takes the structured data gathered by research_agent and writes it up as a readable prose narrative. 1 call per research brief.",
  conversation:
    "Report follow-up chat. Handles multi-turn conversations when users ask questions about their generated report. 1 call per chat message.",
  news_scout:
    "Fetches local news, economic indicators, and market signals for a geography. Results are cached 24 hours. 2 calls per report (local + national).",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelConfigCardProps {
  config: AiModelConfig;
  presets: ProviderPresets;
  onSave: (purpose: string, update: Partial<AiModelConfig>) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelConfigCard({
  config,
  presets,
  onSave,
}: ModelConfigCardProps) {
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [baseUrl, setBaseUrl] = useState(config.base_url || "");
  const [notes, setNotes] = useState(config.notes || "");
  const [shadowProvider, setShadowProvider] = useState<string | null>(
    config.shadow_provider,
  );
  const [shadowModel, setShadowModel] = useState<string | null>(
    config.shadow_model,
  );
  const [shadowSampleRate, setShadowSampleRate] = useState<number>(
    config.shadow_sample_rate ?? 0,
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  // Model options come from the backend preset for the selected provider —
  // single source of truth, no hardcoded lists.
  const modelOptions = presets[provider]?.availableModels ?? [];

  const isDirty =
    provider !== config.provider ||
    model !== config.model ||
    temperature !== config.temperature ||
    baseUrl !== (config.base_url || "") ||
    notes !== (config.notes || "") ||
    shadowProvider !== config.shadow_provider ||
    shadowModel !== config.shadow_model ||
    shadowSampleRate !== (config.shadow_sample_rate ?? 0);

  const handleProviderChange = useCallback(
    (newProvider: string) => {
      setProvider(newProvider);
      // Auto-fill default model when switching providers
      if (newProvider !== provider) {
        setModel(presets[newProvider]?.defaultModel ?? "");
      }
      // Clear base URL when switching away from custom
      if (newProvider !== "custom") {
        setBaseUrl("");
      }
      setSaveStatus("idle");
    },
    [provider, presets],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus("idle");

    const update: Partial<AiModelConfig> = {
      provider,
      model,
      temperature,
      base_url: provider === "custom" ? baseUrl || null : null,
      notes: notes || null,
      shadow_provider: shadowProvider,
      shadow_model: shadowModel,
      shadow_sample_rate: shadowSampleRate,
    };

    const success = await onSave(config.purpose, update);
    setSaveStatus(success ? "success" : "error");
    setSaving(false);

    if (success) {
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [
    provider,
    model,
    temperature,
    baseUrl,
    notes,
    shadowProvider,
    shadowModel,
    shadowSampleRate,
    config.purpose,
    onSave,
  ]);

  const formattedDate = config.updated_at
    ? new Date(config.updated_at).toLocaleString()
    : "Never";

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-on-surface">
            {config.label}
          </h3>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Purpose:{" "}
            <code className="text-xs bg-surface-container px-1.5 py-0.5 rounded">
              {config.purpose}
            </code>
          </p>
          {PURPOSE_DESCRIPTIONS[config.purpose] && (
            <p className="text-xs text-on-surface-variant/70 mt-1.5 leading-relaxed">
              {PURPOSE_DESCRIPTIONS[config.purpose]}
            </p>
          )}
        </div>
        <span
          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
            config.is_active
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}
        >
          {config.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Provider */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1.5">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1.5">
            Model
          </label>
          {modelOptions.length > 0 ? (
            <>
              <select
                value={
                  modelOptions.some((m) => m.id === model)
                    ? model
                    : "__custom__"
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val !== "__custom__") {
                    setModel(val);
                  } else {
                    setModel("");
                  }
                  setSaveStatus("idle");
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.context ? ` (${m.context})` : ""}
                  </option>
                ))}
                <option value="__custom__">Custom model ID...</option>
              </select>
              {!modelOptions.some((m) => m.id === model) && (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setSaveStatus("idle");
                  }}
                  placeholder="Enter custom model ID"
                  className="w-full mt-2 px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setSaveStatus("idle");
              }}
              placeholder="Enter model ID"
              className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1.5">
            Temperature: {temperature.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={temperature}
            onChange={(e) => {
              setTemperature(parseFloat(e.target.value));
              setSaveStatus("idle");
            }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-on-surface-variant mt-1">
            <span>0.0 (Precise)</span>
            <span>1.0 (Balanced)</span>
            <span>2.0 (Creative)</span>
          </div>
        </div>

        {/* Base URL (custom provider only) */}
        {provider === "custom" && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              Base URL
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setSaveStatus("idle");
              }}
              placeholder="https://api.example.com/v1"
              className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-1.5">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSaveStatus("idle");
            }}
            rows={2}
            placeholder="Optional notes about this configuration..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        {/* Shadow A/B */}
        <ShadowConfigFields
          presets={presets}
          shadowProvider={shadowProvider}
          shadowModel={shadowModel}
          shadowSampleRate={shadowSampleRate}
          onChange={(patch) => {
            if (patch.shadowProvider !== undefined)
              setShadowProvider(patch.shadowProvider);
            if (patch.shadowModel !== undefined)
              setShadowModel(patch.shadowModel);
            if (patch.shadowSampleRate !== undefined)
              setShadowSampleRate(patch.shadowSampleRate);
            setSaveStatus("idle");
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-outline-variant">
        <p className="text-xs text-on-surface-variant">
          Last updated: {formattedDate}
        </p>
        <div className="flex items-center gap-3">
          {saveStatus === "success" && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              Save failed
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-5 py-2 text-sm font-medium rounded-full bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
