"use client";

import React, { useState, useCallback } from "react";
import { X, Plus, AlertCircle, Copy, Check } from "lucide-react";

interface CreateEmbedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    allowed_origins: string[];
    widget_types: string[];
  }) => Promise<void>;
  creating: boolean;
}

const WIDGET_OPTIONS = [
  { value: "score", label: "Score Ring" },
  { value: "metric-card", label: "Metric Card" },
  { value: "map", label: "Interactive Map" },
] as const;

function isValidOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * M3 dialog for creating a new embed token.
 * Collects name, allowed origins (multi-chip input), and widget type checkboxes.
 */
export function CreateEmbedDialog({
  isOpen,
  onClose,
  onCreate,
  creating,
}: CreateEmbedDialogProps) {
  const [name, setName] = useState("");
  const [origins, setOrigins] = useState<string[]>([]);
  const [originInput, setOriginInput] = useState("");
  const [originError, setOriginError] = useState<string | null>(null);
  const [widgetTypes, setWidgetTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 &&
    origins.length > 0 &&
    widgetTypes.length > 0 &&
    !creating;

  const handleAddOrigin = useCallback(() => {
    const trimmed = originInput.trim();
    if (!trimmed) return;

    if (!isValidOrigin(trimmed)) {
      setOriginError("Enter a valid URL (e.g. https://example.com)");
      return;
    }
    if (origins.includes(trimmed)) {
      setOriginError("Origin already added");
      return;
    }

    setOrigins((prev) => [...prev, trimmed]);
    setOriginInput("");
    setOriginError(null);
  }, [originInput, origins]);

  const handleOriginKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddOrigin();
      }
    },
    [handleAddOrigin],
  );

  const handleRemoveOrigin = useCallback((origin: string) => {
    setOrigins((prev) => prev.filter((o) => o !== origin));
  }, []);

  const handleToggleWidget = useCallback((value: string) => {
    setWidgetTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setError(null);
      try {
        await onCreate({
          name: name.trim(),
          allowed_origins: origins,
          widget_types: widgetTypes,
        });
        // Reset form on success
        setName("");
        setOrigins([]);
        setOriginInput("");
        setWidgetTypes([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create token");
      }
    },
    [canSubmit, name, origins, widgetTypes, onCreate],
  );

  const handleClose = useCallback(() => {
    if (creating) return;
    setName("");
    setOrigins([]);
    setOriginInput("");
    setOriginError(null);
    setWidgetTypes([]);
    setError(null);
    onClose();
  }, [creating, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative bg-surface rounded-[28px] shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium text-on-surface">
            Create Embed Token
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
            aria-label="Close dialog"
            disabled={creating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name input */}
          <div>
            <label
              htmlFor="embed-token-name"
              className="block text-sm font-medium text-on-surface mb-1.5"
            >
              Token Name
            </label>
            <input
              id="embed-token-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Company Blog Widget"
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={creating}
              autoFocus
            />
          </div>

          {/* Allowed Origins — multi-chip input */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1.5">
              Allowed Origins
            </label>
            {origins.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {origins.map((origin) => (
                  <span
                    key={origin}
                    className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-xs text-on-surface"
                  >
                    {origin}
                    <button
                      type="button"
                      onClick={() => handleRemoveOrigin(origin)}
                      className="rounded-full p-0.5 hover:bg-surface-container-high transition-colors"
                      aria-label={`Remove ${origin}`}
                      disabled={creating}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={originInput}
                onChange={(e) => {
                  setOriginInput(e.target.value);
                  setOriginError(null);
                }}
                onKeyDown={handleOriginKeyDown}
                placeholder="https://example.com"
                className="flex-1 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={creating}
              />
              <button
                type="button"
                onClick={handleAddOrigin}
                className="shrink-0 rounded-full p-2.5 text-primary hover:bg-primary/10 transition-colors"
                aria-label="Add origin"
                disabled={creating}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {originError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {originError}
              </p>
            )}
            <p className="text-xs text-on-surface-variant mt-1">
              Press Enter to add. Only these domains can load your embed.
            </p>
          </div>

          {/* Widget Types — checkboxes */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">
              Widget Types
            </label>
            <div className="space-y-2">
              {WIDGET_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={widgetTypes.includes(opt.value)}
                    onChange={() => handleToggleWidget(opt.value)}
                    className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                    disabled={creating}
                  />
                  <span className="text-sm text-on-surface">{opt.label}</span>
                </label>
              ))}
            </div>
            {widgetTypes.length === 0 && (
              <p className="text-xs text-on-surface-variant mt-1.5">
                Select at least one widget type.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 dark:bg-red-950/20">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full px-5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "Creating..." : "Create Token"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-time token reveal dialog — shown immediately after creation
// ---------------------------------------------------------------------------

interface TokenRevealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tokenValue: string;
}

/**
 * Displays the full token value exactly once after creation.
 * Includes a copy button and a warning that it cannot be retrieved later.
 */
export function TokenRevealDialog({
  isOpen,
  onClose,
  tokenValue,
}: TokenRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API fallback — silent
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" aria-hidden />

      <div className="relative bg-surface rounded-[28px] shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-xl font-medium text-on-surface mb-2">
          Token Created
        </h2>

        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20 mb-4">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This token won&apos;t be shown again. Copy it now and store it
            securely.
          </p>
        </div>

        <div className="relative">
          <pre className="rounded-xl bg-surface-container p-4 text-xs leading-relaxed text-on-surface break-all whitespace-pre-wrap font-mono">
            {tokenValue}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Copy token"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={onClose}
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
