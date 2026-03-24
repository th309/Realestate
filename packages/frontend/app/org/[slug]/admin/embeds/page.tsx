"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Plus, Loader2, AlertCircle, RefreshCw, Code } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgEmbedTokens,
  createOrgEmbedToken,
  revokeOrgEmbedToken,
} from "@/lib/data";
import type { EmbedTokenListItem } from "@/lib/data";
import { EmbedTokenCard } from "../../../components/EmbedTokenCard";
import {
  CreateEmbedDialog,
  TokenRevealDialog,
} from "../../../components/CreateEmbedDialog";

/**
 * Embed token management page for the enterprise admin portal.
 * Lists existing tokens, supports creation with one-time token reveal,
 * and revocation of active tokens.
 */
export default function OrgAdminEmbeds() {
  const { org } = useOrg();

  const [tokens, setTokens] = useState<EmbedTokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // One-time token reveal after creation
  const [revealToken, setRevealToken] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "";

  // Check if embeds are enabled on the org (optional field)
  const embedEnabled = (org as Record<string, unknown> | null)?.embed_enabled;
  const isEmbedDisabled = embedEnabled === false;

  const loadTokens = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrgEmbedTokens(org.slug);
      setTokens(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => {
    if (!isEmbedDisabled) {
      void loadTokens();
    } else {
      setLoading(false);
    }
  }, [loadTokens, isEmbedDisabled]);

  const handleCreate = useCallback(
    async (data: {
      name: string;
      allowed_origins: string[];
      widget_types: string[];
    }) => {
      if (!org) return;
      setCreating(true);
      try {
        const created = await createOrgEmbedToken(org.slug, data);
        setRevealToken(created.token);
        setCreateOpen(false);
        await loadTokens();
      } finally {
        setCreating(false);
      }
    },
    [org, loadTokens],
  );

  const handleRevoke = useCallback(
    async (tokenId: string) => {
      if (!org) return;
      try {
        await revokeOrgEmbedToken(org.slug, tokenId);
        await loadTokens();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke token");
      }
    },
    [org, loadTokens],
  );

  // Embeds disabled state
  if (!loading && isEmbedDisabled) {
    return (
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-semibold text-on-surface mb-2">
          Embed Tokens
        </h1>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center mt-6">
          <Code className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
          <p className="text-base font-medium text-on-surface">
            Embeds are not enabled for your organization
          </p>
          <p className="text-sm text-on-surface-variant mt-2">
            Contact support to enable embeddable PropertyIQ widgets for your
            website.
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
          <h1 className="text-2xl font-semibold text-on-surface">
            Embed Tokens
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Manage tokens for embedding PropertyIQ widgets on external sites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadTokens()}
            className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Refresh tokens"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
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
            onClick={() => void loadTokens()}
            className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : tokens.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-8 text-center">
          <Code className="w-8 h-8 text-on-surface-variant mx-auto mb-3" />
          <p className="text-base font-medium text-on-surface">
            No embed tokens yet
          </p>
          <p className="text-sm text-on-surface-variant mt-2">
            Create one to embed PropertyIQ widgets on your website.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Token
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tokens.map((token) => (
            <EmbedTokenCard
              key={token.id}
              token={token}
              baseUrl={baseUrl}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateEmbedDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
        creating={creating}
      />

      {/* One-time token reveal */}
      <TokenRevealDialog
        isOpen={revealToken !== null}
        onClose={() => setRevealToken(null)}
        tokenValue={revealToken ?? ""}
      />
    </div>
  );
}
