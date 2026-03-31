"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Key,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { PageHeaderWithBreadcrumbs } from "@/components/navigation";
import {
  fetchUserApiKeys,
  createUserApiKey,
  revokeUserApiKey,
} from "@/lib/data";
import type {
  UserApiKeyListItem,
  CreateUserApiKeyPayload,
  UserApiKey,
} from "@/lib/data";
import { CreatedKeyBanner } from "./CreatedKeyBanner";
import { CreateKeyForm } from "./CreateKeyForm";
import { PersonalApiKeyCard } from "./PersonalApiKeyCard";

/**
 * Personal API key management page — /account/api-keys
 *
 * Allows Pro-tier users to create, view, and revoke personal API keys for
 * programmatic access to PropertyIQ scores and market data.
 */
export default function PersonalApiKeysPage() {
  const [keys, setKeys] = useState<UserApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<UserApiKey | null>(
    null,
  );

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserApiKeys();
      setKeys(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCreate = useCallback(
    async (payload: CreateUserApiKeyPayload) => {
      setCreating(true);
      try {
        const created = await createUserApiKey(payload);
        setNewlyCreatedKey(created);
        setShowCreateForm(false);
        await loadKeys();
      } finally {
        setCreating(false);
      }
    },
    [loadKeys],
  );

  const handleRevoke = useCallback(
    async (keyId: string) => {
      try {
        await revokeUserApiKey(keyId);
        await loadKeys();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to revoke API key",
        );
      }
    },
    [loadKeys],
  );

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeaderWithBreadcrumbs
          breadcrumbs={[
            { label: "Account", href: "/account" },
            { label: "API Keys" },
          ]}
          title="API Keys"
          icon={<Key className="w-5 h-5" />}
        />

        <div className="mt-8">
          {/* Action bar */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-on-surface-variant">
              Use API keys to access PropertyIQ data programmatically from your
              scripts, apps, or automations.
            </p>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                onClick={() => void loadKeys()}
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
                aria-label="Refresh API keys"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Key
                </button>
              )}
            </div>
          </div>

          {/* One-time key reveal banner (shown after creation) */}
          {newlyCreatedKey?.key && (
            <CreatedKeyBanner
              keyValue={newlyCreatedKey.key}
              onDismiss={() => setNewlyCreatedKey(null)}
            />
          )}

          {/* Inline create form */}
          {showCreateForm && (
            <CreateKeyForm
              onCancel={() => setShowCreateForm(false)}
              onCreate={handleCreate}
              creating={creating}
            />
          )}

          {/* Key list / loading / error / empty states */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-on-surface-variant" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={loadKeys} />
          ) : keys.length === 0 && !showCreateForm ? (
            <EmptyState onCreateClick={() => setShowCreateForm(true)} />
          ) : (
            <div className="space-y-4">
              {keys.map((apiKey) => (
                <PersonalApiKeyCard
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
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local presentational sub-components (stateless, small)
// ---------------------------------------------------------------------------

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
      <Key className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
      <p className="text-base font-medium text-on-surface">No API keys yet</p>
      <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
        API keys let you pull PropertyIQ scores and market data into your
        scripts, spreadsheets, or apps.
      </p>
      <button
        onClick={onCreateClick}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Create Key
      </button>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 text-center">
      <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
      <p className="text-sm text-on-surface-variant">{message}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
