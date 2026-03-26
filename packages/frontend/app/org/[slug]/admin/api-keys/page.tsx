"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Key,
  ExternalLink,
} from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgApiKeys,
  createOrgApiKey,
  revokeOrgApiKey,
} from "@/lib/data/fetchers/org-api-keys";
import type { ApiKeyListItem } from "@/lib/data/fetchers/org-api-keys";
import { ApiKeyCard } from "../../../components/ApiKeyCard";
import {
  CreateApiKeyDialog,
  KeyRevealDialog,
} from "../../../components/CreateApiKeyDialog";

/**
 * API key management page for the enterprise admin portal.
 * Lists existing keys, supports creation with scope selection and
 * one-time key reveal, and revocation of active keys.
 */
export default function OrgAdminApiKeys() {
  const { org } = useOrg();

  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // One-time key reveal after creation
  const [revealKey, setRevealKey] = useState<string | null>(null);

  // Check if API access is enabled on the org (optional field)
  const apiEnabled = (org as Record<string, unknown> | null)?.api_enabled;
  const isApiDisabled = apiEnabled === false;

  const loadKeys = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrgApiKeys(org.slug);
      setKeys(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    if (!isApiDisabled) {
      void loadKeys();
    } else {
      setLoading(false);
    }
  }, [loadKeys, isApiDisabled]);

  const handleCreate = useCallback(
    async (data: {
      name: string;
      scopes: string[];
      rate_limit_rpm: number;
    }) => {
      if (!org) return;
      setCreating(true);
      try {
        const created = await createOrgApiKey(org.slug, data);
        setRevealKey(created.key ?? null);
        setCreateOpen(false);
        await loadKeys();
      } finally {
        setCreating(false);
      }
    },
    [org, loadKeys],
  );

  const handleRevoke = useCallback(
    async (keyId: string) => {
      if (!org) return;
      try {
        await revokeOrgApiKey(org.slug, keyId);
        await loadKeys();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to revoke API key",
        );
      }
    },
    [org, loadKeys],
  );

  // API disabled state
  if (!loading && isApiDisabled) {
    return (
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-semibold text-on-surface mb-2">
          API Keys
        </h1>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center mt-6">
          <Key className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
          <p className="text-base font-medium text-on-surface">
            API access is not enabled for your organization
          </p>
          <p className="text-sm text-on-surface-variant mt-2">
            API access is available on Enterprise plans. Contact your account
            manager to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">API Keys</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage API keys for programmatic access to PropertyIQ data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadKeys()}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Refresh API keys"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-on-surface-variant">{error}</p>
          <button
            onClick={() => void loadKeys()}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <Key className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
          <p className="text-base font-medium text-on-surface">
            No API keys yet
          </p>
          <p className="text-sm text-on-surface-variant mt-2">
            API keys let you pull PropertyIQ data into your website,
            spreadsheets, CRM, and automations. Create your first key to get
            started.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
          <br />
          <a
            href="/docs/api#getting-started"
            className="text-xs text-on-surface-variant hover:text-primary hover:underline mt-4 inline-block"
          >
            Learn what you can build with the API →
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((apiKey) => (
            <ApiKeyCard
              key={apiKey.id}
              apiKey={apiKey}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}

      {/* Docs link */}
      {!loading && (
        <div className="mt-6">
          <a
            href="/docs/api"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View API Documentation
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* Create dialog */}
      <CreateApiKeyDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        creating={creating}
      />

      {/* One-time key reveal */}
      <KeyRevealDialog
        isOpen={revealKey !== null}
        onClose={() => setRevealKey(null)}
        keyValue={revealKey ?? ""}
      />
    </div>
  );
}
