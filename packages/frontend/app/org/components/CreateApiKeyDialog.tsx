"use client";

import React, { useState, useCallback } from "react";
import { X, AlertCircle, Copy, Check, Shield } from "lucide-react";

// ---------------------------------------------------------------------------
// Scope definitions grouped by resource
// ---------------------------------------------------------------------------

interface ScopeOption {
  value: string;
  label: string;
}

interface ScopeGroup {
  resource: string;
  scopes: ScopeOption[];
}

const SCOPE_GROUPS: ScopeGroup[] = [
  {
    resource: "Scores",
    scopes: [{ value: "scores:read", label: "Read scores" }],
  },
  {
    resource: "Metrics",
    scopes: [{ value: "metrics:read", label: "Read metrics" }],
  },
  {
    resource: "Rankings",
    scopes: [{ value: "rankings:read", label: "Read rankings" }],
  },
  {
    resource: "Reports",
    scopes: [
      { value: "reports:read", label: "Read reports" },
      { value: "reports:write", label: "Create reports" },
    ],
  },
  {
    resource: "Watchlist",
    scopes: [
      { value: "watchlist:read", label: "Read watchlist" },
      { value: "watchlist:write", label: "Modify watchlist" },
    ],
  },
];

const ALL_SCOPE_VALUES = SCOPE_GROUPS.flatMap((g) =>
  g.scopes.map((s) => s.value),
);

const RATE_LIMIT_OPTIONS = [
  { value: 60, label: "60 RPM" },
  { value: 120, label: "120 RPM" },
  { value: 300, label: "300 RPM" },
  { value: 600, label: "600 RPM" },
] as const;

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

interface CreateApiKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    scopes: string[];
    rate_limit_rpm: number;
  }) => Promise<void>;
  creating: boolean;
}

/**
 * M3 dialog for creating a new API key.
 * Collects name, scope checkboxes grouped by resource, and rate limit.
 */
export function CreateApiKeyDialog({
  isOpen,
  onClose,
  onCreate,
  creating,
}: CreateApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const allSelected = scopes.length === ALL_SCOPE_VALUES.length;
  const canSubmit = name.trim().length > 0 && scopes.length > 0 && !creating;

  const handleToggleScope = useCallback((value: string) => {
    setScopes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleToggleAll = useCallback(() => {
    setScopes((prev) =>
      prev.length === ALL_SCOPE_VALUES.length ? [] : [...ALL_SCOPE_VALUES],
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
          scopes,
          rate_limit_rpm: rateLimit,
        });
        // Reset form on success
        setName("");
        setScopes([]);
        setRateLimit(60);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create API key",
        );
      }
    },
    [canSubmit, name, scopes, rateLimit, onCreate],
  );

  const handleClose = useCallback(() => {
    if (creating) return;
    setName("");
    setScopes([]);
    setRateLimit(60);
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
      <div className="relative bg-surface rounded-[28px] shadow-xl max-w-md w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-medium text-on-surface">
              Create API Key
            </h2>
          </div>
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
              htmlFor="api-key-name"
              className="block text-sm font-medium text-on-surface mb-1.5"
            >
              Key Name
            </label>
            <input
              id="api-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production Backend"
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={creating}
              autoFocus
            />
          </div>

          {/* Scopes — checkboxes grouped by resource */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-on-surface">
                Scopes
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleToggleAll}
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                  disabled={creating}
                />
                <span className="text-xs text-on-surface-variant">
                  Select All
                </span>
              </label>
            </div>

            <div className="space-y-3">
              {SCOPE_GROUPS.map((group) => (
                <div key={group.resource}>
                  <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wide mb-1.5">
                    {group.resource}
                  </p>
                  <div className="space-y-1.5 pl-1">
                    {group.scopes.map((scope) => (
                      <label
                        key={scope.value}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={scopes.includes(scope.value)}
                          onChange={() => handleToggleScope(scope.value)}
                          className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                          disabled={creating}
                        />
                        <span className="text-sm text-on-surface">
                          {scope.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {scopes.length === 0 && (
              <p className="text-xs text-on-surface-variant mt-1.5">
                Select at least one scope.
              </p>
            )}
          </div>

          {/* Rate limit dropdown */}
          <div>
            <label
              htmlFor="api-key-rate-limit"
              className="block text-sm font-medium text-on-surface mb-1.5"
            >
              Rate Limit
            </label>
            <select
              id="api-key-rate-limit"
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={creating}
            >
              {RATE_LIMIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-on-surface-variant mt-1">
              Maximum requests per minute for this key.
            </p>
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
              {creating ? "Creating..." : "Create Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One-time key reveal dialog — shown immediately after creation
// ---------------------------------------------------------------------------

interface KeyRevealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  keyValue: string;
}

/**
 * Displays the full API key value exactly once after creation.
 * Includes a copy button and a warning that it cannot be retrieved later.
 */
export function KeyRevealDialog({
  isOpen,
  onClose,
  keyValue,
}: KeyRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(keyValue);
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
          API Key Created
        </h2>

        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20 mb-4">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This key won&apos;t be shown again. Copy it now and store it
            securely.
          </p>
        </div>

        <div className="relative">
          <pre className="rounded-xl bg-surface-container p-4 text-xs leading-relaxed text-on-surface break-all whitespace-pre-wrap font-mono">
            {keyValue}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Copy API key"
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
