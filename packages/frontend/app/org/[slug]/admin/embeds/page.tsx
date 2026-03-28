"use client";

import React, { useState, useCallback, useEffect } from "react";
import { AlertCircle, Code } from "lucide-react";
import { useOrg } from "../../../hooks/useOrg";
import {
  fetchOrgEmbedTokens,
  revokeOrgEmbedToken,
  type EmbedTokenListItem,
} from "@/lib/data";
import { EmbedBuilder } from "./EmbedBuilder";
import { ExistingEmbeds } from "./ExistingEmbeds";

export default function OrgAdminEmbeds() {
  const { org, loading: orgLoading } = useOrg();
  const [embeds, setEmbeds] = useState<EmbedTokenListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEmbeds = useCallback(async () => {
    if (!org?.slug) return;
    setLoading(true);
    setError(null);
    try {
      const tokens = await fetchOrgEmbedTokens(org.slug);
      setEmbeds(tokens);
    } catch (err) {
      setError("Failed to load embeds");
      console.error("[OrgAdminEmbeds] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [org?.slug]);

  useEffect(() => {
    loadEmbeds();
  }, [loadEmbeds]);

  const handleRevoke = useCallback(
    async (tokenId: string) => {
      if (!org?.slug) return;
      try {
        await revokeOrgEmbedToken(org.slug, tokenId);
        setEmbeds((prev) =>
          prev.map((e) => (e.id === tokenId ? { ...e, is_active: false } : e)),
        );
      } catch (err) {
        console.error("[OrgAdminEmbeds] Revoke error:", err);
      }
    },
    [org?.slug],
  );

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!org) return null;

  if (!org.embed_enabled) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <Code className="w-12 h-12 text-on-surface-variant/40 mx-auto" />
        <h2 className="text-lg font-medium text-on-surface">
          Embeddable Widgets
        </h2>
        <p className="text-sm text-on-surface-variant">
          Embed PropertyIQ data on your website. Contact your admin to enable
          this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <EmbedBuilder orgSlug={org.slug} onCreated={loadEmbeds} />

      {!loading && (
        <ExistingEmbeds
          embeds={embeds}
          orgSlug={org.slug}
          onRevoke={handleRevoke}
        />
      )}
    </div>
  );
}
