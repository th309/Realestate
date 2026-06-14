"use client";

import React, { useState, useCallback } from "react";
import { Shield, AlertCircle, Loader2 } from "lucide-react";
import type { CreateUserApiKeyPayload } from "@/lib/data";
import { AVAILABLE_SCOPES, type ScopeValue } from "./scopes";

interface CreateKeyFormProps {
  onCancel: () => void;
  onCreate: (payload: CreateUserApiKeyPayload) => Promise<void>;
  creating: boolean;
}

/**
 * Inline form for creating a new personal API key.
 * Collects a name and scope checkboxes, then calls onCreate.
 * Displayed inline on the page (not a modal) for a lower-friction flow.
 */
export function CreateKeyForm({
  onCancel,
  onCreate,
  creating,
}: CreateKeyFormProps) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ScopeValue[]>([]);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selectedScopes.length === AVAILABLE_SCOPES.length;
  const canSubmit =
    name.trim().length > 0 && selectedScopes.length > 0 && !creating;

  const handleToggleScope = useCallback((value: ScopeValue) => {
    setSelectedScopes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedScopes((prev) =>
      prev.length === AVAILABLE_SCOPES.length
        ? []
        : (AVAILABLE_SCOPES.map((s) => s.value) as ScopeValue[]),
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setError(null);
      try {
        await onCreate({ name: name.trim(), scopes: selectedScopes });
        // Parent closes this form on success
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create API key",
        );
      }
    },
    [canSubmit, name, selectedScopes, onCreate],
  );

  return (
    <div className="bg-surface-container-low rounded-xl border border-outline-variant/50 p-6 mb-6">
      <div className="flex items-center gap-2 mb-5">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold text-on-surface">New API Key</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label
            htmlFor="personal-api-key-name"
            className="block text-sm font-medium text-on-surface mb-1.5"
          >
            Key Name
          </label>
          <input
            id="personal-api-key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Script"
            className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={creating}
            autoFocus
            maxLength={80}
          />
        </div>

        {/* Scopes */}
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

          <div className="space-y-2">
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope.value}
                className="flex items-center gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.value)}
                  onChange={() => handleToggleScope(scope.value)}
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                  disabled={creating}
                />
                <span className="text-sm text-on-surface">{scope.label}</span>
              </label>
            ))}
          </div>

          {selectedScopes.length === 0 && (
            <p className="text-xs text-on-surface-variant mt-1.5">
              Select at least one scope.
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
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-5 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {creating ? "Creating..." : "Create Key"}
          </button>
        </div>
      </form>
    </div>
  );
}
