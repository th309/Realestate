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

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  deepseek: "deepseek-chat",
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-2.0-flash",
  openrouter: "anthropic/claude-sonnet-4-20250514",
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
          <input
            type="text"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setSaveStatus("idle");
            }}
            placeholder={PROVIDER_DEFAULT_MODELS[provider] || "model-name"}
            className="w-full px-3 py-2 text-sm rounded-lg border border-outline-variant bg-surface text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
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
