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
import type { AiModelConfig } from "@/lib/data/fetchers/ai-models";

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

/** Available models per provider — shown as dropdown options in admin UI. */
const PROVIDER_MODELS: Record<
  string,
  Array<{ id: string; label: string; context?: string }>
> = {
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat (V3)", context: "64K" },
    {
      id: "deepseek-reasoner",
      label: "DeepSeek Reasoner (R1)",
      context: "64K",
    },
  ],
  anthropic: [
    { id: "claude-opus-4-20250514", label: "Claude Opus 4", context: "200K" },
    {
      id: "claude-sonnet-4-20250514",
      label: "Claude Sonnet 4",
      context: "200K",
    },
    { id: "claude-haiku-4-20250414", label: "Claude Haiku 4", context: "200K" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o", context: "128K" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", context: "128K" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo", context: "128K" },
    { id: "o3", label: "o3 (Reasoning)", context: "200K" },
    { id: "o3-mini", label: "o3-mini (Reasoning)", context: "200K" },
    { id: "o4-mini", label: "o4-mini (Reasoning)", context: "200K" },
  ],
  google: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", context: "1M" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", context: "1M" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", context: "1M" },
  ],
  openrouter: [
    { id: "anthropic/claude-opus-4", label: "Claude Opus 4", context: "200K" },
    {
      id: "anthropic/claude-sonnet-4",
      label: "Claude Sonnet 4",
      context: "200K",
    },
    { id: "openai/gpt-4o", label: "GPT-4o", context: "128K" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", context: "1M" },
    { id: "deepseek/deepseek-chat", label: "DeepSeek Chat", context: "64K" },
    {
      id: "deepseek/deepseek-reasoner",
      label: "DeepSeek Reasoner",
      context: "64K",
    },
  ],
  custom: [],
};

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  deepseek: "deepseek-chat",
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.5-flash",
  openrouter: "anthropic/claude-sonnet-4",
  custom: "",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ModelConfigCardProps {
  config: AiModelConfig;
  onSave: (purpose: string, update: Partial<AiModelConfig>) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModelConfigCard({ config, onSave }: ModelConfigCardProps) {
  const [provider, setProvider] = useState(config.provider);
  const [model, setModel] = useState(config.model);
  const [temperature, setTemperature] = useState(config.temperature);
  const [baseUrl, setBaseUrl] = useState(config.base_url || "");
  const [notes, setNotes] = useState(config.notes || "");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );

  const isDirty =
    provider !== config.provider ||
    model !== config.model ||
    temperature !== config.temperature ||
    baseUrl !== (config.base_url || "") ||
    notes !== (config.notes || "");

  const handleProviderChange = useCallback(
    (newProvider: string) => {
      setProvider(newProvider);
      // Auto-fill default model when switching providers
      if (newProvider !== provider) {
        setModel(PROVIDER_DEFAULT_MODELS[newProvider] || "");
      }
      // Clear base URL when switching away from custom
      if (newProvider !== "custom") {
        setBaseUrl("");
      }
      setSaveStatus("idle");
    },
    [provider],
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
    };

    const success = await onSave(config.purpose, update);
    setSaveStatus(success ? "success" : "error");
    setSaving(false);

    if (success) {
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [provider, model, temperature, baseUrl, notes, config.purpose, onSave]);

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
          {(PROVIDER_MODELS[provider]?.length ?? 0) > 0 ? (
            <>
              <select
                value={
                  PROVIDER_MODELS[provider]?.some((m) => m.id === model)
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
                {PROVIDER_MODELS[provider].map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.context ? ` (${m.context})` : ""}
                  </option>
                ))}
                <option value="__custom__">Custom model ID...</option>
              </select>
              {!PROVIDER_MODELS[provider]?.some((m) => m.id === model) && (
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
